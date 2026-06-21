const mongoose = require('mongoose');

const roundTo1Dec = (val) => Math.round(val * 10) / 10;

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

// Auto-calculate Net Carbs, Calories, and 100g Baselines
IngredientSchema.pre('save', function () {
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
});

module.exports = mongoose.model('Ingredient', IngredientSchema);
