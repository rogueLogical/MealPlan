const express = require('express');
const router = express.Router();
const RoleService = require('../../services/RoleService');

// Apply ban-check middleware to all requests — blocks access for banned users
const banCheck = require('../../../middleware/banCheck');

/**
 * @openapi
 * /admin/users/{userId}/ban:
 *   post:
 *     summary: Ban a user account (temporary or permanent)
 *     description: |
 *       Banned accounts retain full access to their data. Temporary bans auto-reinstate on expiry.
 *       Requires authentication with admin or super-admin role.
 */
router.post('/users/:userId/ban', banCheck, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Validate: reject if already permanently banned
    const existingBan = await RoleService.getBan(userId);
    if (existingBan && !existingBan.expiresAt) {
      return res.status(400).json({
        error: 'Account is already permanently banned',
        details: `User ${userId} has a permanent ban that cannot be reversed.`
      });
    }

    // Reject if attempting to unban (durationDays < 0) as permanent ban
    const durationDays = req.body.durationDays ?? parseInt(req.query.durationDays);

    if (!Number.isInteger(durationDays) || durationDays < 0) {
      return res.status(400).json({
        error:
          'Invalid duration. Use a positive integer (days) for temporary bans, or 0 for permanent.',
        exampleBody: { durationDays: 30, reason: 'repeated abuse of platform features' }
      });
    }

    // Reject if attempting to permanently ban an already-permanently-banned user
    if (!existingBan && existingBan?.expiresAt === null) {
      return res
        .status(400)
        .json({ error: 'Cannot permanently ban a permanently banned account.' });
    }

    const result = await RoleService.banUser(userId, durationDays, req.body.reason);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `User ${userId} has been ${durationDays === 0 ? 'permanently' : 'temporarily'} banned`,
        banExpiresAt:
          durationDays === 0
            ? null
            : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
        reason: req.body.reason ?? '(none provided)'
      });
    }

    return res.status(500).json({ error: 'Failed to ban user' });
  } catch (error) {
    console.error('[BanRoute] Ban failed:', error.message);
    if (error.code === 'INVALID_ID') {
      return res.status(404).json({ error: `User not found with ID: ${req.params.userId}` });
    }
    if (error.code === 'USER_DELETED') {
      return res.status(410).json({ error: 'Target user account no longer exists.' });
    }
    return res.status(500).json({ error: 'Failed to ban user' });
  }
});

/**
 * @openapi
 * /admin/users/{userId}/unban:
 *   post:
 *     summary: Revoke a temporary ban from a user account
 *     description: |
 *       Removes the banned role. A permanently-banned account (no expiry) cannot be unbanned.
 */
router.post('/users/:userId/unban', banCheck, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Check if user is already permanently banned — reject unban attempt
    const existingBan = await RoleService.getBan(userId);
    if (!existingBan || !existingBan.expiresAt) {
      return res.status(400).json({
        error: 'Cannot unban a permanently-banned account. Contact support or delete the account.'
      });
    }

    const result = await RoleService.unbanUser(userId);

    if (result.success) {
      return res
        .status(200)
        .json({ success: true, message: `Temporary ban lifted for user ${userId}` });
    }

    return res.status(500).json({ error: 'Failed to lift ban' });
  } catch (error) {
    console.error('[BanRoute] Unban failed:', error.message);
    if (error.code === 'INVALID_ID') {
      return res.status(404).json({ error: `User not found with ID: ${req.params.userId}` });
    }
    if (error.code === 'USER_DELETED') {
      return res.status(410).json({ error: 'Target user account no longer exists.' });
    }
    return res.status(500).json({ error: 'Failed to unban user' });
  }
});

/**
 * @openapi
 * /admin/users/{userId}/ban-status:
 *   get:
 *     summary: Get current ban status for a user
 */
router.get('/users/:userId/ban-status', async (req, res) => {
  try {
    const userId = req.params.userId;

    const existingBan = await RoleService.getBan(userId);

    return res.status(200).json({
      hasBan: !!existingBan,
      isBanned: existingBan && !existingBan.expiresAt, // permanently banned
      expiresAt: existingBan?.expiresAt?.toISOString() ?? null,
      reason: existingBan?.grantReason ?? '(none)',
      grantedBy: existingBan?.grantedById ? { _id: existingBan.grantedById } : null
    });
  } catch (error) {
    if (error.code === 'INVALID_ID') {
      return res.status(404).json({ error: `User not found with ID: ${req.params.userId}` });
    }
    return res.status(500).json({ error: 'Failed to fetch ban status' });
  }
});

/**
 * @openapi
 * /admin/users/{userId}/bans:
 *   get:
 *     summary: List all bans for a user (can have multiple, e.g. overlapping temporary bans)
 */
router.get('/users/:userId/bans', async (req, res) => {
  try {
    const userId = req.params.userId;

    const bans = await RoleService.getBans(userId);

    return res.status(200).json({ bans });
  } catch (error) {
    if (error.code === 'INVALID_ID') {
      return res.status(404).json({ error: `User not found with ID: ${req.params.userId}` });
    }
    return res.status(500).json({ error: 'Failed to list bans' });
  }
});

module.exports = router;
