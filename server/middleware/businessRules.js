const Roles = require('../models/Roles');

/**
 * Middleware to enforce business rule: at least one super-admin and one admin must always exist
 * This middleware runs before user demotion/deletion operations in admin routes.
 */
async function ensureAdminsExist(req, res, next) {
  try {
    // Check how many super-admins and admins currently exist
    const superAdminCount = await Roles.countDocuments({ roleType: 'super-admin' });
    const adminCount = await Roles.countDocuments({ roleType: 'admin' });

    const superAdminExists = superAdminCount >= 1;
    const adminExists = adminCount >= 1 || superAdminCount >= 1; // super-admin also counts as admin

    if (!superAdminExists) {
      return res.status(400).json({
        message: 'Cannot perform this operation. At least one super-admin must always exist.'
      });
    }

    if (!adminExists) {
      return res.status(400).json({
        message:
          'Cannot perform this operation. At least one admin or super-admin must always exist.'
      });
    }

    next();
  } catch (error) {
    console.error('Business rule validation error:', error);
    return res.status(500).json({ message: 'Failed to validate admin counts' });
  }
}

module.exports = {
  ensureAdminsExist
};
