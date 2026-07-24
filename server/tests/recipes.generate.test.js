const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const Ingredient = require('../models/Ingredient');
const Recipe = require('../models/Recipe');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { generateRecipeFromPrompt } = require('../utils/geminiClient');
const { fetchUsdaMacros } = require('../utils/usdaClient');

// Mock external AI and API calls
jest.mock('../utils/geminiClient', () => ({
  generateRecipeFromPrompt: jest.fn(),
  getDietaryTagsForIngredient: jest.fn().mockResolvedValue([])
}));
jest.mock('../utils/usdaClient', () => ({
  fetchUsdaMacros: jest.fn()
}));

let mongoServer;
let token;
let userId;

describe('POST /api/recipes/generate integration suite', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'local_docker_development_only_secret_key_12345';
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Seed test user profile
    const testUser = await User.create({
      username: 'generationtester',
      email: 'gen@test.com',
      password: 'password123',
      nutritionSettings: {
        dailyMacroTargets: { calories: 2000, protein: 150, netCarbs: 200, fat: 70 },
        dailyMealsCount: 3,
        mealMacroSplitPercentage: { calories: 80, protein: 80, netCarbs: 80, fat: 80 }
      }
    });
    userId = testUser._id;
    token = jwt.sign({ userId }, process.env.JWT_SECRET);

    // Seed a standard ingredient in the DB for local matching (Stage A)
    await Ingredient.create({
      name: 'chicken breast',
      servingSize: 100,
      nutritionPerServing: { protein: 31, totalCarbs: 0, fiber: 0, sugarAlcohols: 0, fat: 3.6 }
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Ingredient.deleteMany({});
    await Recipe.deleteMany({});
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('should successfully execute Stage A local matching, Stage B USDA seeding, and Stage C AI fallback', async () => {
    const aiRecipeResponse = {
      title: 'Trio Bowl',
      description: 'A test trio ingredient bowl.',
      instructions: '1. Chop chicken. 2. Boil rice. 3. Steam broccoli.', // Single-line step output
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      portions: 4,
      tags: ['Keto'],
      ingredients: [
        // Matches Local DB (Stage A)
        { name: 'chicken breast', displayAmount: 1, displayUnit: 'lb', weightInGrams: 400 },
        // Matches USDA database (Stage B)
        { name: 'white rice', displayAmount: 1, displayUnit: 'cup', weightInGrams: 200 },
        // Fails USDA and Local DB (Stage C Fallback)
        {
          name: 'mystic herb',
          displayAmount: 1,
          displayUnit: 'g',
          weightInGrams: 10,
          fallbackNutrition: {
            calories: 40,
            protein: 1,
            totalCarbs: 10,
            fiber: 2,
            sugarAlcohols: 0,
            fat: 0
          }
        }
      ]
    };

    generateRecipeFromPrompt.mockResolvedValue(aiRecipeResponse);

    // Mock USDA to return valid macros for white rice (Stage B)
    fetchUsdaMacros.mockResolvedValueOnce({
      protein: 3,
      fat: 1,
      totalCarbs: 28,
      fiber: 1,
      netCarbs: 27
    });
    // Mock USDA to return null for nonexistent mystic herb (Stage C)
    fetchUsdaMacros.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/recipes/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'Trio Bowl Idea',
        recipeType: 'Meal',
        useMacroTargets: true,
        dietaryRestrictions: []
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.title).toEqual('Trio Bowl');

    // Verify Local DB Match (Stage A): Maps existing ObjectID
    expect(res.body.ingredients[0].ingredientId).toBeDefined();
    expect(res.body.ingredients[0].name).toEqual('chicken breast');

    // Verify USDA Seeding (Stage B): Saves and returns a new ObjectID
    const savedUsdaIngredient = await Ingredient.findOne({ name: 'white rice' });
    expect(savedUsdaIngredient).not.toBeNull();
    expect(res.body.ingredients[1].ingredientId.toString()).toEqual(
      savedUsdaIngredient._id.toString()
    );

    // Verify AI Fallback (Stage C): Returned with null ingredientId (skips DB creation)
    expect(res.body.ingredients[2].ingredientId).toBeNull();
    const missingIngredientCheck = await Ingredient.findOne({ name: 'mystic herb' });
    expect(missingIngredientCheck).toBeNull();

    // Verify Instructions Spacing Format (Enforces dual newlines post-processing)
    expect(res.body.instructions).toContain(
      '1. Chop chicken.\n\n2. Boil rice.\n\n3. Steam broccoli.'
    );
  });
});
