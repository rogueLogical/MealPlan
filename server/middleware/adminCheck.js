const User = require('../models/User').default || require('../models/User');

/**
 * Admin Check Middleware.
 * Requires the authenticated user to have 'admin' or 'super-admin' role.
 * Returns 403 Forbidden if user-only access attempts sensitive admin operations.
 */

module.exports = function createAdminCheck() {
  return async (req, res, next) => {
    // If no auth header or JWT failed earlier, skip (auth middleware already returned error)
    if (!req.userData?.userId) {
      return next(); // Auth already handled this
    }

    try {
      const user = await User.findById(req.userData.userId);

      if (!user) {
        console.error('[AdminCheck] Authenticated user not found:', req.userData.userId);
        return res.status(403).json({ message: 'User not found. Session may be invalid.' });
      }

      // Check Roles collection for highest-priority role
      const Roles = require('../models/Roles');
      const highestRoleDoc = await Roles.findOne({ userId: user._id }).sort({ grantedAt: -1 });

      let roleType;

      if (!highestRoleDoc) {
        // No roles in collection — fall back to denormalized field on User model
        roleType = user.roles?.find((r) => r.roleType)?.roleType || 'user';
      } else {
        roleType = highestRoleDoc.roleType;
      }

      if (!['admin', 'super-admin'].includes(roleType)) {
        console.log(`[AdminCheck] Non-admin access denied: ${user.email} (${roleType})`);
        return res
          .status(403)
          .json({ message: 'This action requires admin or super-admin privileges.' });
      }
    } catch (err) {
      console.error('[AdminCheck] Error checking admin status:', err.message);
      // Fail open: if we can't verify, deny access
      return res.status(500).json({ message: 'Unable to verify admin privileges.' });
    }

    next();
  };
};
