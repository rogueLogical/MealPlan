const express = require('express');
const router = express.Router();
const Ingredient = require('../models/Ingredient');
const checkAuth = require('../middleware/auth');

// GET /api/ingredients - Search, or get all ingredients
// Supports query params: ?q=chicken&tags=Keto&page=1&limit=50
router.get('/', checkAuth, async (req, res) => {
  try {
    // Set sensible defaults: page 1, 50 items per page
    const { q, tags, page = 1, limit = 50 } = req.query;
    let queryObj = {};

    // Text Search
    if (q) {
      queryObj.$text = { $search: q };
    }

    // Tag Filtering
    if (tags) {
      const tagsArray = tags.split(',').map((tag) => tag.trim());
      queryObj.tags = { $all: tagsArray };
    }

    // Pagination Math
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 50;
    const skipAmount = (pageNumber - 1) * limitNumber;

    // Execute Queries Concurrently
    const [ingredients, totalCount] = await Promise.all([
      Ingredient.find(queryObj)
        .sort(q ? { score: { $meta: 'textScore' } } : { name: 1 })
        .skip(skipAmount)
        .limit(limitNumber),
      Ingredient.countDocuments(queryObj)
    ]);

    // Return Data + Metadata Payload
    res.status(200).json({
      data: ingredients,
      meta: {
        totalItems: totalCount,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
        totalPages: Math.ceil(totalCount / limitNumber)
      }
    });
  } catch (err) {
    console.error('Ingredient Search API Error:', err);
    res.status(500).json({ message: 'Error fetching ingredients.' });
  }
});

// POST /api/ingredients - Create a new ingredient
router.post('/', checkAuth, async (req, res) => {
  try {
    // Inject the authenticated user's ID into the payload
    const ingredientData = {
      ...req.body,
      createdBy: req.userData.userId
    };

    const newIngredient = new Ingredient(ingredientData);
    const savedIngredient = await newIngredient.save(); // Pre-save hook calculates netCarbs

    res.status(201).json({
      message: 'Ingredient added successfully.',
      ingredient: savedIngredient
    });
  } catch (err) {
    console.error('Create Ingredient API Error:', err);
    // MongoDB duplicate key error code
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: 'An ingredient with this exact name already exists in the database.' });
    }
    res.status(500).json({ message: 'Failed to create ingredient.' });
  }
});

// GET /api/ingredients/:id - Fetch a single ingredient by ID
router.get('/:id', checkAuth, async (req, res) => {
  try {
    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found.' });
    }

    res.status(200).json(ingredient);
  } catch (err) {
    console.error('Fetch Single Ingredient API Error:', err);
    res.status(500).json({ message: 'Failed to fetch ingredient details.' });
  }
});

// PUT /api/ingredients/:id - Update an existing ingredient
router.put('/:id', checkAuth, async (req, res) => {
  try {
    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found.' });
    }

    // Security Check: Ensure the user actually owns this ingredient before editing
    if (ingredient.createdBy?.toString() !== req.userData.userId) {
      return res
        .status(403)
        .json({ message: 'Forbidden. You can only edit ingredients that you created.' });
    }

    // Overwrite the existing document fields with the new data
    Object.assign(ingredient, req.body);

    // Using .save() instead of an update query ensures Net Carbs pre-save hook fires
    const updatedIngredient = await ingredient.save();

    res.status(200).json({
      message: 'Ingredient updated successfully.',
      ingredient: updatedIngredient
    });
  } catch (err) {
    console.error('Update Ingredient API Error:', err);
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: 'An ingredient with this exact name already exists.' });
    }
    res.status(500).json({ message: 'Failed to update ingredient.' });
  }
});

// DELETE /api/ingredients/:id - Delete an ingredient
router.delete('/:id', checkAuth, async (req, res) => {
  try {
    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found.' });
    }

    // Security Check: Only the creator can delete it
    if (ingredient.createdBy?.toString() !== req.userData.userId) {
      return res
        .status(403)
        .json({ message: 'Forbidden. You can only delete ingredients that you created.' });
    }

    await ingredient.deleteOne();

    res.status(200).json({ message: 'Ingredient deleted successfully.' });
  } catch (err) {
    console.error('Delete Ingredient API Error:', err);
    res.status(500).json({ message: 'Failed to delete ingredient.' });
  }
});

module.exports = router;
