const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const checkAuth = require('../middleware/auth');

// GET /api/recipes - Search public recipes (ignoring deleted ones)
router.get('/', checkAuth, async (req, res) => {
  try {
    const { q, tags, page = 1, limit = 50 } = req.query;

    // Base query: Only show public, non-deleted recipes
    let queryObj = { isPublic: true, isDeleted: false };

    if (q) queryObj.$text = { $search: q };
    if (tags) {
      const tagsArray = tags.split(',').map((tag) => tag.trim());
      queryObj.tags = { $all: tagsArray };
    }

    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 50;
    const skipAmount = (pageNumber - 1) * limitNumber;

    const [recipes, totalCount] = await Promise.all([
      Recipe.find(queryObj)
        .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
        .skip(skipAmount)
        .limit(limitNumber)
        .populate('createdBy', 'username profilePicture'), // Optional: Fetch author details
      Recipe.countDocuments(queryObj)
    ]);

    res.status(200).json({
      data: recipes,
      meta: {
        totalItems: totalCount,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
        totalPages: Math.ceil(totalCount / limitNumber)
      }
    });
  } catch (err) {
    console.error('Recipe Search API Error:', err);
    res.status(500).json({ message: 'Error fetching recipes.' });
  }
});

// GET /api/recipes/me - Get recipes owned by the current user
router.get('/me', checkAuth, async (req, res) => {
  try {
    const recipes = await Recipe.find({
      createdBy: req.userData.userId,
      isDeleted: false
    }).sort({ createdAt: -1 });

    res.status(200).json({ data: recipes });
  } catch (err) {
    console.error('Fetch My Recipes API Error:', err);
    res.status(500).json({ message: 'Failed to fetch your recipes.' });
  }
});

// POST /api/recipes - Create a new recipe
router.post('/', checkAuth, async (req, res) => {
  try {
    const recipeData = {
      ...req.body,
      createdBy: req.userData.userId
    };

    const newRecipe = new Recipe(recipeData);
    const savedRecipe = await newRecipe.save();

    res.status(201).json({ message: 'Recipe created successfully.', recipe: savedRecipe });
  } catch (err) {
    // Intercept Mongoose validation errors cleanly
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation Error',
        details: err.message
      });
    }
    console.error('Create Recipe API Error:', err);
    res.status(500).json({ message: 'Failed to create recipe.' });
  }
});

// GET /api/recipes/:id - Fetch single recipe
router.get('/:id', checkAuth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) return res.status(404).json({ message: 'Recipe not found.' });
    if (recipe.isDeleted && recipe.createdBy.toString() !== req.userData.userId) {
      return res.status(404).json({ message: 'Recipe not found or has been deleted.' });
    }

    res.status(200).json(recipe);
  } catch (err) {
    console.error('Fetch Single Recipe API Error:', err);
    res.status(500).json({ message: 'Failed to fetch recipe details.' });
  }
});

// PUT /api/recipes/:id - Update recipe
router.put('/:id', checkAuth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe || recipe.isDeleted) return res.status(404).json({ message: 'Recipe not found.' });
    if (recipe.createdBy.toString() !== req.userData.userId) {
      return res.status(403).json({ message: 'Forbidden. You can only edit your own recipes.' });
    }

    Object.assign(recipe, req.body);
    const updatedRecipe = await recipe.save();

    res.status(200).json({ message: 'Recipe updated.', recipe: updatedRecipe });
  } catch (err) {
    // Intercept Mongoose validation errors cleanly
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation Error',
        details: err.message
      });
    }
    console.error('Update Recipe API Error:', err);
    res.status(500).json({ message: 'Failed to update recipe.' });
  }
});

// DELETE /api/recipes/:id - Soft Delete
router.delete('/:id', checkAuth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe || recipe.isDeleted) return res.status(404).json({ message: 'Recipe not found.' });
    if (recipe.createdBy.toString() !== req.userData.userId) {
      return res.status(403).json({ message: 'Forbidden. You can only delete your own recipes.' });
    }

    recipe.isDeleted = true;
    recipe.isPublic = false;
    await recipe.save();

    res.status(200).json({ message: 'Recipe deleted successfully.' });
  } catch (err) {
    console.error('Delete Recipe API Error:', err);
    res.status(500).json({ message: 'Failed to delete recipe.' });
  }
});

// POST /api/recipes/:id/fork - Copy an existing recipe
router.post('/:id/fork', checkAuth, async (req, res) => {
  try {
    const originalRecipe = await Recipe.findById(req.params.id);

    if (!originalRecipe || originalRecipe.isDeleted) {
      return res.status(404).json({ message: 'Recipe not found.' });
    }

    if (!originalRecipe.isPublic && originalRecipe.createdBy.toString() !== req.userData.userId) {
      return res.status(403).json({ message: 'This recipe is private.' });
    }

    const forkedData = originalRecipe.toObject();
    delete forkedData._id;
    delete forkedData.createdAt;
    delete forkedData.updatedAt;

    forkedData.createdBy = req.userData.userId;
    forkedData.isPublic = false;
    forkedData.originalRecipeId = originalRecipe._id;
    forkedData.title = `${forkedData.title} (Copy)`;

    const newRecipe = new Recipe(forkedData);
    await newRecipe.save();

    res.status(201).json({ message: 'Recipe copied successfully.', recipe: newRecipe });
  } catch (err) {
    console.error('Fork Recipe API Error:', err);
    res.status(500).json({ message: 'Failed to copy recipe.' });
  }
});

module.exports = router;
