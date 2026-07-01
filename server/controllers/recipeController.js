const { solveMatrix } = require('../utils/macroBalancer');
const { getAiSuggestions } = require('../utils/geminiClient');
const { fetchUsdaMacros } = require('../utils/usdaClient');
const Ingredient = require('../models/Ingredient');

// Escapes any characters that have special meaning in regular expressions
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// POST /api/recipes/balance
// Unifies mathematical balancing, AI intervention, and circuit-breaking logic.
const balanceRecipe = async (req, res) => {
  try {
    // Extract payload from the Angular client
    const { ingredients, targets, dietaryRestrictions, interventionCount = 0 } = req.body;

    // Attempt the core mathematical solve (+/- 10% tolerance band)
    const solverResult = await solveMatrix(ingredients, targets);

    // STATE 1: Matrix solved successfully
    if (solverResult.isFeasible) {
      return res.status(200).json({
        status: 'success',
        ingredients: solverResult.scaledIngredients
      });
    }

    // STATE 3: Circuit Breaker - Matrix failed, but we hit the retry limit
    if (!solverResult.isFeasible && interventionCount >= 4) {
      // solverResult.scaledIngredients here contains the "best approximate" math
      // where the solver dropped the strict constraints to force a resolution.
      return res.status(200).json({
        status: 'approximate_success',
        ingredients: solverResult.scaledIngredients
      });
    }

    // STATE 2: Matrix failed, and we need user intervention (SWAP or ADD or REMOVE)

    // INTERCEPT: If a strict zero constraint was violated, we bypass the AI entirely.
    if (solverResult.failureType === 'REMOVE') {
      return res.status(200).json({
        status: 'action_required',
        intervention: {
          type: 'REMOVE',
          targetIngredient: solverResult.offendingIngredient,
          reasoning: solverResult.failureReason,
          options: [] // No alternative options possible for a strict 0
        }
      });
    }

    // First, pass the failure context to Gemini for culinary concepts.
    const aiConcepts = await getAiSuggestions({
      failureType: solverResult.failureType,
      failureReason: solverResult.failureReason,
      offendingIngredient: solverResult.offendingIngredient,
      targetMacro: solverResult.targetMacro,
      dietaryRestrictions: dietaryRestrictions,
      currentIngredients: ingredients.map((ing) => ing.name)
    });

    // Look in Database for ingredient macros First, USDA Second
    const rawOptions = await Promise.all(
      aiConcepts.map(async (concept) => {
        // Sanitize the incoming string
        const safeIngredientName = escapeRegExp(concept.ingredientName);

        // Safely execute the case-insensitive lookup
        const localIngredient = await Ingredient.findOne({
          name: { $regex: new RegExp(`^${safeIngredientName}$`, 'i') }
        });

        if (localIngredient) {
          // Found in DB! Return the full Mongoose document + AI Reasoning
          return {
            ...localIngredient.toObject(),
            reasonForRecommendation: concept.reasonForRecommendation
          };
        }

        // Not found in DB. Fallback to USDA API.
        const verifiedMacros = await fetchUsdaMacros(concept.ingredientName);

        // AUTO-POPULATE: Save the newly verified ingredient to your database
        // so the NEXT time the AI suggests it, we hit Step 1 instead!
        if (verifiedMacros.protein > 0 || verifiedMacros.fat > 0 || verifiedMacros.netCarbs > 0) {
          const finalIngredient = await Ingredient.create({
            name: concept.ingredientName,
            servingSize: 100, // USDA returns data per 100g
            servingUnit: 'g',
            nutritionPerServing: {
              protein: verifiedMacros.protein,
              fat: verifiedMacros.fat,
              totalCarbs: verifiedMacros.totalCarbs || verifiedMacros.netCarbs,
              fiber: verifiedMacros.fiber || 0,
              sugarAlcohols: 0,
              netCarbs: verifiedMacros.netCarbs
            }
          });

          return {
            ...finalIngredient.toObject(),
            reasonForRecommendation: concept.reasonForRecommendation
          };
        }

        // EDGE CASE: USDA found nothing (zero macros).
        // The ingredient is useless for macro balancing, so we return null.
        // This takes the option out of the selectable results for the user.
        return null;
      })
    );

    // Clean the array: Strip out any nulls where USDA came up empty
    const verifiedOptions = rawOptions.filter((option) => option !== null);

    // Finally, return the strict schema the Angular frontend expects
    return res.status(200).json({
      status: 'action_required',
      intervention: {
        type: solverResult.failureType, // 'SWAP' or 'ADD'
        targetIngredient:
          solverResult.failureType === 'SWAP' ? solverResult.offendingIngredient : null,
        reasoning: solverResult.failureReason,
        options: verifiedOptions // Only contains fully verified, macro-filled ingredients
      }
    });
  } catch (error) {
    console.error('Error executing recipe balance:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred during the recipe balancing process.'
    });
  }
};

module.exports = { balanceRecipe };
