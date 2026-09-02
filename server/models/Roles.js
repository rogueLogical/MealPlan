const mongoose = require('mongoose');

const RolesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true // Index for quick lookups by user
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
      default: null // null = permanent role
    }
  },
  {
    timestamps: true
  }
);

// Compound index to enforce uniqueness of user-role combination
RolesSchema.index({ userId: 1, roleType: 1 });

const Roles = mongoose.model('Role', RolesSchema);

module.exports = Roles;
