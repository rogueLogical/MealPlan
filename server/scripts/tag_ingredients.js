const fs = require('fs/promises');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const SEED_FILE = path.join(__dirname, '../data/ingredient_foundation_seed.json');
const BATCH_SIZE = 50;
const DELAY_MS = 3000; // 3-second delay between batches to respect free-tier rate limits

// Dietary restriction tags for the AI to apply
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

// Initialize the Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function processBatch(batch) {
  const ingredientNames = batch.map((item) => item.name);

  const prompt = `
    Analyze the following array of raw food ingredients. 
    For each ingredient, return a JSON object mapping the exact ingredient name to an array of applicable dietary tags.
    
    Allowed Tags ONLY: ${JSON.stringify(ALLOWED_TAGS)}
    
    Ingredients to analyze: ${JSON.stringify(ingredientNames)}
    
    Respond ONLY with valid JSON in this exact format:
    {
      "broccoli, raw": ["Vegetarian", "Vegan", "Dairy-Free", "Gluten-Free", "Nut-Free", "Shellfish-Free", "Soy-Free", "Kosher", "Halal"],
      "chicken breast, raw": ["Dairy-Free", "Gluten-Free", "Nut-Free", "Shellfish-Free", "Soy-Free"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        // Force the model to output strict JSON
        responseMimeType: 'application/json',
        temperature: 0.1 // Low temperature for highly deterministic, factual tagging
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error('AI Batch Error:', error.message);
    return null;
  }
}

async function runAITagger() {
  try {
    console.log('Loading seed data...');
    const fileData = await fs.readFile(SEED_FILE, 'utf8');
    const ingredients = JSON.parse(fileData);

    console.log(`Starting AI Tagging for ${ingredients.length} ingredients...`);

    let processedCount = 0;

    // Loop through the array in batches
    for (let i = 0; i < ingredients.length; i += BATCH_SIZE) {
      const batch = ingredients.slice(i, i + BATCH_SIZE);

      console.log(
        `   Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(ingredients.length / BATCH_SIZE)}...`
      );

      const aiTags = await processBatch(batch);

      if (aiTags) {
        // Merge the AI tags back into the database seed array
        batch.forEach((item) => {
          if (aiTags[item.name]) {
            // Combine existing tags with new AI semantic tags, and use Set to ensure no duplicates
            item.tags = [...new Set([...item.tags, ...aiTags[item.name]])];
          }
        });
        processedCount += batch.length;
      }

      // Respect rate limits before firing the next batch
      if (i + BATCH_SIZE < ingredients.length) {
        await delay(DELAY_MS);
      }
    }

    console.log('Saving updated ingredients to disk...');
    await fs.writeFile(SEED_FILE, JSON.stringify(ingredients, null, 2));

    console.log(`Success! AI successfully tagged ${processedCount} ingredients.`);
  } catch (error) {
    console.error('Fatal error in AI Tagger:', error);
  }
}

runAITagger();
