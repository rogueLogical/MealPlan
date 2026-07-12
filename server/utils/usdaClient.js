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
const extractNutrient = (foodItem, nutrientId) => {
  const nutrient = foodItem.foodNutrients.find((n) => n.nutrientId === nutrientId);
  return nutrient ? nutrient.value : 0;
};

// Normalizes strings by lowercasing and cleaning punctuation for uniform comparison
const normalizeString = (str) => {
  return (str || '')
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
};

// Computes a similarity score based on keyword overlap and macro validation
const calculateMatchScore = (query, food) => {
  const description = food.description;
  const normalizedQuery = normalizeString(query);
  const normalizedDesc = normalizeString(description);

  const queryWords = normalizedQuery.split(' ');
  const descWords = normalizedDesc.split(' ');

  // Count how many unique query words are present in the item description
  let matchCount = 0;
  queryWords.forEach((word) => {
    if (descWords.includes(word)) {
      matchCount++;
    }
  });

  const queryCoverage = matchCount / queryWords.length;
  let score = queryCoverage * 100;

  // Exact Match Bonus
  if (normalizedQuery === normalizedDesc) {
    score += 50;
  }

  // Substring Match Bonus
  if (normalizedDesc.includes(normalizedQuery) || normalizedQuery.includes(normalizedDesc)) {
    score += 20;
  }

  // Sorted Word Match Bonus (e.g. "Avocado Oil" matches "Oil, avocado" exactly when sorted)
  const sortedQuery = [...queryWords].sort().join(' ');
  const sortedDesc = [...descWords].sort().join(' ');
  if (sortedQuery === sortedDesc) {
    score += 40;
  }

  // --- Domain-Specific Nutritional Safeguards ---
  const fatKeywords = ['fat', 'oil', 'lard', 'tallow', 'butter', 'ghee', 'shortening'];
  const hasFatKeywordInQuery = fatKeywords.some((keyword) => normalizedQuery.includes(keyword));
  const hasFatKeywordInDesc = fatKeywords.some((keyword) => normalizedDesc.includes(keyword));

  if (hasFatKeywordInQuery) {
    const protein = extractNutrient(food, NUTRIENT_IDS.PROTEIN);
    const fat = extractNutrient(food, NUTRIENT_IDS.FAT);

    // Safeguard 1: If looking for fat/oil, penalize non-fatty items (e.g. meat, raw fruits)
    if (fat < 50 || protein > fat) {
      score -= 150;
    }
  } else if (hasFatKeywordInDesc) {
    // Safeguard 2: If the query does NOT ask for fat/oil, but the description is a fat/oil,
    // penalize it so the whole food (like raw avocado) is preferred.
    score -= 100;
  }

  return score;
};

/**
 * Queries the USDA API for an ingredient and returns verified macros per 100g.
 * Filters the top 30 matches to find the mathematically closest name match.
 * @param {string} query - The ingredient name to search for.
 * @returns {Promise<Object>} { protein, fat, netCarbs }
 */
const fetchUsdaMacros = async (query) => {
  if (!USDA_API_KEY) {
    throw new Error('Missing USDA_API_KEY in environment variables.');
  }

  try {
    const url = new URL(USDA_SEARCH_URL);
    url.searchParams.append('api_key', USDA_API_KEY);
    url.searchParams.append('query', query);
    url.searchParams.append('dataType', 'Foundation,SR Legacy');
    url.searchParams.append('pageSize', '30'); // Fix: Increased search results to expand candidate recall pool

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.warn(
        `USDA API responded with status: ${response.status} for query "${query}". Returning zeroed fallback.`
      );
      return { protein: 0, fat: 0, totalCarbs: 0, fiber: 0, netCarbs: 0 };
    }

    const data = await response.json();

    if (!data.foods || data.foods.length === 0) {
      console.warn(`No USDA data found for: ${query}. Returning zeroed fallback.`);
      return { protein: 0, fat: 0, netCarbs: 0 };
    }

    // Map each returned food item with its computed match score
    const scoredFoods = data.foods.map((food) => {
      const score = calculateMatchScore(query, food);
      return { food, score };
    });

    // Sort descending by match score to bubble the most accurate description to the top
    scoredFoods.sort((a, b) => b.score - a.score);

    // Pick the best match determined by our scoring algorithm
    const topMatch = scoredFoods[0].food;

    console.log(
      `[USDA Search] Query "${query}" matched with item "${topMatch.description}" ` +
        ` (Score: ${scoredFoods[0].score.toFixed(1)})`
    );

    const protein = extractNutrient(topMatch, NUTRIENT_IDS.PROTEIN);
    const fat = extractNutrient(topMatch, NUTRIENT_IDS.FAT);
    const totalCarbs = extractNutrient(topMatch, NUTRIENT_IDS.CARBS);
    const fiber = extractNutrient(topMatch, NUTRIENT_IDS.FIBER);

    // Calculate Net Carbs
    const netCarbs = Math.max(0, totalCarbs - fiber);

    return {
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
