const Ingredient = require('../models/Ingredient');
const seedData = require('../data/ingredient_foundation_seed.json');

const THRESHOLD = 50; // The minimum number of ingredients required in the DB

const seedIngredients = async () => {
  try {
    // Purge any corrupted zero-macro ingredient records created by previous lookup glitches
    const zeroPurgeResult = await Ingredient.deleteMany({
      'nutritionPerServing.protein': 0,
      'nutritionPerServing.fat': 0,
      'nutritionPerServing.totalCarbs': 0,
      'nutritionPerServing.netCarbs': 0,
      name: {
        $nin: [
          'water',
          'tap water',
          'distilled water',
          'drinking water',
          'sparkling water',
          'ice',
          'ice cubes',
          'club soda',
          'seltzer'
        ]
      }
    });

    if (zeroPurgeResult && zeroPurgeResult.deletedCount > 0) {
      console.log(
        `[Seeder] Cleaned up ${zeroPurgeResult.deletedCount} corrupted zero-macro ingredients from database.`
      );
    }

    // Check current database ingredients
    const count = await Ingredient.countDocuments();

    if (count >= THRESHOLD) {
      console.log(`[Seeder] DB has ${count} ingredients. Skipping seed process.`);
      return;
    }

    console.log(
      `[Seeder] Ingredient count (${count}) is below threshold (${THRESHOLD}). Initiating seed...`
    );

    let addedCount = 0;

    for (const item of seedData) {
      try {
        // Explicitly leave createdBy as undefined/null so these are recognized as "System" ingredients
        const newIngredient = new Ingredient(item);
        await newIngredient.save();
        addedCount++;
      } catch (err) {
        // Catch duplicate key errors gracefully in case some of the seed data already exists
        if (err.code === 11000) {
          console.log(`[Seeder] Skipping "${item.name}" - already exists in DB.`);
        } else {
          console.error(`[Seeder] Error saving "${item.name}":`, err.message);
        }
      }
    }

    console.log(`[Seeder] Successfully imported ${addedCount} base ingredients.`);
  } catch (error) {
    console.error('[Seeder] Fatal error during ingredient initialization:', error);
  }
};

module.exports = { seedIngredients };
