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

// Computes a similarity score based on keyword overlap, length penalties, and macro validation
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

  // Query words coverage of the description
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

  // Description Coverage Scaling: penalizes long, cluttered descriptions (prepared products)
  const descCoverage = matchCount / descWords.length;
  score = score * (0.6 + 0.4 * descCoverage);

  // Semantic Prepared-Food Safeguard: penalizes prepared/composite foods when searching for base items
  const compositeKeywords = [
    'taco',
    'dinner',
    'babyfood',
    'baby food',
    'sandwich',
    'burger',
    'pizza',
    'soup',
    'restaurant',
    'fast food',
    'prepared',
    'beverage',
    'snack bar',
    'candy bar',
    'pot pie',
    'lasagna',
    'macaroni and cheese',
    'casserole'
  ];
  const hasCompositeInDesc = compositeKeywords.some((keyword) => normalizedDesc.includes(keyword));
  const hasCompositeInQuery = compositeKeywords.some((keyword) =>
    normalizedQuery.includes(keyword)
  );

  if (hasCompositeInDesc && !hasCompositeInQuery) {
    score -= 50; // Heavily penalize composite prepared foods
  }

  // --- Domain-Specific Nutritional Safeguards ---
  const fatKeywords = ['fat', 'oil', 'lard', 'tallow', 'butter', 'ghee', 'shortening'];
  const hasFatKeywordInQuery = fatKeywords.some((keyword) => normalizedQuery.includes(keyword));
  const hasFatKeywordInDesc = fatKeywords.some((keyword) => normalizedDesc.includes(keyword));

  if (hasFatKeywordInQuery) {
    const protein = extractNutrient(food, NUTRIENT_IDS.PROTEIN);
    const fat = extractNutrient(food, NUTRIENT_IDS.FAT);

    if (fat < 50 || protein > fat) {
      score -= 150;
    }
  } else if (hasFatKeywordInDesc) {
    score -= 100;
  }

  return score;
};

/**
 * Queries the USDA API for an ingredient and returns verified macros per 100g.
 * Filters the top 30 matches to find the mathematically closest name match.
 * @param {string} query - The ingredient name to search for.
 * @returns {Promise<Object|null>} { protein, fat, netCarbs } or null if no reliable match
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
    url.searchParams.append('pageSize', '30');

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.warn(
        `USDA API responded with status: ${response.status} for query "${query}". Returning null.`
      );
      // Return null on failure
      return null;
    }

    const data = await response.json();

    if (!data.foods || data.foods.length === 0) {
      console.warn(`No USDA data found for: ${query}. Returning null.`);
      // Return null on empty search
      return null;
    }

    // Map each returned food item with its computed match score
    const scoredFoods = data.foods.map((food) => {
      const score = calculateMatchScore(query, food);
      return { food, score };
    });

    // Sort descending by match score
    scoredFoods.sort((a, b) => b.score - a.score);

    // Pick the best match
    const bestMatch = scoredFoods[0];

    // Reject match if score is below the strict similarity threshold
    const MIN_MATCH_SCORE = 80;
    if (bestMatch.score < MIN_MATCH_SCORE) {
      console.log(
        `[USDA Search] Best match "${bestMatch.food.description}" scored ${bestMatch.score.toFixed(1)} for query "${query}", which is below threshold ${MIN_MATCH_SCORE}. Rejecting match.`
      );
      return null;
    }

    const topMatch = bestMatch.food;

    console.log(
      `[USDA Search] Query "${query}" matched with item "${topMatch.description}" ` +
        ` (Score: ${bestMatch.score.toFixed(1)})`
    );

    const protein = Math.max(0, extractNutrient(topMatch, NUTRIENT_IDS.PROTEIN));
    const fat = Math.max(0, extractNutrient(topMatch, NUTRIENT_IDS.FAT));
    const totalCarbs = Math.max(0, extractNutrient(topMatch, NUTRIENT_IDS.CARBS));
    const fiber = Math.max(0, extractNutrient(topMatch, NUTRIENT_IDS.FIBER));

    // Calculate Net Carbs safely
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
