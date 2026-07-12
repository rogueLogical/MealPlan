const { GoogleGenAI, Type } = require('@google/genai');

// Initialize the google genAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'test_dummy_gemini_api_key'
});

// Dietary restriction tags matching the allowed tag rules
const ALLOWED_TAGS = [
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Paleo',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Shellfish-Free',
  'Soy-Free',
  'Kosher',
  'Halal'
];

// Define the exact JSON schema the AI must adhere to.
const suggestionSchema = {
  type: Type.ARRAY,
  description: 'A list of exactly 3 ingredient suggestions.',
  items: {
    type: Type.OBJECT,
    properties: {
      ingredientName: {
        type: Type.STRING,
        description: "The name of the recommended ingredient in plain text (e.g., 'Ground Turkey')."
      },
      reasonForRecommendation: {
        type: Type.STRING,
        description:
          'A brief culinary and nutritional explanation of why this fixes the specific macro conflict.'
      }
    },
    required: ['ingredientName', 'reasonForRecommendation']
  }
};

/**
 * Queries Gemini to resolve a macronutrient matrix conflict.
 * @param {Object} context - The failure context from the LP Solver.
 * @returns {Promise<Array>} Array of 3 ingredient suggestion objects.
 */
const getAiSuggestions = async (context) => {
  const {
    failureType,
    failureReason,
    offendingIngredient,
    targetMacro,
    dietaryRestrictions = [],
    currentIngredients = [],
    zeroTargets = []
  } = context;

  const restrictionText =
    dietaryRestrictions.length > 0
      ? `You MUST strictly adhere to these dietary restrictions: ${dietaryRestrictions.join(', ')}.`
      : 'No specific dietary restrictions apply.';

  let prompt = `You are an expert culinary and nutritional AI assistant.\n\n`;
  prompt += `We are balancing a recipe mathematically, but the algorithm hit a wall. \n`;
  prompt += `Current ingredients in the recipe: [${currentIngredients.join(', ')}]\n`;
  prompt += `${restrictionText}\n\n`;

  // --- Strict Ingredient Naming Constraints ---
  prompt += `CRITICAL INGREDIENT NAMING RULES:\n`;
  prompt += `- You MUST suggest ingredients using their standard, plain-English canonical names (e.g., "duck fat", "garlic powder", "olive oil").\n`;
  prompt += `- DO NOT use descriptive adjectives, grades, qualities, or brands (e.g., do NOT suggest "extra virgin olive oil", "organic grass-fed butter", or "gourmet duck fat"). Just use "olive oil", "butter", or "duck fat".\n`;
  prompt += `- DO NOT attempt to write inverted database syntax (e.g., do NOT write "Oil, olive" or "Fat, duck"). Keep it in natural, clean, lowercase singular English nouns.\n`;
  prompt += `- This is critical because your suggestions are sent directly to the USDA database search engine, which behaves poorly when over-constrained with descriptors.\n\n`;

  if (failureType === 'SWAP') {
    // this SWAP prompt logic left here purposefully, although it is not currently used
    prompt += `THE CONFLICT: ${failureReason}\n`;
    prompt += `TASK: We must SWAP OUT '${offendingIngredient}' for an ingredient that provides more '${targetMacro}'. \n`;
    prompt += `Provide exactly 4 alternative ingredients to replace '${offendingIngredient}' that will resolve the conflict, fit the culinary profile of the current ingredients, and adhere to all dietary restrictions.\n`;
  } else if (failureType === 'ADD') {
    prompt += `THE CONFLICT: ${failureReason}\n`;
    prompt += `TASK: We are completely missing a viable source of '${targetMacro}'. \n`;
    prompt += `Provide exactly 5 completely new ingredients to ADD to this recipe. They must be dense sources of ${targetMacro}, be low in the other two macronutrients, pair beautifully with the current ingredients, and adhere to all dietary restrictions.\n`;
  }

  if (zeroTargets.length > 0) {
    prompt += `The recipe also has a target of 0 grams of the following macronutrients: [${zeroTargets.join(', ')}] \n do not suggest ingredients that contain those macronutrients.`;
  }

  // Execute the AI call using the new Interactions API format
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite', // The model with the highest number of requests per day (500 per day) for the free tier.
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: suggestionSchema,
        temperature: 0.7, // Low temperature for analytical precision
        thinkingConfig: {
          thinkingLevel: 'medium' // Medium thinking level for ensuring restrictions are followed while limiting token usage somewhat
        }
      }
    });

    // Parse the JSON response
    const suggestions = JSON.parse(response.text);

    return suggestions.slice(0, 3);
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    throw new Error('Failed to generate AI culinary suggestions.', error);
  }
};

/**
 * Queries Gemini to apply dietary/semantic tags to a newly resolved USDA ingredient.
 * @param {string} ingredientName
 * @returns {Promise<Array>} Array of matched dietary tags.
 */
const getDietaryTagsForIngredient = async (ingredientName) => {
  const prompt = `
    Analyze the raw food ingredient: "${ingredientName}".
    Identify which of the following allowed dietary tags strictly apply to it.
    
    Allowed Tags ONLY: ${JSON.stringify(ALLOWED_TAGS)}
    
    Respond ONLY with a JSON array of strings containing the matched tags (e.g., ["Dairy-Free", "Gluten-Free"]).
    If none apply, return an empty array [].
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1 // Kept low for deterministic tagging
      }
    });

    const tags = JSON.parse(response.text);
    return Array.isArray(tags) ? tags : [];
  } catch (error) {
    console.warn(
      `[AI Tagger] Failed to semantically tag ingredient "${ingredientName}". Falling back to an empty array. Error:`,
      error.message
    );
    return [];
  }
};

module.exports = { getAiSuggestions, getDietaryTagsForIngredient };
