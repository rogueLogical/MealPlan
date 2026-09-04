const jwt = require('jsonwebtoken');
const User = require('../models/User').default || require('../models/User');

/**
 * Super-Admin Check Middleware.
 * Requires the authenticated user to have 'super-admin' role.
 * Returns 403 Forbidden if not a super-admin.
 */

module.exports = function createSuperAdminCheck() {
  let roleType;
  return async (req, res, next) => {
    // If no auth header or JWT failed earlier, skip (auth middleware already returned error)
    if (!req.userData?.userId) {
      return next(); // Auth already handled this
    }

    try {
      const user = await User.findById(req.userData.userId);

      if (!user) {
        console.error('[SuperAdminCheck] Authenticated user not found:', req.userData.userId);
        return res.status(403).json({ message: 'User not found. Session may be invalid.' });
      }

      // Check Roles collection for highest-priority role
      const Roles = require('../models/Roles');
      const highestRoleDoc = await Roles.findOne({ userId: user._id }).sort({ grantedAt: -1 });

      if (!highestRoleDoc) {
        // No roles in collection — fall back to denormalized field on User model
        roleType = user.roles?.find((r) => r.roleType)?.roleType || 'user';
      } else {
        roleType = highestRoleDoc.roleType;
      }

      if (roleType !== 'super-admin') {
        console.log(`[SuperAdminCheck] Non-super-admin access denied: ${user.email} (${roleType})`);
        return res.status(403).json({ message: 'This action requires super-admin privileges.' });
      }
    } catch (err) {
      console.error('[SuperAdminCheck] Error checking super-admin status:', err.message);
      // Fail open: if we can't verify, deny access
      return res.status(500).json({ message: 'Unable to verify admin privileges.' });
    }

    next();
  };
};
