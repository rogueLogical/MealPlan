const mongoose = require('mongoose');
const User = require('../models/User');
const Roles = require('../models/Roles');

/**
 * Initialize default super-admin user on server startup if it doesn't exist.
 * Also ensures all existing users have 'user' role in Roles collection.
 */
async function initRoles() {
  console.log('[Roles Init] Connecting to MongoDB...');

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('[Roles Init] Connected. Initializing roles...');

    // Create default super-admin if doesn't exist
    const defaultSuperAdminExists = await Roles.findOne({
      roleType: 'super-admin'
    }).exec();

    if (!defaultSuperAdminExists) {
      console.log('[Roles Init] Creating default super-admin user...');

      // Create a dedicated system user for default super-admin
      const adminUser = new User({
        username: 'system',
        email: 'admin@mealplan.local',
        password: '$2a$10$N9qo8uLOickgx2ZIJZoAeOUjsV3erXIQm6vp9cY.Yj8MhGdJgk7tO' // bcrypt hash of 'admin' for convenience
      });

      await adminUser.save();
      console.log('[Roles Init] Created super-admin user: system/admin@mealplan.local');

      // Grant super-admin role to this user
      const superAdminRole = new Roles({
        userId: adminUser._id,
        roleType: 'super-admin',
        grantedBy: null, // no one grants the initial super-admin
        grantReason: 'Default system super-admin for initial setup'
      });
      await superAdminRole.save();
      console.log('[Roles Init] Granted super-admin role');

      // Grant user role to this user as well
      const userRole = new Roles({
        userId: adminUser._id,
        roleType: 'user',
        grantedBy: null,
        grantReason: 'Default system super-admin also has user role'
      });
      await userRole.save();
      console.log('[Roles Init] Granted user role to super-admin');
    } else {
      console.log('[Roles Init] Default super-admin already exists');
    }

    // Migrate all existing users to have 'user' role in Roles collection
    const allUsers = await User.find({}, '_id username email').exec();

    for (const user of allUsers) {
      // Check if user already has a role in Roles collection
      let userRole = await Roles.findOne({
        userId: user._id,
        roleType: 'user'
      }).exec();

      if (!userRole) {
        const newUserRole = new Roles({
          userId: user._id,
          roleType: 'user',
          grantedBy: defaultSuperAdminExists?._id || null,
          grantReason: 'Initial role assignment from system setup'
        });
        await newUserRole.save();
      } else {
        // Update grant reason if needed (first-time assignment)
        const existingUser = await User.findById(user._id).select('username email').exec();
        if (existingUser.username === 'system') continue; // skip system user

        console.log(`[Roles Init] User ${user.email} has user role in Roles collection`);
      }
    }

    console.log('[Roles Init] All existing users assigned "user" role');

    const adminCount = await Roles.countDocuments({ roleType: 'admin' }).exec();
    const superAdminCount = await Roles.countDocuments({ roleType: 'super-admin' }).exec();

    console.log(
      `[Roles Init] Final counts - Super-admins: ${superAdminCount}, Admins: ${adminCount}`
    );
  } catch (error) {
    console.error('[Roles Init] Error initializing roles:', error.message);
    throw error;
  } finally {
    // Connection stays open for API use
  }
}

module.exports = initRoles;
