const mongoose = require('mongoose');

const ShoppingListItemSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', default: null },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 }, // Stores displayAmount if present, otherwise weightInGrams
  unit: { type: String, default: 'g' }, // Stores displayUnit if present, otherwise 'g'
  weightInGrams: { type: Number, default: null },
  isChecked: { type: Boolean, default: false },
  orderIndex: { type: Number, default: 0 }
});

const ShoppingListSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'MealPrepPlan', default: null },
    items: [ShoppingListItemSchema]
  },
  { timestamps: true }
);

ShoppingListSchema.index({ userId: 1 });

module.exports = mongoose.model('ShoppingList', ShoppingListSchema);
