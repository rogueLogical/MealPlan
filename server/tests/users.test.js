const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

describe('User Settings API Operations Contract Test Suite', () => {
  let mockToken;
  let mockUserId;
  let mockRecipeId;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'local_docker_development_only_secret_key_12345';
    mongoServer = await MongoMemoryServer.create();
    const testMongoURI = mongoServer.getUri();
    await mongoose.connect(testMongoURI);

    // Seed a standard dummy testing account profile configuration
    const testUser = new User({
      username: 'settingstester',
      email: 'settings@test.com',
      password: 'password123'
    });
    await testUser.save();
    mockUserId = testUser._id;

    // Seed a recipe for recently viewed tests
    const recipe = await Recipe.create({
      title: 'Recently Viewed Test Recipe',
      recipeType: 'Meal',
      createdBy: mockUserId,
      portions: 2,
      ingredients: [
        {
          name: 'Chicken',
          weightInGrams: 150,
          nutrition: {
            calories: 200,
            protein: 30,
            totalCarbs: 0,
            fiber: 0,
            sugarAlcohols: 0,
            netCarbs: 0,
            fat: 5
          }
        }
      ]
    });
    mockRecipeId = recipe._id;

    // Generate a valid signed JWT bearer token matching our auth middleware constraints
    mockToken = jwt.sign(
      { userId: mockUserId },
      process.env.JWT_SECRET || 'local_docker_development_only_secret_key_12345'
    );
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Recipe.deleteMany({});
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('should successfully update measurement and macronutrient configuration targets and set hasConfiguredSettings: true', async () => {
    const res = await request(app)
      .put('/api/users/settings')
      .set('Authorization', `Bearer ${mockToken}`)
      .send({
        measurementSystem: 'metric',
        nutritionSettings: {
          dailyMacroTargets: { calories: 2500, protein: 180 }
        }
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.settings.measurementSystem).toEqual('metric');
    expect(res.body.nutritionSettings.dailyMacroTargets.calories).toEqual(2500);
    expect(res.body.nutritionSettings.dailyMacroTargets.protein).toEqual(180);
    expect(res.body.hasConfiguredSettings).toBe(true);
  });

  it('should successfully update daily meal structure and macro split percentages', async () => {
    // Dispatch an update request populated with the new structure layout
    const res = await request(app)
      .put('/api/users/settings')
      .set('Authorization', `Bearer ${mockToken}`)
      .send({
        nutritionSettings: {
          dailyMealsCount: 4,
          dailySnacksCount: 1,
          mealMacroSplitPercentage: {
            calories: 85,
            protein: 90,
            netCarbs: 80,
            fat: 85
          }
        }
      });

    // Verify the server accepted the request
    expect(res.statusCode).toEqual(200);

    // Verify the returned user profile correctly saved the exact integers
    expect(res.body.nutritionSettings.dailyMealsCount).toEqual(4);
    expect(res.body.nutritionSettings.dailySnacksCount).toEqual(1);

    // Verify the nested split object persisted properly
    expect(res.body.nutritionSettings.mealMacroSplitPercentage.protein).toEqual(90);
    expect(res.body.nutritionSettings.mealMacroSplitPercentage.netCarbs).toEqual(80);
  });

  it('should dismiss welcome banner via POST /api/users/dismiss-welcome', async () => {
    const res = await request(app)
      .post('/api/users/dismiss-welcome')
      .set('Authorization', `Bearer ${mockToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.user.dismissedWelcomeBanner).toBe(true);
  });

  it('should record and fetch recently viewed recipes', async () => {
    // 1. Record view
    const recordRes = await request(app)
      .post(`/api/users/recently-viewed/${mockRecipeId}`)
      .set('Authorization', `Bearer ${mockToken}`);

    expect(recordRes.statusCode).toEqual(200);
    expect(recordRes.body.success).toBe(true);

    // 2. Fetch recently viewed
    const fetchRes = await request(app)
      .get('/api/users/recently-viewed')
      .set('Authorization', `Bearer ${mockToken}`);

    expect(fetchRes.statusCode).toEqual(200);
    expect(fetchRes.body.data.length).toBeGreaterThan(0);
    expect(fetchRes.body.data[0]._id.toString()).toBe(mockRecipeId.toString());
  });

  it('should explicitly reject adjustments with a 401 when the Authorization header is missing', async () => {
    const res = await request(app).put('/api/users/settings').send({ measurementSystem: 'metric' });

    expect(res.statusCode).toEqual(401);
  });

  it('should successfully update dietary restrictions and culinary preference arrays', async () => {
    // Dispatch an update request populated with the new array structures
    const res = await request(app)
      .put('/api/users/settings')
      .set('Authorization', `Bearer ${mockToken}`)
      .send({
        nutritionSettings: {
          dietaryRestrictions: ['Vegetarian', 'Nut Allergy'],
          likedFoods: ['Tofu', 'Broccoli', 'Spinach'],
          dislikedFoods: ['Beef', 'Pork']
        }
      });

    // Verify the server accepted the request
    expect(res.statusCode).toEqual(200);

    // Verify the returned user profile contains the exact arrays we sent
    expect(res.body.nutritionSettings.dietaryRestrictions).toContain('Vegetarian');
    expect(res.body.nutritionSettings.dietaryRestrictions).toHaveLength(2);

    expect(res.body.nutritionSettings.likedFoods).toContain('Spinach');
    expect(res.body.nutritionSettings.likedFoods).toHaveLength(3);

    expect(res.body.nutritionSettings.dislikedFoods).toContain('Pork');
  });

  it('should add a recipe to favorites if it is not already favorited', async () => {
    const mockUser = {
      _id: 'mockUserId123',
      favoriteRecipes: [], // Empty initially
      save: jest.fn().mockResolvedValue(true)
    };

    User.findById = jest.fn().mockResolvedValue(mockUser);

    const response = await request(app)
      .post('/api/users/favorites/recipe123')
      .set('Authorization', `Bearer ${mockToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.isFavorite).toBe(true);
    expect(mockUser.favoriteRecipes).toContain('recipe123');
    expect(mockUser.save).toHaveBeenCalled();
  });

  it('should remove a recipe from favorites if it is already favorited', async () => {
    const mockUser = {
      _id: 'mockUserId123',
      favoriteRecipes: ['recipe123'], // Already favorited
      save: jest.fn().mockResolvedValue(true)
    };

    User.findById = jest.fn().mockResolvedValue(mockUser);

    const response = await request(app)
      .post('/api/users/favorites/recipe123')
      .set('Authorization', `Bearer ${mockToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.isFavorite).toBe(false);
    expect(mockUser.favoriteRecipes).not.toContain('recipe123');
    expect(mockUser.save).toHaveBeenCalled();
  });
});
