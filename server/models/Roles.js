const mongoose = require('mongoose');

/**
 * Roles Collection Schema
 *
 * This is the authoritative source for user roles. The denormalized `roles` field on User
 * is only for display purposes and should always be synchronized from this collection.
 */
const RolesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    roleType: {
      type: String,
      required: true,
      enum: ['user', 'admin', 'super-admin']
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    grantReason: {
      type: String,
      default: ''
    },
    expiresAt: {
      type: Date,
      index: true // TTL index for auto-expiry can be built on this field
    }
  },
  { timestamps: true }
);

// Compound index to enforce uniqueness of user-role combination (one role per user)
RolesSchema.index({ userId: 1, roleType: 1 });

const Roles = mongoose.model('Role', RolesSchema);

module.exports = Roles;
