const mongoose = require('mongoose');

const roundTo1Dec = (val) => Math.round(val * 10) / 10;

const MacroSchema = new mongoose.Schema(
  {
    calories: { type: Number, default: 0, set: (v) => Math.round(v) },
    protein: { type: Number, default: 0, set: roundTo1Dec },
    totalCarbs: { type: Number, default: 0, set: roundTo1Dec },
    fiber: { type: Number, default: 0, set: roundTo1Dec },
    sugarAlcohols: { type: Number, default: 0, set: roundTo1Dec },
    netCarbs: { type: Number, default: 0, set: roundTo1Dec },
    fat: { type: Number, default: 0, set: roundTo1Dec }
  },
  { _id: false }
);

// Subdocument schema for the immutable ingredient snapshot
const RecipeIngredientSchema = new mongoose.Schema(
  {
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: false },
    name: { type: String, required: true },

    // The absolute truth used for macro calculation
    weightInGrams: { type: Number, required: true, min: 1 },

    // Optional human-readable fields for the recipe instructions (e.g., "1", "Cup")
    displayAmount: { type: Number, default: null },
    displayUnit: { type: String, default: '', trim: true },

    // The absolute macros for the specific weightInGrams used in this recipe
    nutrition: { type: MacroSchema, required: true }
  },
  { _id: false }
);

const RecipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    recipeType: {
      type: String,
      enum: ['Meal', 'Snack'],
      required: true,
      default: 'Meal'
    },
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
    ingredients: {
      type: [RecipeIngredientSchema],
      validate: [
        (v) => Array.isArray(v) && v.length > 0,
        'A recipe must have at least one ingredient'
      ]
    },

    // Auto-Calculated Totals (Entire Recipe Yield)
    totalNutrition: { type: MacroSchema }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for high-performance searching
RecipeSchema.index({ title: 'text', description: 'text' });
RecipeSchema.index({ tags: 1 });
RecipeSchema.index({ createdBy: 1 });

// --- Virtual Properties ---
RecipeSchema.virtual('nutritionPerPortion').get(function () {
  const portions = this.portions || 1;

  // If totalNutrition hasn't been calculated yet, return zeroes
  if (!this.totalNutrition) {
    return {
      calories: 0,
      protein: 0,
      totalCarbs: 0,
      fiber: 0,
      sugarAlcohols: 0,
      netCarbs: 0,
      fat: 0
    };
  }

  return {
    calories: Math.round(this.totalNutrition.calories / portions),
    protein: roundTo1Dec(this.totalNutrition.protein / portions),
    totalCarbs: roundTo1Dec(this.totalNutrition.totalCarbs / portions),
    fiber: roundTo1Dec(this.totalNutrition.fiber / portions),
    sugarAlcohols: roundTo1Dec(this.totalNutrition.sugarAlcohols / portions),
    netCarbs: roundTo1Dec(this.totalNutrition.netCarbs / portions),
    fat: roundTo1Dec(this.totalNutrition.fat / portions)
  };
});

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
