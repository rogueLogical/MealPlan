// models/Ingredient.js

const mongoose = require('mongoose');
const { getDietaryTagsForIngredient } = require('../utils/geminiClient');

const roundTo1Dec = (val) => Math.round(val * 10) / 10;

// Mathematical tagging logic
const applyMacroTags = (serving) => {
  const tags = [];
  const protein = serving.protein || 0;
  const fat = serving.fat || 0;
  const netCarbs = serving.netCarbs || 0;
  const fiber = serving.fiber || 0;
  const calories = serving.calories || 0;

  // Carb Threshold Tagging
  if (netCarbs <= 5) {
    tags.push('Keto');
    tags.push('Low-Carb');
  } else if (netCarbs <= 10) {
    tags.push('Low-Carb');
  }

  // Fiber Tagging
  if (fiber >= 6) {
    tags.push('High-Fiber');
  }

  // Calorie-Ratio Tagging
  if (calories > 0) {
    // High-Protein (>= 30% of calories from protein, and >= 10g of protein)
    if ((protein * 4) / calories >= 0.3 && protein >= 10) {
      tags.push('High-Protein');
    }
    // High-Fat (>= 60% of calories from fat, and >= 15g of fat)
    if ((fat * 9) / calories >= 0.6 && fat >= 15) {
      tags.push('High-Fat');
    }
    // High-Carb (>= 30% of calories from net carbs, and >= 10g of net carbs)
    if ((netCarbs * 4) / calories >= 0.3 && netCarbs > 10) {
      tags.push('High-Carb');
    }
  }

  return tags;
};

const IngredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, lowercase: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    servingSize: { type: Number, required: true, default: 100, min: 1, set: roundTo1Dec },
    servingUnit: { type: String, default: 'g' },

    nutritionPerServing: {
      calories: { type: Number, default: 0, set: (v) => Math.round(v) }, // Calories as whole number
      protein: { type: Number, required: true, default: 0, min: 0, set: roundTo1Dec },
      totalCarbs: { type: Number, required: true, default: 0, min: 0, set: roundTo1Dec },
      fiber: { type: Number, required: true, default: 0, min: 0, set: roundTo1Dec },
      sugarAlcohols: { type: Number, required: true, default: 0, min: 0, set: roundTo1Dec },
      netCarbs: { type: Number, default: 0, set: roundTo1Dec },
      fat: { type: Number, required: true, default: 0, min: 0, set: roundTo1Dec }
    },

    standardAmount: { type: Number, default: 100 },
    standardUnit: { type: String, default: 'g' },
    nutrition: {
      calories: { type: Number, default: 0, set: (v) => Math.round(v) },
      protein: { type: Number, default: 0, set: roundTo1Dec },
      totalCarbs: { type: Number, default: 0, set: roundTo1Dec },
      fiber: { type: Number, default: 0, set: roundTo1Dec },
      sugarAlcohols: { type: Number, default: 0, set: roundTo1Dec },
      netCarbs: { type: Number, default: 0, set: roundTo1Dec },
      fat: { type: Number, default: 0, set: roundTo1Dec }
    },

    tags: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

IngredientSchema.index({ name: 'text' });
IngredientSchema.index({ tags: 1 });

// Auto-calculate Net Carbs, Calories, 100g Baselines, and Apply Semantic + Math Tags
IngredientSchema.pre('save', async function () {
  const serving = this.nutritionPerServing;

  // Calculate Net Carbs for the serving
  const calculatedNet = serving.totalCarbs - serving.fiber - serving.sugarAlcohols;
  serving.netCarbs = calculatedNet < 0 ? 0 : roundTo1Dec(calculatedNet);

  // Calculate Calories
  serving.calories = Math.round(serving.protein * 4 + serving.netCarbs * 4 + serving.fat * 9);

  // Calculate the 100g standardized baseline
  const multiplier = 100 / this.servingSize;

  const normalize = (val) => Math.round(val * multiplier * 10) / 10;

  this.nutrition = {
    calories: Math.round(serving.calories * multiplier),
    protein: normalize(serving.protein),
    totalCarbs: normalize(serving.totalCarbs),
    fiber: normalize(serving.fiber),
    sugarAlcohols: normalize(serving.sugarAlcohols),
    netCarbs: normalize(serving.netCarbs),
    fat: normalize(serving.fat)
  };

  // Tagging logic applied universally on initial creation
  if (this.isNew) {
    // Calculate and apply mathematical macro tags
    const mathTags = applyMacroTags(serving);
    const userTags = this.tags || [];
    let combinedTags = [...new Set([...userTags, ...mathTags])];

    // Fetch and apply AI semantic tags
    try {
      const aiTags = await getDietaryTagsForIngredient(this.name);
      if (aiTags && aiTags.length > 0) {
        combinedTags = [...new Set([...combinedTags, ...aiTags])];
      }
    } catch (err) {
      console.warn(
        `[AI Tagger Middleware] Failed to auto-tag new ingredient "${this.name}". ` +
          `Saving document with manual/math tags only. Error: ${err.message}`
      );
    }

    this.tags = combinedTags;
  }
});

module.exports = mongoose.model('Ingredient', IngredientSchema);
