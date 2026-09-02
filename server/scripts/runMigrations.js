/**
 * Standalone migration runner for role schema migration.
 * Run with: node server/scripts/runMigrations.js
 */

const mongoose = require('mongoose');

async function runMigrations() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meandb';

  console.log('[Migration Runner] Starting role schema migration...');

  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('[Migration Runner] Connected to database');

    const migrateRoles = require('./migrateRoles');
    await migrateRoles();

    console.log('[Migration Runner] Migration completed successfully');
  } catch (error) {
    console.error('[Migration Runner] Migration failed:', error.message);
    process.exit(1);
  } finally {
    mongoose.connection.close();
    console.log('[Migration Runner] Database connection closed');
  }
}

runMigrations().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
