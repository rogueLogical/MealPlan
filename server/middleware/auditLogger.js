const AuditLog = require('../models/AuditLog');

/**
 * Extracts operation context from a request for audit logging.
 * Centralized extraction logic eliminates duplicated code across interceptors.
 */
function extractOperationContext(req) {
  const opTypeMap = {
    GET: 'READ',
    POST: req.body?.type === 'BULK' ? 'BULK_CREATE' : 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
    BULK_DELETE: 'BULK_DELETE'
  };

  const targetTypeMap = {
    user: 'User',
    recipe: 'Recipe',
    ingredient: 'Ingredient',
    shoppingList: 'ShoppingList',
    mealPrepPlan: 'MealPrepPlan',
    portionStorage: 'PortionStorage',
    role: 'Role'
  };

  const targetName = extractTargetNameFromPath(req);
  const opType = opTypeMap[req.method] || 'UNKNOWN';
  const targetIds = extractTargetIdsFromRequest(req, targetTypeMap[targetName]);

  return { opType, targetName, targetIds };
}

/**
 * Extracts the target name from the URL path (e.g., /recipes/:id → Recipe).
 */
function extractTargetNameFromPath(req) {
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
 */
function extractTargetIdsFromRequest(req, targetType) {
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

  return [];
}

/**
 * Creates an audit log entry silently (fails gracefully if MongoDB is unavailable).
 */
function createAuditLog(req, targetName, opType, targetIds) {
  const logEntry = new AuditLog({
    action: opType || 'UNKNOWN',
    actorId: req.userData?.userId || null,
    targetType: targetName || 'Unknown',
    targetId: targetIds || [],
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('user-agent') || 'unknown'
  });

  logEntry.save().catch((err) => {
    // Silent fail — don't let logging errors break the response
    console.error('[AuditLog] Failed to write entry:', err.message);
  });
}

/**
 * Main audit logger middleware.
 */
function auditLogger() {
  return async function (req, res) {
    if (!req.userData) {
      return;
    }

    // Intercept all response methods for consistent logging
    const originalJson = res.json.bind(res);
    res.json = async function (...args) {
      try {
        // Wait for any pending DB writes to complete
        await new Promise((resolve) => setTimeout(resolve, 50));

        const context = extractOperationContext(req);
        createAuditLog(req, context.targetName || 'Unknown', context.opType, context.targetIds);
      } catch {} // eslint-disable-line no-empty -- silent failure on logging errors
      return originalJson(...args);
    };

    const originalSend = res.send.bind(res);
    res.send = async function (body) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const context = extractOperationContext(req);
        createAuditLog(req, context.targetName || 'Unknown', context.opType, context.targetIds);
      } catch {} // eslint-disable-line no-empty
      return originalSend(body);
    };

    const originalDelete = res.delete.bind(res);
    res.delete = async function (...args) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const context = extractOperationContext(req);
        createAuditLog(req, context.targetName || 'Unknown', context.opType, context.targetIds);
      } catch {} // eslint-disable-line no-empty
      return originalDelete.apply(res, args);
    };

    return res;
  };
}

module.exports = { auditLogger, extractOperationContext };
