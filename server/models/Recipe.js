const mongoose = require('mongoose');

const roundTo1Dec = (val) => Math.round(val * 10) / 10;

// Subdocument schema for the immutable ingredient snapshot
const RecipeIngredientSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  name: { type: String, required: true },

  // The absolute truth used for macro calculation
  weightInGrams: { type: Number, required: true, min: 1 },

  // Optional human-readable fields for the recipe instructions (e.g., "1", "Cup")
  displayAmount: { type: Number, default: null },
  displayUnit: { type: String, default: '', trim: true },

  // The absolute macros for the specific weightInGrams used in this recipe
  nutrition: {
    calories: { type: Number, default: 0, set: (v) => Math.round(v) },
    protein: { type: Number, default: 0, set: roundTo1Dec },
    totalCarbs: { type: Number, default: 0, set: roundTo1Dec },
    fiber: { type: Number, default: 0, set: roundTo1Dec },
    sugarAlcohols: { type: Number, default: 0, set: roundTo1Dec },
    netCarbs: { type: Number, default: 0, set: roundTo1Dec },
    fat: { type: Number, default: 0, set: roundTo1Dec }
  }
});

const RecipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    instructions: { type: String, trim: true },

    // Metadata
    prepTimeMinutes: { type: Number, default: 0 },
    cookTimeMinutes: { type: Number, default: 0 },
    imageUrl: { type: String, default: '' },

    // Access & Lifecycle Control
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPublic: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false }, // Soft Delete Flag
    originalRecipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', default: null }, // For forked recipes

    // Core Data
    portions: { type: Number, required: true, default: 1, min: 1 },
    tags: [{ type: String, trim: true }],
    ingredients: [RecipeIngredientSchema],

    // Auto-Calculated Totals (Entire Recipe Yield)
    totalNutrition: {
      calories: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      totalCarbs: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 },
      sugarAlcohols: { type: Number, default: 0 },
      netCarbs: { type: Number, default: 0 },
      fat: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

// Indexes for high-performance searching
RecipeSchema.index({ title: 'text', description: 'text' });
RecipeSchema.index({ tags: 1 });
RecipeSchema.index({ createdBy: 1 });

// Pre-save hook to calculate the total macros for the entire recipe
RecipeSchema.pre('save', function () {
  let totals = {
    calories: 0,
    protein: 0,
    totalCarbs: 0,
    fiber: 0,
    sugarAlcohols: 0,
    netCarbs: 0,
    fat: 0
  };

  if (this.ingredients && this.ingredients.length > 0) {
    this.ingredients.forEach((item) => {
      totals.calories += item.nutrition.calories || 0;
      totals.protein += item.nutrition.protein || 0;
      totals.totalCarbs += item.nutrition.totalCarbs || 0;
      totals.fiber += item.nutrition.fiber || 0;
      totals.sugarAlcohols += item.nutrition.sugarAlcohols || 0;
      totals.fat += item.nutrition.fat || 0;
    });

    // Calculate overall net carbs mathematically rather than trusting individual item sums
    const calculatedNet = totals.totalCarbs - totals.fiber - totals.sugarAlcohols;
    totals.netCarbs = calculatedNet < 0 ? 0 : calculatedNet;
  }

  // Round off the final totals
  this.totalNutrition = {
    calories: Math.round(totals.calories),
    protein: roundTo1Dec(totals.protein),
    totalCarbs: roundTo1Dec(totals.totalCarbs),
    fiber: roundTo1Dec(totals.fiber),
    sugarAlcohols: roundTo1Dec(totals.sugarAlcohols),
    netCarbs: roundTo1Dec(totals.netCarbs),
    fat: roundTo1Dec(totals.fat)
  };
});

module.exports = mongoose.model('Recipe', RecipeSchema);
