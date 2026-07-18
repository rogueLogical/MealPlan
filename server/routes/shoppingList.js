const express = require('express');
const router = express.Router();
const ShoppingList = require('../models/ShoppingList');
const checkAuth = require('../middleware/auth');
const MealPrepPlan = require('../models/MealPrepPlan');

// GET /api/shopping-list - Fetch shopping list
router.get('/', checkAuth, async (req, res) => {
  try {
    let list = await ShoppingList.findOne({ userId: req.userData.userId });
    if (!list) {
      list = new ShoppingList({ userId: req.userData.userId, items: [] });
      await list.save();
    }
    res.status(200).json({ list });
  } catch (err) {
    console.error('Fetch Shopping List Error:', err);
    res.status(500).json({ message: 'Failed to fetch shopping list.' });
  }
});

// PUT /api/shopping-list - Update entire shopping list
router.put('/', checkAuth, async (req, res) => {
  try {
    const { items, planId } = req.body;
    let list = await ShoppingList.findOne({ userId: req.userData.userId });

    if (!list) {
      list = new ShoppingList({ userId: req.userData.userId });
    }

    list.planId = planId || list.planId;

    list.items = items.map((item, index) => ({
      _id: item._id || undefined,
      ingredientId: item.ingredientId || null,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit || 'g',
      weightInGrams: item.weightInGrams !== undefined ? item.weightInGrams : null,
      isChecked: item.isChecked || false,
      orderIndex: item.orderIndex !== undefined ? item.orderIndex : index
    }));

    await list.save();
    res.status(200).json({ message: 'Shopping list updated successfully.', list });
  } catch (err) {
    console.error('Update Shopping List Error:', err);
    res.status(500).json({ message: 'Failed to update shopping list.' });
  }
});

// PATCH /api/shopping-list/item/:itemId - Check / Uncheck item
router.patch('/item/:itemId', checkAuth, async (req, res) => {
  try {
    const { isChecked } = req.body;
    const list = await ShoppingList.findOne({ userId: req.userData.userId });

    if (!list) {
      return res.status(404).json({ message: 'Shopping list not found.' });
    }

    const item = list.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    item.isChecked = isChecked;

    // Forces Mongoose to serialize and write the subdocument change to MongoDB
    list.markModified('items');
    await list.save();

    res.status(200).json({ message: 'Item checked state updated.', list });
  } catch (err) {
    console.error('Check Item Error:', err);
    res.status(500).json({ message: 'Failed to update item checked status.' });
  }
});

// POST /api/shopping-list/append-plan - Consolidate and append plan's ingredients
router.post('/append-plan', checkAuth, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await MealPrepPlan.findById(planId).populate('recipes.recipeId');
    if (!plan) return res.status(404).json({ message: 'Meal plan not found.' });
    if (plan.userId.toString() !== req.userData.userId) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    let list = await ShoppingList.findOne({ userId: req.userData.userId });
    if (!list) {
      list = new ShoppingList({ userId: req.userData.userId, items: [] });
    }

    // Determine the baseline starting index for newly appended items
    let maxOrderIndex =
      list.items.length > 0 ? Math.max(...list.items.map((i) => i.orderIndex || 0)) : -1;

    plan.recipes.forEach((pr) => {
      const recipe = pr.recipeId;
      if (!recipe) return;

      const multiplier = pr.plannedPortions / (recipe.portions || 1);

      recipe.ingredients.forEach((ing) => {
        const ingIdStr = ing.ingredientId ? ing.ingredientId.toString() : null;
        const ingUnit = (ing.displayUnit || 'g').toLowerCase().trim();
        const ingNameNormalized = ing.name.toLowerCase().trim();

        const scaledWeight = ing.weightInGrams * multiplier;
        const hasAmount = ing.displayAmount !== undefined && ing.displayAmount !== null;
        const scaledAmount = hasAmount ? ing.displayAmount * multiplier : 0;

        // Search for an existing match in the shopping list (matching by ingredientId/name + unit)
        const existingItem = list.items.find((item) => {
          const itemUnit = (item.unit || 'g').toLowerCase().trim();
          if (itemUnit !== ingUnit) return false;

          if (ingIdStr && item.ingredientId) {
            return item.ingredientId.toString() === ingIdStr;
          }
          return item.name.toLowerCase().trim() === ingNameNormalized;
        });

        if (existingItem) {
          if (existingItem.isChecked === false) {
            // Unchecked: Add the new amount to the previous amount
            existingItem.quantity += hasAmount ? scaledAmount : scaledWeight;
            if (existingItem.weightInGrams !== null) {
              existingItem.weightInGrams += scaledWeight;
            } else {
              existingItem.weightInGrams = scaledWeight;
            }
          } else {
            // Checked: Replace the old amount, update weight, and uncheck
            existingItem.quantity = hasAmount ? scaledAmount : scaledWeight;
            existingItem.weightInGrams = scaledWeight;
            existingItem.isChecked = false;
          }
        } else {
          // No Match: Append as a new item to the bottom of the list
          maxOrderIndex++;
          list.items.push({
            ingredientId: ing.ingredientId || null,
            name: ing.name,
            quantity: hasAmount ? scaledAmount : scaledWeight,
            unit: ing.displayUnit || 'g',
            weightInGrams: scaledWeight,
            isChecked: false,
            orderIndex: maxOrderIndex
          });
        }
      });
    });

    await list.save();
    res.status(200).json({ message: 'Ingredients appended to shopping list.', list });
  } catch (err) {
    console.error('Append Plan to List Error:', err);
    res.status(500).json({ message: 'Failed to append plan ingredients.' });
  }
});

// POST /api/shopping-list/item - Add manual custom item
router.post('/item', checkAuth, async (req, res) => {
  try {
    const { name, quantity, unit } = req.body;
    let list = await ShoppingList.findOne({ userId: req.userData.userId });

    if (!list) {
      list = new ShoppingList({ userId: req.userData.userId, items: [] });
    }

    const maxOrderIndex =
      list.items.length > 0 ? Math.max(...list.items.map((i) => i.orderIndex || 0)) : -1;

    list.items.push({
      name,
      quantity: quantity || 1,
      unit: unit || 'pieces',
      isChecked: false,
      orderIndex: maxOrderIndex + 1
    });

    await list.save();
    res.status(201).json({ message: 'Item added.', list });
  } catch (err) {
    console.error('Add Item Error:', err);
    res.status(500).json({ message: 'Failed to add item.' });
  }
});

// DELETE /api/shopping-list/item/:itemId - Remove item
router.delete('/item/:itemId', checkAuth, async (req, res) => {
  try {
    const list = await ShoppingList.findOne({ userId: req.userData.userId });
    if (!list) return res.status(404).json({ message: 'Shopping list not found.' });

    list.items.pull(req.params.itemId);
    await list.save();

    res.status(200).json({ message: 'Item removed.', list });
  } catch (err) {
    console.error('Remove Item Error:', err);
    res.status(500).json({ message: 'Failed to remove item.' });
  }
});

module.exports = router;
