const express = require('express');
const router = express.Router();
const EmailService = require('../../services/emailService');
const Recipe = require('../../models/Recipe').default || require('../../models/Recipe');
const Ingredient = require('../../models/Ingredient').default || require('../../models/Ingredient');

/**
 * @openapi
 * /admin/content/delete/bulk:
 *   post:
 *     summary: Bulk delete recipes or ingredients by IDs
 */
router.post('/delete/bulk', async (req, res) => {
  try {
    const { type, ids } = req.body;

    if (!type || !['recipe', 'ingredient'].includes(type)) {
      return res.status(400).json({ error: 'Must specify `type` as "recipe" or "ingredient"' });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Must provide an array of item IDs to delete.' });
    }

    let deletedCount = 0;
    if (type === 'recipe') {
      const results = await Recipe.deleteMany({ _id: { $in: ids } });
      deletedCount = results.deletedCount;

      // Notify admin via email
      try {
        await EmailService.send(
          process.env.ADMIN_ALERT_EMAIL || 'admin@mealplan.local',
          `Bulk Delete — Recipes`,
          `${deletedCount} recipe(s) were permanently deleted: ${ids.join(', ')}`
        );
      } catch (emailErr) {
        console.error('[AdminContent] Admin alert email failed:', emailErr.message);
      }
    } else if (type === 'ingredient') {
      const results = await Ingredient.deleteMany({ _id: { $in: ids } });
      deletedCount = results.deletedCount;

      try {
        await EmailService.send(
          process.env.ADMIN_ALERT_EMAIL || 'admin@mealplan.local',
          `Bulk Delete — Ingredients`,
          `${deletedCount} ingredient(s) were permanently deleted: ${ids.join(', ')}`
        );
      } catch (emailErr) {
        console.error('[AdminContent] Admin alert email failed:', emailErr.message);
      }
    }

    return res.status(200).json({ success: true, deletedCount });
  } catch (error) {
    console.error('[AdminContent] Bulk delete failed:', error.message);
    return res.status(500).json({ error: 'Failed to bulk delete items' });
  }
});

/**
 * @openapi
 * /admin/content/cleanup/ingredients:
 *   patch:
 *     summary: Cleanup stale ingredients (no recipes referencing them)
 */
router.patch('/cleanup/ingredients', async (req, res) => {
  try {
    // Find ingredients not referenced by any recipe
    const orphanIngredients = await Ingredient.aggregate([
      {
        $match: {
          _id: {
            $nin: [
              {
                $map: [{ $cond: { if: { $eq: ['$recipes', null] }, then: [] }, else: '$recipes' }],
                as: 'recipeIds'
              }
            ]
          }
        }
      }, // ingredients with no recipe references,
      { $project: { _id: 1, name: 1 } }
    ]);

    if (orphanIngredients.length === 0) {
      return res
        .status(200)
        .json({ success: true, cleaned: 0, message: 'No stale ingredients found.' });
    }

    const results = await Ingredient.deleteMany({
      _id: { $in: orphanIngredients.map((i) => i._id) }
    });

    try {
      await EmailService.send(
        process.env.ADMIN_ALERT_EMAIL || 'admin@mealplan.local',
        `Cleanup — Orphan Ingredients`,
        `${results.deletedCount} stale ingredient(s) were removed (no recipes reference them): ${orphanIngredients.map((i) => i.name).join(', ')}`
      );
    } catch (emailErr) {
      console.error('[AdminContent] Cleanup email failed:', emailErr.message);
    }

    return res.status(200).json({ success: true, cleaned: results.deletedCount });
  } catch (error) {
    console.error('[AdminContent] Cleanup failed:', error.message);
    return res.status(500).json({ error: 'Failed to cleanup stale ingredients' });
  }
});

/**
 * @openapi
 * /admin/content/restore:
 *   post:
 *     summary: Restore previously deleted items (from soft-delete store if implemented)
 */
router.post('/restore', async (req, res) => {
  try {
    const { type, ids } = req.body;

    if (!type || !ids?.length) {
      return res.status(400).json({ error: 'Must provide `type` and an array of IDs to restore.' });
    }

    // Note: Currently no soft-delete store is implemented. This endpoint would
    // integrate with a Mongoose discriminator-based archive collection if added later.
    // For now, return early with a note that this feature requires additional schema design.
    return res.status(400).json({
      error: 'Soft delete / restore requires an archive collection. Not yet implemented.'
    });
  } catch (error) {
    console.error('[AdminContent] Restore failed:', error.message);
    return res.status(500).json({ error: 'Failed to restore items' });
  }
});

module.exports = router;
