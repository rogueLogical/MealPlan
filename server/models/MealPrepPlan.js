const mongoose = require('mongoose');

const PlannedRecipeSchema = new mongoose.Schema(
  {
    recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: true },
    plannedPortions: { type: Number, required: true, min: 1 },
    isCompleted: { type: Boolean, default: false }
  },
  { _id: false }
);

const MealPrepPlanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    recipes: [PlannedRecipeSchema]
  },
  { timestamps: true }
);

MealPrepPlanSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('MealPrepPlan', MealPrepPlanSchema);
