/**
 * Role Service — encapsulates all role mutation logic.
 * Decouples routes from schema knowledge and centralizes business rules.
 */

const mongoose = require('mongoose');
const Roles = require('../models/Roles');

// Lazy-load User to avoid circular dependency (User model already requires Roles)
let User;
async function getUserById(id) {
  if (!User) {
    const UserModule = require('../models/User');
    User = UserModule.default || UserModule;
  }
  return User.findById(id).orFail();
}

const AuditLog = require('../models/AuditLog');
const EmailService = require('./emailService');

/**
 * Promote or demote a user to a specific role.
 */
async function promoteOrDemote(userId, newRoleType) {
  if (!['user', 'admin', 'super-admin'].includes(newRoleType)) {
    throw new Error(`Invalid role type: ${newRoleType}`);
  }

  const oldRoles = await getUserRoles(userId);

  let action;
  if (!oldRoles || oldRoles.length === 0) {
    action = 'ADMIN_USER_PROMOTE';
  } else if (newRoleType === 'user') {
    action = 'ADMIN_USER_DEMOTE';
  } else {
    action = 'ADMIN_USER_PROMOTE';
  }

  const logEntry = new AuditLog({
    action,
    actorId: null, // Would come from req in real usage
    targetType: 'User',
    targetId: [userId],
    ipAddress: '',
    userAgent: ''
  });

  await logEntry.save();

  const existingRole = await Roles.findOne({ userId, roleType: newRoleType });

  if (existingRole && (!oldRoles || !oldRoles.some((r) => r.roleType === newRoleType))) {
    await Roles.deleteOne({ userId, roleType: newRoleType });
  }

  const roleData = { userId, roleType: newRoleType, expiresAt: null };

  if (existingRole) {
    existingRole.expiresAt = null;
    await existingRole.save();
  } else {
    await Roles.create(roleData);
  }

  // Update denormalized field on User for display purposes
  const user = await getUserById(userId);
  if (!Array.isArray(user.roles)) user.roles = [];

  const existingIdx = user.roles.findIndex((r) => r.roleType === newRoleType);
  if (existingIdx >= 0) {
    user.roles[existingIdx].roleType = newRoleType;
  } else {
    user.roles.push({ roleType: newRoleType });
  }

  await user.save();

  const subject =
    action === 'ADMIN_USER_PROMOTE'
      ? 'Your role has been changed by an administrator'
      : 'Your role has been downgraded';
  const text = `Your role on MealPlan has been changed from ${oldRoles?.[0]?.roleType || 'none'} to ${newRoleType}. This change was made by an administrator.`;

  if (user && user.email) {
    try {
      await EmailService.send(user.email, subject, text);
    } catch (emailErr) {
      console.error('[RoleService] Email failed:', emailErr.message);
    }
  }

  return { success: true };
}

/**
 * Ban a user — creates a time-limited or permanent ban role.
 */
async function banUser(userId, durationDays, reason) {
  const isPermanent = durationDays === 0;
  const expiresAt = isPermanent ? null : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  const logEntry = new AuditLog({
    action: 'ADMIN_USER_BAN',
    actorId: null,
    targetType: 'User',
    targetId: [userId],
    ipAddress: '',
    userAgent: ''
  });

  await logEntry.save();

  // Check existing ban — update if exists, or create new
  let existingBan = await Roles.findOne({ userId, roleType: 'banned' });

  const reasonStr = reason || '';
  const subject = isPermanent
    ? '[MealPlan] Permanent Account Ban'
    : '[MealPlan] Temporary Account Restriction';
  const textBody = isPermanent
    ? `Your MealPlan account has been permanently banned.${reasonStr ? '\n\nReason: ' + reasonStr : ''}`
    : `You are temporarily restricted from using MealPlan.\n\nBan ends at: ${new Date(expiresAt).toLocaleString()}\nReason: ${reasonStr || '(none provided)'}\n\nYour data remains intact and will be restored when your ban expires.`;

  if (existingBan && !existingBan.expiresAt) {
    throw new Error('Cannot permanently ban a user that is already permanently banned.');
  } else if (!isPermanent && existingBan && existingBan.expiresAt) {
    // Overwrite existing temporary ban
    const oldExpiresAt = existingBan.expiresAt;
    existingBan.expiresAt = expiresAt;
    existingBan.grantReason = reasonStr || existingBan.grantReason;
    await existingBan.save();

    // Email notification
    if (existingBan.userId && typeof existingBan.userId === 'string') {
      const user = await getUserById(existingBan.userId);
      if (user && user.email) {
        try {
          await EmailService.send(
            user.email,
            '[MealPlan] Your temporary ban has been extended',
            textBody
          );
        } catch (emailErr) {
          console.error('[RoleService] Ban email failed:', emailErr.message);
          // Admin alert fallback — use ADMIN_ALERT_EMAIL env var
          if (process.env.ADMIN_ALERT_EMAIL) {
            await EmailService._sendAdminAlert(
              existingBan.userId,
              'Temporary ban extension on user',
              `Extended temporary ban for ${existingBan.userId} from ${oldExpiresAt.toISOString()} to ${expiresAt.toISOString()}. Reason: ${reasonStr}`
            );
          }
        }
      }
    }

    return { success: true, action: 'ban-updated' };
  } else if (!isPermanent && !existingBan) {
    // Create new temporary ban
    existingBan = await Roles.create({
      userId,
      roleType: 'banned',
      expiresAt,
      grantReason: reasonStr
    });
  } else if (isPermanent && !existingBan) {
    // New permanent ban
    await Roles.create({ userId, roleType: 'banned', expiresAt, grantReason: reasonStr });

    const user = await getUserById(userId);
    if (user && user.email) {
      try {
        await EmailService.send(user.email, subject, textBody);
      } catch (emailErr) {
        console.error('[RoleService] Ban email failed:', emailErr.message);
        // Admin alert fallback
        if (process.env.ADMIN_ALERT_EMAIL) {
          await EmailService._sendAdminAlert(userId, 'Permanent account ban', reasonStr || '');
        }
      }

      return { success: true };
    }
  } else if (!existingBan) {
    throw new Error('User has no existing ban record.');
  }

  // Update denormalized fields on User for fast auth-layer checking
  const user = await getUserById(userId);
  if (user) {
    user.isBanned = true;
    user.banExpiresAt = expiresAt;

    if (!Array.isArray(user.roles)) user.roles = [];
    const banIdx = user.roles.findIndex((r) => r.roleType === 'banned');
    if (banIdx >= 0) {
      user.roles[banIdx].expiresAt = expiresAt;
      user.roles[banIdx].grantReason = reasonStr || existingBan.grantReason;
    } else {
      user.roles.push({ roleType: 'banned', expiresAt, grantReason: reasonStr });
    }

    await user.save();
  }

  return { success: true };
}

/**
 * Revoke a ban from a user.
 */
async function unbanUser(userId) {
  const logEntry = new AuditLog({
    action: 'ADMIN_USER_UNBAN',
    actorId: null,
    targetType: 'User',
    targetId: [userId],
    ipAddress: '',
    userAgent: ''
  });

  await logEntry.save();

  // Check if user has a ban
  const existingBan = await Roles.findOne({ userId, roleType: 'banned' });

  if (!existingBan || !existingBan.expiresAt) {
    throw new Error(
      'Cannot unban a permanently-banned account. Contact support or delete the account.'
    );
  }

  // Update denormalized fields on User — restore access
  const user = await getUserById(userId);
  if (user) {
    user.isBanned = false;
    user.banExpiresAt = null;

    if (!Array.isArray(user.roles)) user.roles = [];
    const banIdx = user.roles.findIndex((r) => r.roleType === 'banned');
    if (banIdx >= 0) {
      user.roles.splice(banIdx, 1);
    }

    await user.save();
  }

  // Remove from Roles collection
  await Roles.deleteOne({ userId, roleType: 'banned' });

  // Send unban email to user
  if (user && user.email) {
    try {
      await EmailService.send(
        user.email,
        '[MealPlan] Your account has been restored',
        'You have been unbanned and can now access MealPlan again.'
      );
    } catch (emailErr) {
      console.error('[RoleService] Unban email failed:', emailErr.message);
      // Admin alert fallback
      if (process.env.ADMIN_ALERT_EMAIL) {
        await EmailService._sendAdminAlert(
          userId,
          'User unbanned',
          `Unbanned ${userId}. Previous ban expired at: ${existingBan.expiresAt.toISOString()}`
        );
      }
    }
  }

  return { success: true };
}

/**
 * Get ban record for a user. Returns null if no ban exists.
 */
async function getBan(userId) {
  const ban = await Roles.findOne({ userId, roleType: 'banned' });
  return ban || null;
}

/**
 * Get all bans for a user (can have multiple overlapping temporary bans).
 */
async function getBans(userId) {
  return Roles.find({ userId, roleType: 'banned' }).sort({ createdAt: -1 });
}

/**
 * Send an admin alert email when user email delivery fails.
 */
async function _sendAdminAlert(targetIdOrEmail, subject, text) {
  const adminRecipient = process.env.ADMIN_ALERT_EMAIL || 'admin@mealplan.local';

  return new Promise((resolve) => {
    if (!process.env.SMTP_HOST) {
      console.warn('[RoleService] Admin alert email skipped — SMTP not configured.');
      resolve({ sent: false, reason: 'SMTP not configured' });
      return;
    }

    const transport = EmailService.init();
    if (!transport) return;

    transport
      .sendMail({ to: adminRecipient, subject, text })
      .then(() => resolve({ sent: true }))
      .catch((err) => {
        console.error(`[RoleService] Admin alert failed: ${err.message}`);
        resolve({ sent: false, reason: err.message });
      });
  });
}

/**
 * Get all roles for a user.
 */
async function getUserRoles(userId) {
  return Roles.find({ userId }).sort({ createdAt: -1 });
}

/**
 * Check if a user has a specific role.
 */
async function hasRole(userId, roleType) {
  const count = await Roles.countDocuments({ userId, roleType });
  return count > 0;
}

/**
 * Get the highest-priority role for a user.
 */
function getCurrentRole(roles) {
  if (!Array.isArray(roles)) return null;
  const priority = { 'super-admin': 3, admin: 2, banned: 1, user: 0 };
  return roles.reduce((best, r) => (priority[r.roleType] > priority[best] ? r : best), null);
}

module.exports = {
  promoteOrDemote,
  banUser,
  unbanUser,
  getBan,
  getBans,
  getUserRoles,
  hasRole,
  getCurrentRole
};
