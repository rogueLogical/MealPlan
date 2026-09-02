const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE',
        'UPDATE',
        'DELETE',
        'BULK_UPDATE',
        'BULK_DELETE',
        'RESTORE',
        'ADMIN_USER_BAN',
        'ADMIN_USER_UNBAN',
        'ADMIN_USER_PROMOTE',
        'ADMIN_USER_DEMOTE',
        'ADMIN_RECIPE_DELETE',
        'ADMIN_INGREDIENT_DELETE'
      ]
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    targetType: {
      type: String,
      required: true,
      enum: [
        'User',
        'Recipe',
        'Ingredient',
        'ShoppingList',
        'PortionStorage',
        'MealPrepPlan',
        'Role'
      ]
    },
    targetId: {
      type: [mongoose.Schema.Types.ObjectId], // Support single or multiple document IDs
      required: true,
      default: []
    },
    beforeSnapshot: {
      type: mongoose.Schema.Types.Mixed
    },
    afterSnapshot: {
      type: mongoose.Schema.Types.Mixed
    },
    ipAddress: {
      type: String,
      default: 'unknown'
    },
    userAgent: {
      type: String,
      default: 'unknown'
    }
  },
  {
    timestamps: true
  }
);

// Create TTL index for automatic deletion of logs older than 30 days
AuditLogSchema.index(
  { timestamp: -1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days in seconds
);

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

module.exports = AuditLog;
