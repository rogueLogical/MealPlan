const { GoogleGenAI, Type } = require('@google/genai');

// Initialize the new unified client
// It will automatically pick up process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({});

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
    currentIngredients = []
  } = context;

  // Format dietary restrictions string
  const restrictionText =
    dietaryRestrictions.length > 0
      ? `You MUST strictly adhere to these dietary restrictions: ${dietaryRestrictions.join(', ')}.`
      : 'No specific dietary restrictions apply.';

  // Build the dynamic prompt based on whether we are SWAPPING or ADDING
  let prompt = `You are an expert culinary and nutritional AI assistant.\n\n`;
  prompt += `We are balancing a recipe mathematically, but the algorithm hit a wall. \n`;
  prompt += `Current ingredients in the recipe: [${currentIngredients.join(', ')}]\n`;
  prompt += `${restrictionText}\n\n`;

  if (failureType === 'SWAP') {
    prompt += `THE CONFLICT: ${failureReason}\n`;
    prompt += `TASK: We must SWAP OUT '${offendingIngredient}'. \n`;
    prompt += `Provide exactly 3 alternative ingredients to replace '${offendingIngredient}' that will resolve the conflict, fit the culinary profile of the current ingredients, and adhere to all dietary restrictions.\n`;
  } else if (failureType === 'ADD') {
    prompt += `THE CONFLICT: ${failureReason}\n`;
    prompt += `TASK: We are completely missing a viable source of '${targetMacro}'. \n`;
    prompt += `Provide exactly 3 completely new ingredients to ADD to this recipe. They must be dense sources of ${targetMacro}, pair beautifully with the current ingredients, and adhere to all dietary restrictions.\n`;
  }

  // Execute the AI call using the new Interactions API format
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite', // The model with the highest number of requests per day (500 per day) for the free tier.
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: suggestionSchema,
        temperature: 0.2, // Low temperature for analytical precision
        thinkingConfig: {
          thinkingLevel: 'low' // Low thinking level for quick and short responses, as well as to save on tokens
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

module.exports = { getAiSuggestions };
