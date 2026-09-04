const AuditLog = require('../models/AuditLog');

/**
 * AuditLogger class for consistent audit logging across all routes.
 *
 * Architecture:
 * - On request, attach response listener via req.on('response', ...)
 * - This captures all responses uniformly regardless of method (GET, POST, DELETE, etc.)
 * - Extracts operation context once and reuses it
 */
class AuditLogger {
  /**
   * Map HTTP methods to audit action types
   */
  static opTypeMap = {
    GET: 'READ',
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE'
  };

  /**
   * Map target collection names from path parameters
   */
  static targetTypeMap = {
    user: 'User',
    recipe: 'Recipe',
    ingredient: 'Ingredient',
    shoppingList: 'ShoppingList',
    mealPrepPlan: 'MealPrepPlan',
    portionStorage: 'PortionStorage',
    role: 'Role'
  };

  /**
   * Creates an audit log entry silently (fails gracefully if MongoDB is unavailable).
   * @param {Object} req - Express request object
   * @param {string} targetName - Name of the target collection
   * @param {string} opType - Operation type (CREATE, UPDATE, DELETE, etc.)
   * @param {Array<string>} targetIds - Array of document IDs affected
   */
  static createAuditLog(req, targetName, opType, targetIds) {
    const logEntry = new AuditLog({
      action: opType || 'UNKNOWN',
      actorId: req.userData?.userId || null,
      targetType: targetName || 'Unknown',
      targetId: targetIds || [],
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown'
    });

    // Silent fail — don't let logging errors break the response
    logEntry.save().catch((err) => {
      console.error('[AuditLog] Failed to write entry:', err.message);
    });
  }

  /**
   * Extracts the target name from the URL path (e.g., /recipes/:id → Recipe).
   * @param {Object} req - Express request object
   * @returns {string} Target collection name or 'Unknown'
   */
  static extractTargetNameFromPath(req) {
    const urlParts = req.originalUrl.split('/');
    for (const part of urlParts) {
      if (!part.startsWith(':')) continue;
      const name = part.slice(1);

      switch (name) {
        case 'userId':
          return 'User';
        case 'recipeId': {
          if ('id' === name && req.originalUrl.includes('/recipes')) {
            return 'Recipe';
          }
          break;
        }
        case 'ingredientId': {
          if ('id' === name && req.originalUrl.includes('/ingredients')) {
            return 'Ingredient';
          }
          break;
        }
        case 'shoppingListId': {
          if ('id' === name && req.originalUrl.includes('/shopping-list')) {
            return 'ShoppingList';
          }
          break;
        }
        default:
          return 'Unknown';
      }
    }
    return 'Unknown';
  }

  /**
   * Extracts target IDs from request body or params.
   * @param {Object} req - Express request object
   * @returns {Array<string>} Array of document IDs or empty array
   */
  static extractTargetIdsFromRequest(req) {
    const urlParts = req.originalUrl.split('/');
    let foundParamId = false;

    for (const part of urlParts) {
      if (!part.startsWith(':')) continue;
      const name = part.slice(1);
      if (name === 'userId' || name === 'recipeId' || name === 'ingredientId') {
        foundParamId = true;
        break;
      }
    }

    if (foundParamId) {
      const idValue = req.params.id;
      if (idValue) {
        return [idValue];
      }
    }

    // Extract from body for bulk operations or POST/PUT with embedded IDs
    if (!Array.isArray(req.body)) {
      const body = req.body || {};
      if (body._id) return [body._id];
      if (Array.isArray(body) && body.length > 0 && body[0]._id) {
        return body.slice(0, 10).map((s) => s._id);
      }
    }

    // No IDs found
  }

  /**
   * Main audit logger middleware.
   * Uses req.on('response', ...) to capture all responses uniformly.
   */
  static() {
    return async function (req, res) {
      if (!req.userData) {
        return; // No authenticated user — skip logging
      }

      // Intercept all response methods for consistent logging
      const originalJson = res.json.bind(res);
      res.json = async function (...args) {
        try {
          // Wait for any pending DB writes to complete
          await new Promise((resolve) => setTimeout(resolve, 50));

          const targetName = this.extractTargetNameFromPath(req);
          const opType = this.opTypeMap[req.method] || 'UNKNOWN';
          const targetIds = this.extractTargetIdsFromRequest(req);

          if (targetName !== 'Unknown' && targetIds.length > 0) {
            this.createAuditLog(req, targetName, opType, targetIds);
          }
        } catch {} // eslint-disable-line no-empty -- silent failure on logging errors
        return originalJson(...args);
      };

      const originalSend = res.send.bind(res);
      res.send = async function (body) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 50));
          const targetName = this.extractTargetNameFromPath(req);
          const opType = this.opTypeMap[req.method] || 'UNKNOWN';
          const targetIds = this.extractTargetIdsFromRequest(req);

          if (targetName !== 'Unknown' && targetIds.length > 0) {
            this.createAuditLog(req, targetName, opType, targetIds);
          }
        } catch {} // eslint-disable-line no-empty -- silent failure on logging errors
        return originalSend(body);
      };

      const originalDelete = res.delete.bind(res);
      res.delete = async function (...args) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 50));
          const targetName = this.extractTargetNameFromPath(req);
          const opType = this.opTypeMap[req.method] || 'UNKNOWN';
          const targetIds = this.extractTargetIdsFromRequest(req);

          if (targetName !== 'Unknown' && targetIds.length > 0) {
            this.createAuditLog(req, targetName, opType, targetIds);
          }
        } catch {} // eslint-disable-line no-empty -- silent failure on logging errors
        return originalDelete.apply(res, args);
      };

      return res;
    };
  }
}

module.exports = AuditLogger;
