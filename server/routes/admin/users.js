const express = require('express');
const router = express.Router();
const RoleService = require('../../services/RoleService');
const banCheck = require('../../middleware/banCheck');
const superAdminCheck = require('../../middleware/superAdminCheck');

/**
 * @openapi
 * /admin/users/{userId}:
 *   post:
 *     summary: Ban a user account (temporary or permanent)
 */
router.post('/:userId/ban', async (req, res) => {
  try {
    const userId = req.params.userId;
    const durationDaysValue = req.body?.durationDays;
    const reasonValue = req.body?.reason;

    if (durationDaysValue !== undefined || reasonValue !== undefined) {
      return res.status(400).json({ error: 'Must provide both `durationDays` and/or `reason`.' });
    }

    const banArgs = [];
    if (durationDaysValue !== undefined) banArgs.push(durationDaysValue);
    if (reasonValue !== undefined) banArgs.push(reasonValue);

    await RoleService.banUser(userId, ...banArgs);

    return res.status(200).json({ success: true, message: `User ${userId} has been banned` });
  } catch (error) {
    console.error('[AdminUsers] Ban failed:', error.message);
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
 */
router.post('/:userId/unban', async (req, res) => {
  try {
    const userId = req.params.userId;

    await RoleService.unbanUser(userId);

    return res.status(200).json({ success: true, message: 'Temporary ban lifted' });
  } catch (error) {
    console.error('[AdminUsers] Unban failed:', error.message);
    if (error.code === 'INVALID_ID') {
      return res.status(404).json({ error: `User not found with ID: ${req.params.userId}` });
    }
    if (error.message.includes('permanently-banned')) {
      return res.status(400).json({ error: 'Cannot unban a permanently-banned account.' });
    }
    return res.status(500).json({ error: 'Failed to lift ban' });
  }
});

/**
 * @openapi
 * /admin/users/{userId}/promote:
 *   post:
 *     summary: Promote or demote a user's role
 */
router.post('/:userId/promote', superAdminCheck, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { roleType } = req.body;

    if (!['user', 'admin', 'super-admin'].includes(roleType)) {
      return res
        .status(400)
        .json({ error: `Invalid role type. Must be one of: user, admin, super-admin.` });
    }

    await RoleService.promoteOrDemote(userId, roleType);

    return res.status(200).json({ success: true, message: `User promoted to ${roleType}` });
  } catch (error) {
    console.error('[AdminUsers] Promote failed:', error.message);
    if (error.code === 'INVALID_ID') {
      return res.status(404).json({ error: `User not found with ID: ${req.params.userId}` });
    }
    return res.status(500).json({ error: 'Failed to promote/demote user' });
  }
});

/**
 * @openapi
 * /admin/users/{userId}/status:
 *   get:
 *     summary: Get current ban/role status for a user
 */
router.get('/:userId/status', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Check Roles collection first
    const Roles = require('../../../models/Roles');
    let roleDoc = await Roles.findOne({ userId });
    if (!roleDoc) {
      // No roles in collection — user is just a regular 'user'
      return res.status(200).json({ hasRole: false, roleType: null, isBanned: false });
    }

    const highestPriority = require('../../services/RoleService').getCurrentRole([roleDoc]);

    // Check for ban separately (lower priority)
    const banDoc = await Roles.findOne({ userId, roleType: 'banned' });

    return res.status(200).json({
      hasRole: true,
      roleType: highestPriority.roleType,
      isBanned: !!banDoc,
      banExpiresAt: banDoc?.expiresAt?.toISOString() ?? null,
      grantedBy: banDoc?.grantedById ? { _id: banDoc.grantedById } : null,
      grantReason: banDoc?.grantReason || roleDoc?.grantReason || '(none)'
    });
  } catch (error) {
    console.error('[AdminUsers] Status check failed:', error.message);
    return res.status(500).json({ error: 'Failed to fetch user status' });
  }
});

/**
 * @openapi
 * /admin/users/{userId}/delete:
 *   delete:
 *     summary: Permanently delete a user account and all their data
 */
router.delete('/:userId/delete', superAdminCheck, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Hard delete from User collection
    await require('../../../models/User').deleteOne({ _id: userId });
    // Also remove from Roles collection
    await require('../../../models/Roles').deleteMany({ userId });

    return res.status(200).json({ success: true, message: `User ${userId} deleted` });
  } catch (error) {
    console.error('[AdminUsers] Delete failed:', error.message);
    if (error.code === 'MONGODB_INCONSISTENT_NAME_ERROR') {
      return res.status(404).json({ error: `User not found with ID: ${req.params.userId}` });
    }
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
