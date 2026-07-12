const { Matrix } = require('ml-matrix');
const { nnls } = require('nnls');

// Configuration Constants
const TIER = 0.1; // +/- 10% variance band for macronutrient targets

// Gating Logic: Determines if an ingredient is a locked seasoning.
const isSeasoning = (ingredient, recipeCalories) => {
  const hasSpicesTag = ingredient.tags ? ingredient.tags.includes('Spices & Herbs') : false;
  const nutrition = ingredient.nutrition || {};
  const calories =
    (nutrition.protein || 0) * 4 + (nutrition.netCarbs || 0) * 4 + (nutrition.fat || 0) * 9;

  const isMicroNutrient =
    (nutrition.fat || 0) < 1.5 &&
    (nutrition.netCarbs || 0) < 3 &&
    (nutrition.protein || 0) < 2 &&
    calories < recipeCalories * 0.05;
  return hasSpicesTag || isMicroNutrient;
};

// Diagnostics Engine: Determines WHY the matrix failed based on NNLS shortfalls.
const diagnoseFailure = (activeIngredients, adjustedTargets, achieved) => {
  // Edge Case: Empty Recipe
  if (activeIngredients.length === 0) {
    const primaryMacro = Object.keys(adjustedTargets).reduce((a, b) =>
      adjustedTargets[a] > adjustedTargets[b] ? a : b
    );
    return {
      isFeasible: false,
      failureType: 'ADD',
      targetMacro: primaryMacro,
      failureReason: `Empty Base: The recipe lacks any primary macro sources.`,
      offendingIngredient: null,
      zeroTargets: []
    };
  }

  // Strict Zero Conflicts (Needs REMOVE)
  const macros = ['protein', 'fat', 'netCarbs'];
  let zeroTargets = [];
  for (const macro of macros) {
    if (adjustedTargets[macro] === 0) {
      // Find the ingredient that contributes the most of this zeroed macro
      let worstOffender = null;
      let maxMacroValue = 0;
      zeroTargets.push(macro);

      for (const ing of activeIngredients) {
        const val = ing.nutrition?.[macro] || 0;
        if (val > maxMacroValue) {
          maxMacroValue = val;
          worstOffender = ing;
        }
      }

      if (worstOffender && maxMacroValue > 0) {
        return {
          isFeasible: false,
          failureType: 'REMOVE',
          targetMacro: macro,
          offendingIngredient: worstOffender.name,
          failureReason: `Strict Zero Conflict: You are targeting 0g of ${macro}, but '${worstOffender.name}' contains it. It must be removed to mathematically achieve your target.`,
          zeroTargets: []
        };
      }
    }
  }

  // If no zero target, then we need to add an ingredient that fills in the missing macro.
  // Gap Analysis (Looking for largest shortfall)
  const shortfalls = [
    {
      macro: 'protein',
      gap: adjustedTargets.protein - achieved.protein,
      target: adjustedTargets.protein
    },
    { macro: 'fat', gap: adjustedTargets.fat - achieved.fat, target: adjustedTargets.fat },
    {
      macro: 'netCarbs',
      gap: adjustedTargets.netCarbs - achieved.netCarbs,
      target: adjustedTargets.netCarbs
    }
  ];

  // Sort to find the most severe relative percentage shortfall
  shortfalls.sort((a, b) => {
    const pctA = a.target > 0 ? a.gap / a.target : 0;
    const pctB = b.target > 0 ? b.gap / b.target : 0;
    return pctB - pctA;
  });

  const worstShortfall = shortfalls[0];

  return {
    isFeasible: false,
    failureType: 'ADD',
    targetMacro: worstShortfall.macro,
    failureReason: `Deficiency Conflict: The recipe cannot reach the ${worstShortfall.macro} target without overshooting other limits.`,
    offendingIngredient: null,
    zeroTargets: zeroTargets
  };
};

// Helper to calculate the exact macro delivery given an array of multipliers
const calculateDelivery = (activeIngredients, multipliers) => {
  let p = 0,
    f = 0,
    c = 0;
  activeIngredients.forEach((ing, i) => {
    p += (ing.nutrition?.protein || 0) * multipliers[i];
    f += (ing.nutrition?.fat || 0) * multipliers[i];
    c += (ing.nutrition?.netCarbs || 0) * multipliers[i];
  });
  return { protein: p, fat: f, netCarbs: c };
};

// Main Execution Function using Non-Negative Least Squares (NNLS)
const solveMatrix = async (ingredients, targets) => {
  console.log(`\n======================================================`);
  console.log(`[MacroBalancer] INITIATING NNLS SOLVER`);
  console.log(`[MacroBalancer] Targets Received:`, targets);
  console.log(`[MacroBalancer] Total Ingredients Received: ${ingredients.length}`);

  const recipeMacros = calculateDelivery(ingredients, new Array(ingredients.length).fill(1));

  const targetProtein = targets?.protein || 0;
  const targetFat = targets?.fat || 0;
  const targetNetCarbs = targets?.netCarbs || 0;

  // Pre-Check: Determine if current macros are already within acceptable bounds
  const pTol = targetProtein * TIER + 0.1;
  const fTol = targetFat * TIER + 0.1;
  const cTol = targetNetCarbs * TIER + 0.1;

  const isProteinAlreadyValid = Math.abs(recipeMacros.protein - targetProtein) <= pTol;
  const isFatAlreadyValid = Math.abs(recipeMacros.fat - targetFat) <= fTol;
  const isCarbsAlreadyValid = Math.abs(recipeMacros.netCarbs - targetNetCarbs) <= cTol;

  if (isProteinAlreadyValid && isFatAlreadyValid && isCarbsAlreadyValid) {
    console.log(
      `[MacroBalancer] Recipe is ALREADY within the acceptable macro range.\n` +
        `  Protein  : ${recipeMacros.protein.toFixed(1)}g / Target: ${targetProtein}g\n` +
        `  Fat      : ${recipeMacros.fat.toFixed(1)}g / Target: ${targetFat}g\n` +
        `  NetCarbs : ${recipeMacros.netCarbs.toFixed(1)}g / Target: ${targetNetCarbs}g\n` +
        `Skipping NNLS optimization and returning original quantities.`
    );
    console.log(`======================================================\n`);
    return {
      isFeasible: true,
      scaledIngredients: ingredients
    };
  }

  // take out seasonings from the NNLS optimization (only scale main ingredients)
  // this avoids the math blowing up a seasoning to fill a NetCarbs target for example.
  const seasonings = [];
  const activeIngredients = [];
  const seasoningMacros = { protein: 0, fat: 0, netCarbs: 0 };

  const recipeCalories =
    recipeMacros.protein * 4 + recipeMacros.netCarbs * 4 + recipeMacros.fat * 9;

  ingredients.forEach((ing) => {
    if (isSeasoning(ing, recipeCalories)) {
      seasonings.push(ing);
      seasoningMacros.protein += ing.nutrition?.protein || 0;
      seasoningMacros.fat += ing.nutrition?.fat || 0;
      seasoningMacros.netCarbs += ing.nutrition?.netCarbs || 0;
    } else {
      activeIngredients.push(ing);
    }
  });

  const adjustedTargets = {
    protein: Math.max(0, targetProtein - seasoningMacros.protein),
    fat: Math.max(0, targetFat - seasoningMacros.fat),
    netCarbs: Math.max(0, targetNetCarbs - seasoningMacros.netCarbs)
  };

  if (activeIngredients.length === 0) {
    console.warn(`[MacroBalancer] WARNING: No active ingredients found after seasoning gate.`);
    return diagnoseFailure(activeIngredients, adjustedTargets, { protein: 0, fat: 0, netCarbs: 0 });
  }

  // Build the base matrices using standard arrays
  const A_arr = [
    activeIngredients.map((ing) => ing.nutrition?.protein || 0),
    activeIngredients.map((ing) => ing.nutrition?.fat || 0),
    activeIngredients.map((ing) => ing.nutrition?.netCarbs || 0)
  ];

  const b_arr = [adjustedTargets.protein, adjustedTargets.fat, adjustedTargets.netCarbs];

  // Apply Tikhonov Regularization (Ridge Regression)
  // append an identity matrix with size equal to the
  // number of ingredients, and set the new rows equal
  // to 0 in the target macros vector b.
  const lambda = 0.0001;
  activeIngredients.forEach((_, i) => {
    const regRow = new Array(activeIngredients.length).fill(0);
    regRow[i] = lambda;

    A_arr.push(regRow);
    b_arr.push(0);
  });

  const A = new Matrix(A_arr);
  const b = Matrix.columnVector(b_arr);

  let multipliers = [];

  try {
    const result = nnls(A, b);
    multipliers = result.x.to1DArray().map((val) => {
      if (isNaN(val) || val < 1e-10) {
        return 0;
      }
      return val;
    });
  } catch (err) {
    console.warn(
      `[MacroBalancer] NNLS Solver exceeded iterations or failed. Falling back to original ingredient weights to preserve recipe state. Error:`,
      err.message
    );
    multipliers = new Array(activeIngredients.length).fill(1);
  }

  // Re-calculate the achieved macros
  const achieved = calculateDelivery(activeIngredients, multipliers);

  const activePTol = adjustedTargets.protein * TIER + 0.1;
  const activeFTol = adjustedTargets.fat * TIER + 0.1;
  const activeCTol = adjustedTargets.netCarbs * TIER + 0.1;

  const isProteinValid = Math.abs(achieved.protein - adjustedTargets.protein) <= activePTol;
  const isFatValid = Math.abs(achieved.fat - adjustedTargets.fat) <= activeFTol;
  const isCarbsValid = Math.abs(achieved.netCarbs - adjustedTargets.netCarbs) <= activeCTol;

  const isFeasible = isProteinValid && isFatValid && isCarbsValid;

  console.log(`[MacroBalancer] Phase 5: Achieved Macros vs Targets:`);
  console.log(
    `   Protein:  ${achieved.protein.toFixed(1)} / ${adjustedTargets.protein}  (Tol: ±${activePTol.toFixed(1)}) -> ${isProteinValid ? 'PASS' : 'FAIL'}`
  );
  console.log(
    `   Fat:      ${achieved.fat.toFixed(1)} / ${adjustedTargets.fat}  (Tol: ±${activeFTol.toFixed(1)}) -> ${isFatValid ? 'PASS' : 'FAIL'}`
  );
  console.log(
    `   NetCarbs: ${achieved.netCarbs.toFixed(1)} / ${adjustedTargets.netCarbs}  (Tol: ±${activeCTol.toFixed(1)}) -> ${isCarbsValid ? 'PASS' : 'FAIL'}`
  );

  // Package the resulting scaled ingredients
  const scaledActiveIngredients = activeIngredients.map((ing, i) => {
    const m = multipliers[i];
    return {
      ...ing,
      weightInGrams: parseFloat(((ing.weightInGrams || 0) * m).toFixed(1)),
      nutrition: {
        ...(ing.nutrition || {}),
        calories: Math.round((ing.nutrition?.calories || 0) * m),
        protein: parseFloat(((ing.nutrition?.protein || 0) * m).toFixed(1)),
        fat: parseFloat(((ing.nutrition?.fat || 0) * m).toFixed(1)),
        netCarbs: parseFloat(((ing.nutrition?.netCarbs || 0) * m).toFixed(1)),
        totalCarbs: parseFloat(((ing.nutrition?.totalCarbs || 0) * m).toFixed(1)),
        fiber: parseFloat(((ing.nutrition?.fiber || 0) * m).toFixed(1)),
        sugarAlcohols: parseFloat(((ing.nutrition?.sugarAlcohols || 0) * m).toFixed(1))
      }
    };
  });

  if (isFeasible) {
    console.log(`[MacroBalancer] Phase 6: SUCCESS - Recipe is strictly feasible.`);
    console.log(`======================================================\n`);
    return {
      isFeasible: true,
      scaledIngredients: [...scaledActiveIngredients, ...seasonings]
    };
  }

  const diagnostic = diagnoseFailure(activeIngredients, adjustedTargets, achieved);

  console.log(`[MacroBalancer] Phase 6: APPROXIMATE - Tolerance exceeded.`);
  console.log(
    `[MacroBalancer] Issuing Intervention -> Type: ${diagnostic.failureType}, Target: ${diagnostic.offendingIngredient || diagnostic.targetMacro}`
  );
  console.log(`======================================================\n`);

  return {
    ...diagnostic,
    isApproximate: true,
    scaledIngredients: [...scaledActiveIngredients, ...seasonings]
  };
};

module.exports = { solveMatrix, diagnoseFailure };
