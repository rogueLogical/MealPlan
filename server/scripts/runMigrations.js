/**
 * Consolidated migration script combining:
 * - migrateRoles.js functionality (create super-admin, assign user roles)
 * - migrateUserRoleSchema.js functionality (add denormalized roles field)
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Roles = require('../models/Roles');

// Logger helper for consistent output across dry-run/live modes
function log(message) {
  const prefix = process.env.NODE_ENV === 'test' ? '[Migrations]' : `[Migrations]`;
  console.log(prefix, message);
}

/**
 * Connect to MongoDB and load models
 */
async function connect() {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  log('Connected to MongoDB');
}

/**
 * Ensure default super-admin user exists
 * Creates system/admin@mealplan.local with password 'admin' if no super-admin exists
 */
async function ensureDefaultSuperAdmin() {
  const existingSuperAdmin = await Roles.findOne({ roleType: 'super-admin' });

  if (existingSuperAdmin) {
    log('Default super-admin already exists');
    return;
  }

  const adminUser = new User({
    username: 'system',
    email: 'admin@mealplan.local',
    password: '$2a$10$N9qo8uLOickgx2ZIJZoAeOUjsV3erXIQm6vp9cY.Yj8MhGdJgk7tO' // bcrypt hash of 'admin'
  });

  await adminUser.save();
  log('Created default super-admin user: system/admin@mealplan.local');

  const superAdminRole = new Roles({
    userId: adminUser._id,
    roleType: 'super-admin',
    grantedBy: null, // no one grants the initial super-admin
    grantReason: 'Default system super-admin for initial setup'
  });
  await superAdminRole.save();
  log('Granted super-admin role to system user');

  const userRole = new Roles({
    userId: adminUser._id,
    roleType: 'user',
    grantedBy: null,
    grantReason: 'Default system super-admin also has user role'
  });
  await userRole.save();
  log('Granted user role to system user');
}

/**
 * Assign 'user' role to all existing users in Roles collection
 */
async function assignUserRoleToAll() {
  const allUsers = await User.find({}, '_id').exec();

  for (const user of allUsers) {
    let userRole = await Roles.findOne({ userId: user._id, roleType: 'user' }).exec();

    if (!userRole) {
      const newUserRole = new Roles({
        userId: user._id,
        roleType: 'user',
        grantedBy: null, // First-time assignment
        grantReason: 'Initial migration from schema to separate Roles collection'
      });
      await newUserRole.save();
    } else {
      log(`User ${user.email} already has user role`);
    }
  }

  log('All users assigned "user" role in Roles collection');
}

/**
 * Add denormalized roles field to existing User models for display performance
 */
async function addRolesFieldToExistingUsers() {
  const allUsers = await User.find({}, '_id username email roles').exec();

  let updatedCount = 0;
  for (const user of allUsers) {
    await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          roles: user.roles || []
        }
      },
      { returnDocument: 'after' }
    );
    updatedCount++;
  }

  log(`${updatedCount} users updated with denormalized roles field`);
}

/**
 * Dry-run mode flag
 */
const isDryRun = process.argv.includes('--dry-run');

/**
 * Main migration function
 */
async function runMigrations() {
  if (isDryRun) {
    log('=== DRY RUN MODE ===');
    log('The following operations WOULD be performed:');
    log('1. Ensure default super-admin exists');
    log('2. Assign user role to all existing users');
    log('3. Add denormalized roles field to User models');
    return;
  }

  try {
    await connect();

    if (!isDryRun) {
      await ensureDefaultSuperAdmin();
      await assignUserRoleToAll();
      await addRolesFieldToExistingUsers();
    }

    log('All migrations completed successfully');
  } catch (error) {
    console.error('[Migrations] Error during migration:', error.message);
    throw error;
  } finally {
    // Connection stays open for API use in dry-run mode
  }
}

// Export for use in registerMigrations.js and standalone execution
module.exports = runMigrations;
