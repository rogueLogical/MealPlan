const mongoose = require('mongoose');

const IngredientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    // Standardizing to 100g makes math easy for the frontend
    standardAmount: { type: Number, default: 100 },
    standardUnit: { type: String, default: 'g' },

    // Macros per 100g (in g)
    nutrition: {
      calories: { type: Number, required: true, default: 0, min: 0 },
      protein: { type: Number, required: true, default: 0, min: 0 },
      totalCarbs: { type: Number, required: true, default: 0, min: 0 },
      fiber: { type: Number, required: true, default: 0, min: 0 },
      sugarAlcohols: { type: Number, required: true, default: 0, min: 0 },
      netCarbs: { type: Number, default: 0, min: 0 },
      fat: { type: Number, required: true, default: 0, min: 0 }
    },

    tags: [{ type: String, trim: true }]
  },
  {
    timestamps: true
  }
);

// Indexing for faster text search when users query the database
IngredientSchema.index({ name: 'text' });
IngredientSchema.index({ tags: 1 });

// Auto-calculate Net Carbs before saving to the database
IngredientSchema.pre('save', function () {
  // Check if any of the carb-related fields were modified
  if (
    this.isModified('nutrition.totalCarbs') ||
    this.isModified('nutrition.fiber') ||
    this.isModified('nutrition.sugarAlcohols')
  ) {
    const calculatedNet =
      this.nutrition.totalCarbs - this.nutrition.fiber - this.nutrition.sugarAlcohols;

    // Prevent negative net carbs in case of bad user input
    this.nutrition.netCarbs = calculatedNet < 0 ? 0 : calculatedNet;
  }
});

module.exports = mongoose.model('Ingredient', IngredientSchema);
