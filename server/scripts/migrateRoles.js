const mongoose = require('mongoose');
const User = require('../models/User');
const Roles = require('../models/Roles');

/**
 * Comprehensive migration script for user role schema.
 * This script:
 * 1. Adds roles field to all existing users (denormalized for display)
 * 2. Creates Roles collection entries for all users with 'user' role
 * 3. Ensures default super-admin exists if none
 */
async function migrateRoles() {
  console.log('[Migrate] Connecting to MongoDB...');

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('[Migrate] Connected. Starting role migration...');

    // Step 1: Update all existing users with roles field (denormalized)
    const allUsers = await User.find({}, '_id username email').exec();

    for (const user of allUsers) {
      // Update the denormalized roles field for display purposes
      await User.findByIdAndUpdate(
        user._id,
        {
          $set: {
            roles: user.roles || []
          }
        },
        { new: true }
      );
    }

    console.log('[Migrate] All users updated with roles field');

    // Step 2: Assign 'user' role to all existing users in Roles collection
    for (const user of allUsers) {
      let userRole = await Roles.findOne({
        userId: user._id,
        roleType: 'user'
      }).exec();

      if (!userRole) {
        const newUserRole = new Roles({
          userId: user._id,
          roleType: 'user',
          grantedBy: null, // First-time assignment
          grantReason: 'Initial migration from schema to separate Roles collection'
        });
        await newUserRole.save();
      }
    }

    console.log('[Migrate] All users assigned "user" role in Roles collection');

    // Step 3: Create default super-admin if it doesn't exist
    const defaultSuperAdmin = await Roles.findOne({
      roleType: 'super-admin'
    }).exec();

    if (!defaultSuperAdmin) {
      console.log('[Migrate] Creating default super-admin user...');

      // Create a dedicated system user for default super-admin
      const adminUser = new User({
        username: 'system',
        email: 'admin@mealplan.local',
        password: '$2a$10$N9qo8uLOickgx2ZIJZoAeOUjsV3erXIQm6vp9cY.Yj8MhGdJgk7tO' // bcrypt hash of 'admin'
      });

      await adminUser.save();
      console.log('[Migrate] Created super-admin user: system/admin@mealplan.local');

      // Grant super-admin role to this user
      const superAdminRole = new Roles({
        userId: adminUser._id,
        roleType: 'super-admin',
        grantedBy: null, // no one grants the initial super-admin
        grantReason: 'Default system super-admin for initial setup'
      });
      await superAdminRole.save();
      console.log('[Migrate] Granted super-admin role');

      // Grant user role to this user as well
      const userRole = new Roles({
        userId: adminUser._id,
        roleType: 'user',
        grantedBy: null,
        grantReason: 'Default system super-admin also has user role'
      });
      await userRole.save();
      console.log('[Migrate] Granted user role to super-admin');
    } else {
      console.log('[Migrate] Default super-admin already exists');
    }

    // Step 4: Verify counts and output summary
    const adminCount = await Roles.countDocuments({ roleType: 'admin' }).exec();
    const superAdminCount = await Roles.countDocuments({ roleType: 'super-admin' }).exec();
    const userRoleCount = await Roles.countDocuments({ roleType: 'user' }).exec();

    console.log(`[Migrate] Final counts:`);
    console.log(`  - Super-admins: ${superAdminCount}`);
    console.log(`  - Admins: ${adminCount}`);
    console.log(`  - Users: ${userRoleCount}`);

    console.log('[Migrate] Migration completed successfully');
  } catch (error) {
    console.error('[Migrate] Error during migration:', error.message);
    throw error;
  } finally {
    // Connection stays open for API use
  }
}

module.exports = migrateRoles;
