/**
 * Migration Registry — separates startup concerns from route mounting.
 * Server.js only mounts routes; this module handles one-time migrations.
 */

const runMigrations = require('./runMigrations');
const { seedIngredients } = require('../utils/ingredient-seeder');

async function registerMigrations() {
  // Only run migrations if MONGO_URI is available
  try {
    if (process.env.MONGO_URI) {
      await runMigrations();
      console.log('[Migration] All migrations completed successfully');
    } else {
      console.log('[Migration] Skipping — MONGO_URI not set');
    }
  } catch (err) {
    console.error('[Migration] Migration failed:', err.message);
  }

  // Always seed ingredients regardless of DB state
  try {
    await seedIngredients();
    console.log('[Migration] Ingredients seeded successfully');
  } catch (err) {
    console.error('[Migration] Ingredient seeding failed:', err.message);
  }
}

module.exports = registerMigrations;
