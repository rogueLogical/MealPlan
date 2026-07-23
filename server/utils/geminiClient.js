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

// Unified tag definitions matching client availableTags list
const RECIPE_ALLOWED_TAGS = [
  'Keto',
  'Low-Carb',
  'High-Protein',
  'High-Fat',
  'High-Fiber',
  'High-Carb',
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Paleo',
  'Kosher',
  'Halal',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Shellfish-Free',
  'Soy-Free'
];

const recipeGenerationSchema = {
  type: Type.OBJECT,
  description: 'Structured recipe matching database specifications.',
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    instructions: {
      type: Type.STRING,
      description:
        'Detailed step-by-step instructions. Use line breaks or paragraphs where necessary.'
    },
    prepTimeMinutes: { type: Type.INTEGER },
    cookTimeMinutes: { type: Type.INTEGER },
    portions: { type: Type.INTEGER },
    tags: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: RECIPE_ALLOWED_TAGS
      }
    },
    ingredients: {
      type: Type.ARRAY,
      description:
        'Complete list of ingredients, including proteins, vegetables, carbs, fats, seasonings, herbs, and spices.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description:
              "Canonical lowercase singular ingredient name in plain English (e.g. 'chicken breast', 'olive oil'). No qualities, descriptions, or brands."
          },
          displayAmount: {
            type: Type.NUMBER,
            description:
              'The intuitive display quantity of the ingredient matching standard cookbook units (e.g., 3 for garlic cloves, 1 for bone broth, 3 for ground beef, 1.5 for olive oil, 0.25 for salt).'
          },
          displayUnit: {
            type: Type.STRING,
            description:
              "The intuitive unit of measurement matching displayAmount (e.g., 'cloves' for garlic, 'cup' for bone broth, 'lb' for ground beef, 'tbsp' for olive oil, 'tsp' for salt, or 'pieces' as applicable)."
          },
          weightInGrams: {
            type: Type.NUMBER,
            description:
              'Estimated total physical weight of this ingredient in grams used in the entire recipe yield.'
          },
          fallbackNutrition: {
            type: Type.OBJECT,
            description:
              'Baseline nutritional metrics calculated strictly per 100g of the raw ingredient.',
            properties: {
              calories: { type: Type.NUMBER },
              protein: { type: Type.NUMBER },
              totalCarbs: { type: Type.NUMBER },
              fiber: { type: Type.NUMBER },
              sugarAlcohols: { type: Type.NUMBER },
              fat: { type: Type.NUMBER }
            },
            required: ['calories', 'protein', 'totalCarbs', 'fiber', 'sugarAlcohols', 'fat']
          }
        },
        required: ['name', 'displayAmount', 'displayUnit', 'weightInGrams', 'fallbackNutrition']
      }
    }
  },
  required: [
    'title',
    'description',
    'instructions',
    'prepTimeMinutes',
    'cookTimeMinutes',
    'portions',
    'tags',
    'ingredients'
  ]
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

const generateRecipeFromPrompt = async ({
  promptText,
  recipeType,
  targets,
  dietaryRestrictions = []
}) => {
  let prompt = `You are an expert chef and certified dietitian. Generate a delicious recipe matching this user prompt: "${promptText}".\n\n`;
  prompt += `Recipe Classification: ${recipeType}\n`;
  if (dietaryRestrictions.length > 0) {
    prompt += `Strict dietary restriction requirements to follow: [${dietaryRestrictions.join(', ')}]. Every single ingredient in the recipe must comply.\n`;
  }
  if (targets) {
    prompt += `Macro Targets per single portion (Target total recipe macros = target * portions. Assume recipe yields ${targets.portions || 4} portions):\n`;
    prompt += `- Calories: ${targets.calories} kcal\n`;
    prompt += `- Protein: ${targets.protein}g\n`;
    prompt += `- Net Carbs: ${targets.netCarbs}g\n`;
    prompt += `- Fat: ${targets.fat}g\n`;
    prompt += `Design the ingredient selections and proportions so that the calculated macros per portion match these targets within 10-15%.\n\n`;
  }
  prompt += `CRITICAL REQUIREMENTS FOR THE GENERATED FIELDS:\n`;
  prompt += `- INGREDIENTS SPECIFICITY: Be highly specific with raw ingredient names. Especially for ground meats, specify lean-to-fat ratios (e.g., '90/10 ground beef' or '80/20 ground beef'). For poultry, specify skinless and boneless states (e.g., 'boneless skinless chicken breast'). This is critical for USDA matching precision.\n`;
  prompt += `- INCLUDE SEASONINGS AND MINOR ITEMS: You MUST explicitly include all seasonings, spices, oils, acids, and minor herbs (e.g., 'salt', 'black pepper', 'lemon juice', 'dried parsley', 'olive oil', etc.) in the ingredients list. Even if their estimated weights are very low (e.g., 1g to 5g), they must still be defined as separate ingredients rather than merely assumed or written in the instructions text.\n`;
  prompt += `- INGREDIENT MEASUREMENTS: Populate 'displayAmount' and 'displayUnit' with natural, real-world cookbook units rather than default weights (e.g., use '3' and 'cloves' for garlic, '1' and 'cup' for bone broth, '3' and 'lb' for ground beef, '2' and 'pieces' for chicken breast). Ensure that 'weightInGrams' is still populated with the exact estimated physical weight in grams for the total amount of that ingredient.\n`;
  prompt += `- INSTRUCTIONS FORMATTING: Format the 'instructions' field as a step-by-step numbered list. You MUST separate each step from the next using exactly two newlines (\\n\\n). Do not write instructions as a single block of text.\n`;
  prompt += `- TAGS ENFORCEMENT: The 'tags' field array must strictly contain ONLY tags from this list: ${JSON.stringify(RECIPE_ALLOWED_TAGS)}. Do not generate, invent, or include any tag values outside of this set.\n`;
  prompt += `- NUTRIENT ESTS: Ensure the fallbackNutrition object contains the nutritional breakdown per 100g of raw ingredient. Calculate Net Carbs as (Total Carbs - Fiber - Sugar Alcohols).\n`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: recipeGenerationSchema,
        temperature: 0.7
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error('Error inside generateRecipeFromPrompt:', error);
    throw new Error('Failed to generate AI culinary suggestions.', { cause: error });
  }
};

module.exports = { getAiSuggestions, getDietaryTagsForIngredient, generateRecipeFromPrompt };
