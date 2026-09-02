const AuditLog = require('../models/AuditLog');

/**
 * Audit Logging Middleware Hook
 * Automatically creates audit log entries for all database-modifying operations
 * in API routes. Only captures actions that impact data in the database (GET excluded).
 */
function auditLogger() {
  return async (req, res, next) => {
    // Skip if not authenticated
    if (!req.userData) {
      return next();
    }

    // Store original method to check later
    req._originalMethod = req.method;

    // Wrap response methods to intercept successful/wrapped operations
    const originalRes = res;

    res.json = function (statusCode, data) {
      if (!req._originalMethod.startsWith('GET') && req.userData.isAdmin) {
        logOperation(req, 'UPDATE', null, data);
      }
      return originalRes.json.call(originalRes, statusCode, data);
    };

    res.send = async function (data) {
      if (!req._originalMethod.startsWith('GET') && req.userData.isAdmin) {
        logOperation(req, 'UPDATE', null, data);
      }
      return originalRes.send.call(originalRes, data);
    };

    res.delete = async function (...args) {
      const result = await originalRes.delete.apply(originalRes, args);
      if (req._originalMethod === 'DELETE' && req.userData.isAdmin) {
        // Log delete operations
        logOperation(req, 'DELETE', req.params || req.body);
      }
      return result;
    };

    next();
  };
}

/**
 * Log an operation to the audit log
 */
async function logOperation(req, action, targetData, responseData) {
  try {
    // Determine target type based on params or body
    let targetType = req.targetType || 'Unknown';
    let targetId = req.targetId || [];

    // Handle bulk operations
    if (req._bulkOp && Array.isArray(req._bulkOp)) {
      targetId = req._bulkOp.map((op) => op.targetId);
    } else if (Array.isArray(targetData) && targetData.length > 0) {
      // Extract targetId from request data if available
      const firstItem = targetData[0];
      if (firstItem._id) {
        targetId = [firstItem._id];
      }
    }

    const logEntry = new AuditLog({
      action,
      actorId: req.userData.userId,
      targetType,
      targetId,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown'
    });

    if (req.beforeSnapshot) {
      logEntry.beforeSnapshot = req.beforeSnapshot;
    }

    if (req.afterSnapshot) {
      logEntry.afterSnapshot = req.afterSnapshot;
    }

    await logEntry.save();
  } catch (error) {
    console.error('Failed to write audit log:', error.message);
    // Don't fail the request if audit logging fails
  }
}

/**
 * Wrapper for DELETE operations that logs them automatically
 */
function withAuditLogging(deleteHandler) {
  return async (req, res) => {
    const beforeSnapshot = req.beforeSnapshot;

    try {
      await deleteHandler(req, res);

      if (!res.headersSent && !res.writableEnded) {
        // Check if operation succeeded and log after snapshot
        if (req.afterSnapshot) {
          auditLogger()(req, res, () => {});
        }
      }
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  };
}

/**
 * Wrapper for bulk operations that logs them automatically
 */
function withBulkAuditLogging(bulkHandler) {
  return async (req, res) => {
    req._bulkOp = [];

    try {
      await bulkHandler(req, res);

      if (!res.headersSent && !res.writableEnded && Array.isArray(req._bulkOp)) {
        // Log bulk operation after completion
        const logs = req._bulkOp.map((op) => ({
          action: op.action,
          targetType: op.targetType,
          targetId: [op.targetId]
        }));

        await AuditLog.insertMany(logs, { ordered: false });
      }
    } catch (error) {
      console.error('Bulk operation failed:', error.message);
      throw error;
    }
  };
}

module.exports = {
  auditLogger,
  withAuditLogging,
  withBulkAuditLogging,
  logOperation
};
