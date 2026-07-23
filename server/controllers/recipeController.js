const { solveMatrix } = require('../utils/macroBalancer');
const { getAiSuggestions, generateRecipeFromPrompt } = require('../utils/geminiClient');
const { fetchUsdaMacros } = require('../utils/usdaClient');
const Ingredient = require('../models/Ingredient');

// Escapes any characters that have special meaning in regular expressions
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Formats instructions step boundaries with exactly two newlines
const formatInstructions = (instructions) => {
  if (!instructions) return '';

  // Normalize Windows line-endings
  let cleaned = instructions.replace(/\r\n/g, '\n').trim();

  // If steps are grouped on a single line separated by numeric boundaries (e.g. "1. Step. 2. Step.")
  cleaned = cleaned.replace(/\. (\d+)\. /g, '.\n\n$1. ');

  // Replace single newlines separating sentences with double newlines
  cleaned = cleaned.replace(/(?<!\n)\n(?!\n)/g, '\n\n');

  // Collapse 3 or more consecutive newlines down to exactly two
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned;
};

// POST /api/recipes/balance
// Unifies mathematical balancing, AI intervention, and circuit-breaking logic.
const balanceRecipe = async (req, res) => {
  try {
    // Extract payload from the Angular client
    const { ingredients, targets, dietaryRestrictions, interventionCount = 0 } = req.body;

    // Log request contents for debugging purposes
    console.log('\n=========================================');
    console.log('[DEBUG] INCOMING RECIPE BALANCER REQUEST');
    console.log('=========================================');
    console.log(`Intervention Count : ${interventionCount}`);
    console.log(
      `Target Macros      : P: ${targets.protein}g | F: ${targets.fat}g | NC: ${targets.netCarbs}g`
    );
    console.log(
      `Dietary Filters    : [${dietaryRestrictions && dietaryRestrictions.length > 0 ? dietaryRestrictions.join(', ') : 'None'}]`
    );
    console.log('Ingredients:');
    if (ingredients && ingredients.length > 0) {
      ingredients.forEach((ing, i) => {
        const nut = ing.nutrition || {};
        console.log(
          `  [${i + 1}] Name: "${ing.name}"` +
            ` | Weight: ${ing.weightInGrams}g` +
            ` | Macros (Scaled): P: ${nut.protein || 0}g, F: ${nut.fat || 0}g, NC: ${nut.netCarbs || 0}g`
        );
      });
    } else {
      console.log('  (No ingredients provided in request)');
    }
    console.log('=========================================\n');

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

    // STATE 2: Matrix failed, and we need user intervention (ADD or REMOVE)

    // INTERCEPT: If a strict zero constraint was violated, we bypass the AI entirely.
    if (solverResult.failureType === 'REMOVE') {
      return res.status(200).json({
        status: 'action_required',
        ingredients: solverResult.scaledIngredients,
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
      currentIngredients: ingredients.map((ing) => ing.name),
      zeroTargets: solverResult.zeroTargets
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

        // AUTO-POPULATE: Save the newly verified ingredient to the database
        // so the NEXT time the AI suggests it, we hit Step 1 instead
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
      ingredients: solverResult.scaledIngredients,
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

const generateRecipe = async (req, res) => {
  try {
    const { description, recipeType, useMacroTargets, dietaryRestrictions = [] } = req.body;

    if (!description || description.trim().length === 0) {
      return res.status(400).json({ message: 'Description is required.' });
    }
    if (description.trim().length > 256) {
      return res.status(400).json({ message: 'Description cannot exceed 256 characters.' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.userData.userId);
    if (!user) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    let targets = null;
    if (useMacroTargets) {
      const settings = user.nutritionSettings || {};
      const daily = settings.dailyMacroTargets || {
        calories: 2000,
        protein: 150,
        netCarbs: 200,
        fat: 70
      };
      const split = settings.mealMacroSplitPercentage || {
        calories: 80,
        protein: 80,
        netCarbs: 80,
        fat: 80
      };
      const mealsCount = settings.dailyMealsCount || 3;
      const snacksCount = settings.dailySnacksCount || 2;

      if (recipeType === 'Meal') {
        const pSplit = split.protein || 80;
        const cSplit = split.netCarbs || 80;
        const fSplit = split.fat || 80;
        const meals = mealsCount || 1;

        targets = {
          protein: Math.round(((daily.protein || 0) * (pSplit / 100)) / meals),
          netCarbs: Math.round(((daily.netCarbs || 0) * (cSplit / 100)) / meals),
          fat: Math.round(((daily.fat || 0) * (fSplit / 100)) / meals)
        };
        targets.calories = Math.round(targets.protein * 4 + targets.netCarbs * 4 + targets.fat * 9);
      } else {
        const pSplit = 100 - (split.protein || 80);
        const cSplit = 100 - (split.netCarbs || 80);
        const fSplit = 100 - (split.fat || 80);
        const snacks = snacksCount || 1;

        if (snacks > 0) {
          targets = {
            protein: Math.round(((daily.protein || 0) * (pSplit / 100)) / snacks),
            netCarbs: Math.round(((daily.netCarbs || 0) * (cSplit / 100)) / snacks),
            fat: Math.round(((daily.fat || 0) * (fSplit / 100)) / snacks)
          };
          targets.calories = Math.round(
            targets.protein * 4 + targets.netCarbs * 4 + targets.fat * 9
          );
        } else {
          targets = { protein: 0, netCarbs: 0, fat: 0, calories: 0 };
        }
      }
    }

    // Generate recipe JSON structure using Gemini client
    const aiRecipe = await generateRecipeFromPrompt({
      promptText: description,
      recipeType,
      targets,
      dietaryRestrictions
    });

    // Run sequential resolution waterfall on each AI-suggested ingredient
    const resolvedIngredients = [];
    for (const ing of aiRecipe.ingredients) {
      const normalizedName = ing.name.trim().toLowerCase();

      // Stage A: Local DB Match
      let matchedIngredient = await Ingredient.findOne({
        name: { $regex: new RegExp(`^${escapeRegExp(normalizedName)}$`, 'i') }
      });

      if (matchedIngredient) {
        const multiplier = ing.weightInGrams / 100;
        const baseline = matchedIngredient.nutrition;
        resolvedIngredients.push({
          ingredientId: matchedIngredient._id,
          name: matchedIngredient.name,
          weightInGrams: ing.weightInGrams,
          displayAmount: ing.displayAmount,
          displayUnit: ing.displayUnit,
          nutrition: {
            calories: Math.round((baseline.calories || 0) * multiplier),
            protein: Math.round((baseline.protein || 0) * multiplier * 10) / 10,
            totalCarbs: Math.round((baseline.totalCarbs || 0) * multiplier * 10) / 10,
            fiber: Math.round((baseline.fiber || 0) * multiplier * 10) / 10,
            sugarAlcohols: Math.round((baseline.sugarAlcohols || 0) * multiplier * 10) / 10,
            netCarbs: Math.round((baseline.netCarbs || 0) * multiplier * 10) / 10,
            fat: Math.round((baseline.fat || 0) * multiplier * 10) / 10
          }
        });
        continue;
      }

      // Stage B: USDA API Fallback
      let usdaMacros = null;
      try {
        usdaMacros = await fetchUsdaMacros(normalizedName);
      } catch (err) {
        console.warn(`[RecipeGen] USDA lookup failed for "${normalizedName}":`, err.message);
      }

      if (usdaMacros !== null) {
        // Create and cache globally in the Ingredient collection
        const newDbIngredient = await Ingredient.create({
          name: normalizedName,
          servingSize: 100,
          servingUnit: 'g',
          nutritionPerServing: {
            protein: usdaMacros.protein,
            fat: usdaMacros.fat,
            totalCarbs: usdaMacros.totalCarbs || usdaMacros.netCarbs,
            fiber: usdaMacros.fiber || 0,
            sugarAlcohols: 0,
            netCarbs: usdaMacros.netCarbs
          }
        });

        const multiplier = ing.weightInGrams / 100;
        const baseline = newDbIngredient.nutrition;
        resolvedIngredients.push({
          ingredientId: newDbIngredient._id,
          name: newDbIngredient.name,
          weightInGrams: ing.weightInGrams,
          displayAmount: ing.displayAmount,
          displayUnit: ing.displayUnit,
          nutrition: {
            calories: Math.round((baseline.calories || 0) * multiplier),
            protein: Math.round((baseline.protein || 0) * multiplier * 10) / 10,
            totalCarbs: Math.round((baseline.totalCarbs || 0) * multiplier * 10) / 10,
            fiber: Math.round((baseline.fiber || 0) * multiplier * 10) / 10,
            sugarAlcohols: Math.round((baseline.sugarAlcohols || 0) * multiplier * 10) / 10,
            netCarbs: Math.round((baseline.netCarbs || 0) * multiplier * 10) / 10,
            fat: Math.round((baseline.fat || 0) * multiplier * 10) / 10
          }
        });
        continue;
      }

      // Stage C: AI Fallback (Estimated nutrition - not saved in database)
      const multiplier = ing.weightInGrams / 100;
      const base = ing.fallbackNutrition || {
        calories: 0,
        protein: 0,
        totalCarbs: 0,
        fiber: 0,
        sugarAlcohols: 0,
        fat: 0
      };
      const calculatedNet = Math.max(
        0,
        (base.totalCarbs || 0) - (base.fiber || 0) - (base.sugarAlcohols || 0)
      );

      const protein = Math.round((base.protein || 0) * multiplier * 10) / 10;
      const totalCarbs = Math.round((base.totalCarbs || 0) * multiplier * 10) / 10;
      const fiber = Math.round((base.fiber || 0) * multiplier * 10) / 10;
      const sugarAlcohols = Math.round((base.sugarAlcohols || 0) * multiplier * 10) / 10;
      const netCarbs = Math.round(calculatedNet * multiplier * 10) / 10;
      const fat = Math.round((base.fat || 0) * multiplier * 10) / 10;

      // Mathematically calculate calories based on macro yields to ensure front-end consistency
      const calories = Math.round(protein * 4 + netCarbs * 4 + fat * 9);

      resolvedIngredients.push({
        ingredientId: null, // Left null to represent fallback non-database ingredient
        name: normalizedName,
        weightInGrams: ing.weightInGrams,
        displayAmount: ing.displayAmount,
        displayUnit: ing.displayUnit,
        nutrition: {
          calories,
          protein,
          totalCarbs,
          fiber,
          sugarAlcohols,
          netCarbs,
          fat
        }
      });
    }

    // Assemble payload matching RecipeBuilder's Input format with formatted instructions
    const generatedRecipePayload = {
      title: aiRecipe.title,
      recipeType,
      isPublic: false,
      description: aiRecipe.description,
      instructions: formatInstructions(aiRecipe.instructions), // Applied formatting correction
      prepTimeMinutes: aiRecipe.prepTimeMinutes,
      cookTimeMinutes: aiRecipe.cookTimeMinutes,
      portions: aiRecipe.portions || 4,
      tags: aiRecipe.tags || [],
      ingredients: resolvedIngredients
    };

    return res.status(200).json(generatedRecipePayload);
  } catch (error) {
    console.error('Error generating recipe:', error);
    return res
      .status(500)
      .json({ message: 'An unexpected error occurred during recipe generation.' });
  }
};

module.exports = { balanceRecipe, generateRecipe };
