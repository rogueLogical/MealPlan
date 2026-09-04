const mongoose = require('mongoose');
const User = require('../models/User').default || require('../models/User');

/**
 * Ban Check Middleware — validates user's banned status on every request.
 * Returns 403 Forbidden if the account is banned (past expiry or permanently banned).
 * Banned accounts retain full access to their data; only authentication/logins are blocked.
 */

module.exports = function banCheck(req, res, next) {
  // Check if user is authenticated (has userData from auth middleware)
  if (!req.userData?.userId) {
    return next(); // Not logged in — skip ban check
  }

  User.findById(req.userData.userId)
    .then((user) => {
      if (!user) {
        console.error('[BanCheck] Authenticated user not found:', req.userData.userId);
        return next(); // User doesn't exist (deleted?) — allow access
      }

      if (user.isBanned && !user.banExpiresAt) {
        // Permanently banned
        console.log('[BanCheck] Permanently banned user blocked:', user.email || 'unknown');
        return res.status(403).json({ message: 'This account has been permanently banned.' });
      }

      if (user.isBanned && user.banExpiresAt) {
        const now = new Date();
        if (now > user.banExpiresAt) {
          // Ban expired — lift automatically
          console.log('[BanCheck] Ban expired, lifting restriction for:', user.email);
          user.isBanned = false;
          user.banExpiresAt = null;
          return User.findByIdAndUpdate(req.userData.userId, user.getChanges(), { new: true }).then(
            (updated) => next()
          );
        } else {
          // Still within ban period
          const remaining = Math.ceil((user.banExpiresAt - now) / (1000 * 60 * 60));
          console.log(`[BanCheck] Banned user blocked (expires in ${remaining}h):`, user.email);
          return res
            .status(403)
            .json({
              message: `This account is temporarily banned. Access restored in ~${remaining} hours.`
            });
        }
      }

      // Not banned — allow access
      next();
    })
    .catch((err) => {
      console.error('[BanCheck] Error checking ban status:', err.message);
      return next();
    });
};
