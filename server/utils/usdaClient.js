const USDA_API_KEY = process.env.USDA_API_KEY;
const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// USDA FoodData Central specific Nutrient IDs
const NUTRIENT_IDS = {
  PROTEIN: 1003,
  FAT: 1004,
  CARBS: 1005, // Carbohydrate, by difference
  FIBER: 1079 // Fiber, total dietary
};

// Helper function to extract a specific nutrient value from the USDA payload.
// Returns 0 if the nutrient is not found to prevent NaN math errors.
const extractNutrient = (foodItems, nutrientId) => {
  const nutrient = foodItems.foodNutrients.find((n) => n.nutrientId === nutrientId);
  return nutrient ? nutrient.value : 0;
};

/**
 * Queries the USDA API for an ingredient and returns verified macros per 100g.
 * @param {string} query - The ingredient name to search for.
 * @returns {Promise<Object>} { protein, fat, netCarbs }
 */
const fetchUsdaMacros = async (query) => {
  if (!USDA_API_KEY) {
    throw new Error('Missing USDA_API_KEY in environment variables.');
  }

  try {
    // Construct the query targeting standard, single-ingredient foods
    // We prioritize "Foundation" and "SR Legacy" data types as they contain
    // the most accurate, unbranded raw ingredient data.
    const url = new URL(USDA_SEARCH_URL);
    url.searchParams.append('api_key', USDA_API_KEY);
    url.searchParams.append('query', query);
    url.searchParams.append('dataType', 'Foundation,SR Legacy');
    url.searchParams.append('pageSize', '1'); // We only need the top match

    // Execute the fetch request
    const response = await fetch(url.toString());

    // Catch 400 Bad Request (or any non-200 status) and return a zeroed fallback
    // instead of throwing an error that crashes the Promise.all array.
    if (!response.ok) {
      console.warn(
        `USDA API responded with status: ${response.status} for query "${query}". Returning zeroed fallback.`
      );
      return { protein: 0, fat: 0, totalCarbs: 0, fiber: 0, netCarbs: 0 };
    }

    const data = await response.json();

    // Handle zero-results scenario
    if (!data.foods || data.foods.length === 0) {
      console.warn(`No USDA data found for: ${query}. Returning zeroed fallback.`);
      // If the AI hallucinates a food that doesn't exist, we return zeroes
      // rather than crashing the server.
      return { protein: 0, fat: 0, netCarbs: 0 };
    }

    // Extract the exact math from the top matched food item
    const topMatch = data.foods[0];

    const protein = extractNutrient(topMatch, NUTRIENT_IDS.PROTEIN);
    const fat = extractNutrient(topMatch, NUTRIENT_IDS.FAT);
    const totalCarbs = extractNutrient(topMatch, NUTRIENT_IDS.CARBS);
    const fiber = extractNutrient(topMatch, NUTRIENT_IDS.FIBER);

    // Calculate Net Carbs
    const netCarbs = Math.max(0, totalCarbs - fiber);

    // Return the normalized payload to the Express controller
    return {
      // USDA values are universally provided per 100g
      protein: parseFloat(protein.toFixed(2)),
      fat: parseFloat(fat.toFixed(2)),
      totalCarbs: parseFloat(totalCarbs.toFixed(2)),
      fiber: parseFloat(fiber.toFixed(2)),
      netCarbs: parseFloat(netCarbs.toFixed(2))
    };
  } catch (error) {
    console.error(`Error fetching USDA data for ${query}:`, error);
    throw new Error(`Failed to verify nutritional data for ${query}`, { cause: error });
  }
};

module.exports = { fetchUsdaMacros };
