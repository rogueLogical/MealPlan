const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Migrate existing users to include the roles field in their schema.
 * This updates the denormalized roles field for display purposes
 * while keeping Roles collection as authoritative source.
 */
async function migrateUserRoleSchema() {
  console.log('[Migrate] Connecting to MongoDB...');

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('[Migrate] Connected. Migrating users...');

    const allUsers = await User.find({}, '_id username email roles').exec();

    let migratedCount = 0;
    for (const user of allUsers) {
      // Update the denormalized roles field for display
      // Keep existing roles if they exist, otherwise start empty
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          $set: {
            roles: user.roles || []
          }
        },
        { returnDocument: 'after' }
      );

      if (updatedUser) {
        migratedCount++;
      }
    }

    console.log(`[Migrate] Successfully updated ${migratedCount} users with roles field`);
  } catch (error) {
    console.error('[Migrate] Error migrating user roles:', error.message);
    throw error;
  } finally {
    // Connection stays open for API use
  }
}

module.exports = migrateUserRoleSchema;
