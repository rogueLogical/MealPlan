/**
 * Migration Registry — separates startup concerns from route mounting.
 * Server.js only mounts routes; this module handles one-time migrations.
 */

const migrateRoles = require('./migrateRoles');
const { seedIngredients } = require('../utils/ingredient-seeder');

async function registerMigrations() {
  try {
    await migrateRoles();
    console.log('[Migration] Roles initialized successfully');
  } catch (err) {
    console.error('[Migration] Roles init failed:', err.message);
  }

  try {
    await seedIngredients();
    console.log('[Migration] Ingredients seeded successfully');
  } catch (err) {
    console.error('[Migration] Ingredient seeding failed:', err.message);
  }
}

module.exports = registerMigrations;
