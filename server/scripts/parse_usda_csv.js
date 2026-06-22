const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const FOOD_CSV = path.join(__dirname, '../data/usda/food.csv');
const PORTION_CSV = path.join(__dirname, '../data/usda/food_portion.csv'); // NEW
const NUTRIENT_CSV = path.join(__dirname, '../data/usda/food_nutrient.csv');
const OUTPUT_JSON = path.join(__dirname, '../data/ingredient_foundation_seed.json');

const NUTRIENTS = {
  PROTEIN: 1003,
  FAT: 1004,
  CARBS: 1005,
  FIBER: 1079
};

const foundationFoods = new Map();

// Pure Math Logic for Tagging
const applyMacroTags = (nutrition) => {
  const tags = [];
  const { protein, fat, netCarbs, fiber } = nutrition;
  const totalCalories = protein * 4 + netCarbs * 4 + fat * 9;

  if (netCarbs <= 5) {
    tags.push('Keto');
    tags.push('Low-Carb');
  } else if (netCarbs <= 10) {
    tags.push('Low-Carb');
  }

  if (fiber >= 6) tags.push('High-Fiber');

  if (totalCalories > 0) {
    if ((protein * 4) / totalCalories >= 0.3 && protein >= 10) tags.push('High-Protein');
    if ((fat * 9) / totalCalories >= 0.6 && fat >= 15) tags.push('High-Fat');
    if ((netCarbs * 4) / totalCalories >= 0.3 && netCarbs > 10) tags.push('High-Carb');
  }

  return tags;
};

// Phase 1: Isolate Foundation Foods
const parseFoods = () => {
  return new Promise((resolve, reject) => {
    console.log('Phase 1: Streaming food.csv...');
    fs.createReadStream(FOOD_CSV)
      .pipe(csv())
      .on('data', (row) => {
        const fdcId = parseInt(row.fdc_id?.trim(), 10);

        if (!isNaN(fdcId) && row.data_type === 'foundation_food') {
          foundationFoods.set(fdcId, {
            name: row.description.toLowerCase(),
            servingSize: 100, // Default if no portion is found
            servingUnit: 'g',
            _hasPortion: false,
            _raw100g: { protein: 0, fat: 0, totalCarbs: 0, fiber: 0 }, // Temp holding object
            nutritionPerServing: {},
            tags: []
          });
        }
      })
      .on('end', () => resolve())
      .on('error', reject);
  });
};

// Phase 1.5: Map Real-World Serving Sizes & Purge Unknowns
const parsePortions = () => {
  return new Promise((resolve, reject) => {
    console.log('Phase 1.5: Streaming food_portion.csv to find serving sizes...');
    fs.createReadStream(PORTION_CSV)
      .pipe(csv())
      .on('data', (row) => {
        const fdcId = parseInt(row.fdc_id?.trim(), 10);

        if (foundationFoods.has(fdcId)) {
          const food = foundationFoods.get(fdcId);

          // Only grab the first portion seen
          if (!food._hasPortion) {
            const gramWeight = parseFloat(row.gram_weight);
            if (gramWeight > 0) {
              food.servingSize = gramWeight;
              food._hasPortion = true;
            }
          }
        }
      })
      .on('end', () => {
        let removedCount = 0;

        // Aggressively purge any food that never received a portion size
        foundationFoods.forEach((food, id) => {
          if (!food._hasPortion) {
            foundationFoods.delete(id);
            removedCount++;
          }
        });

        console.log(`Phase 1.5 Complete: Mapped serving sizes.`);
        console.log(
          `Discarded ${removedCount} foods that lacked a reliable serving size. ${foundationFoods.size} foods remaining.`
        );
        resolve();
      })
      .on('error', reject);
  });
};

// Phase 2: Map Nutrients
const parseNutrients = () => {
  return new Promise((resolve, reject) => {
    console.log('Phase 2: Streaming food_nutrient.csv...');
    fs.createReadStream(NUTRIENT_CSV)
      .pipe(csv())
      .on('data', (row) => {
        const fdcId = parseInt(row.fdc_id?.trim(), 10);
        const nutrientId = parseInt(row.nutrient_id?.trim(), 10);
        const amount = parseFloat(row.amount) || 0;

        if (foundationFoods.has(fdcId)) {
          const food = foundationFoods.get(fdcId);

          // Save the USDA data to the 100g temp object
          switch (nutrientId) {
            case NUTRIENTS.PROTEIN:
              food._raw100g.protein = Math.max(food._raw100g.protein, amount);
              break;
            case NUTRIENTS.FAT:
              food._raw100g.fat = Math.max(food._raw100g.fat, amount);
              break;
            case NUTRIENTS.CARBS:
              food._raw100g.totalCarbs = Math.max(food._raw100g.totalCarbs, amount);
              break;
            case NUTRIENTS.FIBER:
              food._raw100g.fiber = Math.max(food._raw100g.fiber, amount);
              break;
          }
        }
      })
      .on('end', () => resolve())
      .on('error', reject);
  });
};

// Phase 3: Scale Data, Apply Math, Export
const compileAndExport = () => {
  console.log('Phase 3: Tagging, and exporting...');

  const finalOutput = [];

  foundationFoods.forEach((food) => {
    const raw = food._raw100g;

    // Discard any entries with 0 total macros
    if (raw.protein === 0 && raw.fat === 0 && raw.totalCarbs === 0) return;

    // Helper to round numbers to 1 decimal point
    const roundTo1Dec = (val) => Math.round(val * 10) / 10;

    // Populate the actual nutritionPerServing object
    food.nutritionPerServing = {
      protein: roundTo1Dec(raw.protein),
      fat: roundTo1Dec(raw.fat),
      totalCarbs: roundTo1Dec(raw.totalCarbs),
      fiber: roundTo1Dec(raw.fiber),
      sugarAlcohols: 0 // USDA data doesn't include this
    };

    // Calculate Net Carbs on the data
    const calculatedNet = food.nutritionPerServing.totalCarbs - food.nutritionPerServing.fiber;
    food.nutritionPerServing.netCarbs = calculatedNet < 0 ? 0 : roundTo1Dec(calculatedNet);

    // Apply Rule-Based Tags
    food.tags = applyMacroTags(food.nutritionPerServing);

    // Clean up temp variables
    delete food._raw100g;
    delete food._hasPortion;

    finalOutput.push(food);
  });

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(finalOutput, null, 2));
  console.log(`Success! Exported ${finalOutput.length} accurate ingredients to ${OUTPUT_JSON}`);
};

const run = async () => {
  try {
    await parseFoods();
    await parsePortions();
    await parseNutrients();
    compileAndExport();
  } catch (err) {
    console.error('Pipeline failed:', err);
  }
};

run();
