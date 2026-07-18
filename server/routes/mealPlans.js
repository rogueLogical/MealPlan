const express = require('express');
const router = express.Router();
const MealPrepPlan = require('../models/MealPrepPlan');
const PortionStorage = require('../models/PortionStorage');
const Recipe = require('../models/Recipe');
const checkAuth = require('../middleware/auth');

// GET /api/meal-plans - Fetch all plans for the user (Active and Inactive, ordered by recency)
router.get('/', checkAuth, async (req, res) => {
  try {
    const plans = await MealPrepPlan.find({ userId: req.userData.userId })
      .sort({ updatedAt: -1 })
      .populate('recipes.recipeId');

    res.status(200).json({ plans });
  } catch (err) {
    console.error('Fetch Plans Error:', err);
    res.status(500).json({ message: 'Failed to fetch meal prep plans.' });
  }
});

// GET /api/meal-plans/active - Retrieve current active plan (retained for backward compatibility)
router.get('/active', checkAuth, async (req, res) => {
  try {
    const activePlan = await MealPrepPlan.findOne({
      userId: req.userData.userId,
      isActive: true
    }).populate('recipes.recipeId');

    res.status(200).json({ plan: activePlan });
  } catch (err) {
    console.error('Fetch Active Plan Error:', err);
    res.status(500).json({ message: 'Failed to fetch active plan.' });
  }
});

// POST /api/meal-plans - Create a new plan (allows setting as inactive or active)
router.post('/', checkAuth, async (req, res) => {
  try {
    const { name, recipes, isActive = false } = req.body;

    if (isActive) {
      // Deactivate other existing plans
      await MealPrepPlan.updateMany(
        { userId: req.userData.userId, isActive: true },
        { $set: { isActive: false } }
      );
    }

    const newPlan = new MealPrepPlan({
      userId: req.userData.userId,
      name: name || 'My Meal Prep Plan',
      isActive: isActive,
      recipes: recipes.map((r) => ({
        recipeId: r.recipeId,
        plannedPortions: r.plannedPortions,
        isCompleted: false
      }))
    });

    await newPlan.save();
    res.status(201).json({ message: 'Meal Prep Plan created successfully.', plan: newPlan });
  } catch (err) {
    console.error('Create Plan Error:', err);
    res.status(500).json({ message: 'Failed to create plan.' });
  }
});

// PUT /api/meal-plans/:id - Update plan
router.put('/:id', checkAuth, async (req, res) => {
  try {
    const { name, recipes, isActive } = req.body;
    const plan = await MealPrepPlan.findById(req.params.id);

    if (!plan) return res.status(404).json({ message: 'Plan not found.' });
    if (plan.userId.toString() !== req.userData.userId) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    if (isActive === true) {
      await MealPrepPlan.updateMany(
        { userId: req.userData.userId, _id: { $ne: req.params.id }, isActive: true },
        { $set: { isActive: false } }
      );
    }

    plan.name = name || plan.name;
    if (isActive !== undefined) plan.isActive = isActive;

    plan.recipes = recipes.map((r) => ({
      recipeId: r.recipeId._id || r.recipeId, // Handles both populated and unpopulated IDs
      plannedPortions: r.plannedPortions,
      isCompleted: r.isCompleted || false
    }));

    await plan.save();
    res.status(200).json({ message: 'Meal Prep Plan updated.', plan });
  } catch (err) {
    console.error('Update Plan Error:', err);
    res.status(500).json({ message: 'Failed to update plan.' });
  }
});

// POST /api/meal-plans/:id/activate - Activate an inactive plan & reset all recipes to un-cooked
router.post('/:id/activate', checkAuth, async (req, res) => {
  try {
    const plan = await MealPrepPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found.' });
    if (plan.userId.toString() !== req.userData.userId) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    // Deactivate all other active plans
    await MealPrepPlan.updateMany(
      { userId: req.userData.userId, isActive: true },
      { $set: { isActive: false } }
    );

    // Reset all planned recipes to un-cooked
    plan.recipes.forEach((r) => {
      r.isCompleted = false;
    });
    plan.isActive = true;

    await plan.save();
    res.status(200).json({ message: 'Plan activated and reset successfully.', plan });
  } catch (err) {
    console.error('Activate Plan Error:', err);
    res.status(500).json({ message: 'Failed to activate plan.' });
  }
});

// POST /api/meal-plans/:id/deactivate - Deactivate active plan (leaves user with no active plan)
router.post('/:id/deactivate', checkAuth, async (req, res) => {
  try {
    const plan = await MealPrepPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found.' });
    if (plan.userId.toString() !== req.userData.userId) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    plan.isActive = false;
    await plan.save();

    res.status(200).json({ message: 'Plan deactivated successfully.', plan });
  } catch (err) {
    console.error('Deactivate Plan Error:', err);
    res.status(500).json({ message: 'Failed to deactivate plan.' });
  }
});

// POST /api/meal-plans/:id/restart - Reset active plan progress back to un-cooked
router.post('/:id/restart', checkAuth, async (req, res) => {
  try {
    const plan = await MealPrepPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found.' });
    if (plan.userId.toString() !== req.userData.userId) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    plan.recipes.forEach((r) => {
      r.isCompleted = false;
    });

    await plan.save();
    res.status(200).json({ message: 'Plan progress reset successfully.', plan });
  } catch (err) {
    console.error('Restart Plan Error:', err);
    res.status(500).json({ message: 'Failed to reset plan progress.' });
  }
});

// DELETE /api/meal-plans/:id - Delete an inactive plan
router.delete('/:id', checkAuth, async (req, res) => {
  try {
    const plan = await MealPrepPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found.' });
    if (plan.userId.toString() !== req.userData.userId) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    // Block deletion of the currently active plan
    if (plan.isActive) {
      return res
        .status(400)
        .json({ message: 'Cannot delete an active plan. Please deactivate it first.' });
    }

    await plan.deleteOne();
    res.status(200).json({ message: 'Meal Prep Plan deleted successfully.' });
  } catch (err) {
    console.error('Delete Plan Error:', err);
    res.status(500).json({ message: 'Failed to delete plan.' });
  }
});

// POST /api/meal-plans/:id/complete-recipe - Complete planned recipe & log to storage
router.post('/:id/complete-recipe', checkAuth, async (req, res) => {
  try {
    const { recipeId, portionsToAdd } = req.body;
    const plan = await MealPrepPlan.findById(req.params.id);

    if (!plan) return res.status(404).json({ message: 'Plan not found.' });
    if (plan.userId.toString() !== req.userData.userId) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    const plannedRecipe = plan.recipes.find((r) => r.recipeId.toString() === recipeId);
    if (!plannedRecipe) return res.status(404).json({ message: 'Recipe not in plan.' });

    if (plannedRecipe.isCompleted) {
      return res.status(400).json({ message: 'Recipe already marked completed.' });
    }

    const amountToAdd =
      typeof portionsToAdd === 'number' && portionsToAdd >= 0
        ? portionsToAdd
        : plannedRecipe.plannedPortions;

    plannedRecipe.isCompleted = true;
    await plan.save();

    const recipe = await Recipe.findById(recipeId);
    const title = recipe ? recipe.title : 'Unknown Recipe';

    if (amountToAdd > 0) {
      await PortionStorage.findOneAndUpdate(
        { userId: req.userData.userId, recipeId },
        {
          $inc: { portionsInStorage: amountToAdd },
          $setOnInsert: { recipeTitle: title }
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    res.status(200).json({ message: 'Recipe marked complete.', plan });
  } catch (err) {
    console.error('Complete Recipe Error:', err);
    res.status(500).json({ message: 'Failed to complete recipe.' });
  }
});

module.exports = router;
