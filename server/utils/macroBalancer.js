const { Matrix } = require('ml-matrix');
const { nnls } = require('nnls');

// Configuration Constants
const TIER = 0.1; // +/- 10% variance band for macronutrient targets

// Gating Logic: Determines if an ingredient is a locked seasoning.
const isSeasoning = (ingredient) => {
  const hasSpicesTag = ingredient.tags ? ingredient.tags.includes('Spices & Herbs') : false;
  const nutrition = ingredient.nutrition || {};
  const isMicroNutrient =
    (nutrition.fat || 0) < 1.5 && (nutrition.netCarbs || 0) < 3 && (nutrition.protein || 0) < 2;
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
      offendingIngredient: null
    };
  }

  // Strict Zero Conflicts (Needs REMOVE)
  const macros = ['protein', 'fat', 'netCarbs'];
  for (const macro of macros) {
    if (adjustedTargets[macro] === 0) {
      // Find the ingredient that contributes the most of this zeroed macro
      let worstOffender = null;
      let maxMacroValue = 0;

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
          failureReason: `Strict Zero Conflict: You are targeting 0g of ${macro}, but '${worstOffender.name}' contains it. It must be removed to mathematically achieve your target.`
        };
      }
    }
  }

  // Gap Analysis (Looking for massive shortfalls)
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

  // If we missed a significant target (> 5g) by more than 15%, NNLS hit a wall.
  // We need a dedicated ingredient added to the recipe to unlock the math.
  if (worstShortfall.target > 5 && worstShortfall.gap / worstShortfall.target > 0.15) {
    return {
      isFeasible: false,
      failureType: 'ADD',
      targetMacro: worstShortfall.macro,
      failureReason: `Deficiency Conflict: The recipe cannot reach the ${worstShortfall.macro} target without overshooting other limits.`,
      offendingIngredient: null
    };
  }

  // Coupling Analysis (Needs a SWAP)
  // If we don't have a massive gaping hole, it means our ingredients are fighting each other.
  // (e.g., attempting a zero-carb target using beans as the protein source).
  // Target the heaviest ingredient as the likely anchor dragging the math down.
  const offendingIngredient = activeIngredients.reduce((prev, current) =>
    (prev.weightInGrams || 0) > (current.weightInGrams || 0) ? prev : current
  );

  return {
    isFeasible: false,
    failureType: 'SWAP',
    offendingIngredient: offendingIngredient.name,
    targetMacro: null,
    failureReason: `Coupled Variable Conflict: The macro profile of '${offendingIngredient.name}' prevents balanced scaling.`
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

  const seasonings = [];
  const activeIngredients = [];
  const seasoningMacros = { protein: 0, fat: 0, netCarbs: 0 };

  ingredients.forEach((ing) => {
    if (isSeasoning(ing)) {
      seasonings.push(ing);
      seasoningMacros.protein += ing.nutrition?.protein || 0;
      seasoningMacros.fat += ing.nutrition?.fat || 0;
      seasoningMacros.netCarbs += ing.nutrition?.netCarbs || 0;
    } else {
      activeIngredients.push(ing);
    }
  });

  const adjustedTargets = {
    protein: Math.max(0, targets.protein - seasoningMacros.protein),
    fat: Math.max(0, targets.fat - seasoningMacros.fat),
    netCarbs: Math.max(0, targets.netCarbs - seasoningMacros.netCarbs)
  };

  if (activeIngredients.length === 0) {
    console.warn(`[MacroBalancer] WARNING: No active ingredients found after seasoning gate.`);
    // Pass a dummy achieved object of 0s so the diagnostic engine forces an ADD
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
  // This pads the matrix to make it taller than it is wide (m > n) to satisfy ml-matrix SVD,
  // and gives the matrix full column rank to prevent NNLS infinite iteration loops.
  const lambda = 0.0001;
  activeIngredients.forEach((_, i) => {
    const regRow = new Array(activeIngredients.length).fill(0);
    regRow[i] = lambda;

    A_arr.push(regRow);
    b_arr.push(0); // The target for the regularization penalty is 0
  });

  // Compile the final strictly-feasible matrices
  const A = new Matrix(A_arr);
  const b = Matrix.columnVector(b_arr);

  let multipliers = [];

  try {
    const result = nnls(A, b);
    multipliers = result.x.to1DArray().map((val) => (val < 1e-10 ? 0 : val));
  } catch (err) {
    console.error(`[MacroBalancer] Phase 4 Error: NNLS failure.`, err.message);
    multipliers = new Array(activeIngredients.length).fill(0);
  }

  // Re-calculate the achieved macros
  const achieved = calculateDelivery(activeIngredients, multipliers);

  const pTol = adjustedTargets.protein * TIER + 0.1;
  const fTol = adjustedTargets.fat * TIER + 0.1;
  const cTol = adjustedTargets.netCarbs * TIER + 0.1;

  const isProteinValid = Math.abs(achieved.protein - adjustedTargets.protein) <= pTol;
  const isFatValid = Math.abs(achieved.fat - adjustedTargets.fat) <= fTol;
  const isCarbsValid = Math.abs(achieved.netCarbs - adjustedTargets.netCarbs) <= cTol;

  const isFeasible = isProteinValid && isFatValid && isCarbsValid;

  console.log(`[MacroBalancer] Phase 5: Achieved Macros vs Targets:`);
  console.log(
    `   Protein:  ${achieved.protein.toFixed(1)} / ${adjustedTargets.protein}  (Tol: ±${pTol.toFixed(1)}) -> ${isProteinValid ? 'PASS' : 'FAIL'}`
  );
  console.log(
    `   Fat:      ${achieved.fat.toFixed(1)} / ${adjustedTargets.fat}  (Tol: ±${fTol.toFixed(1)}) -> ${isFatValid ? 'PASS' : 'FAIL'}`
  );
  console.log(
    `   NetCarbs: ${achieved.netCarbs.toFixed(1)} / ${adjustedTargets.netCarbs}  (Tol: ±${cTol.toFixed(1)}) -> ${isCarbsValid ? 'PASS' : 'FAIL'}`
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

  // Pass the achieved data into the diagnostic engine for accurate gap analysis
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
