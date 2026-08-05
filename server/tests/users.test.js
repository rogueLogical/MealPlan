const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const MealPrepPlan = require('../models/MealPrepPlan');
const ShoppingList = require('../models/ShoppingList');
const PortionStorage = require('../models/PortionStorage');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));
const { sendEmail } = require('../services/emailService');

let mongoServer;

describe('User Settings & Email Change API Operations', () => {
  let mockToken;
  let mockUserId;
  let mockRecipeId;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'local_docker_development_only_secret_key_12345';
    mongoServer = await MongoMemoryServer.create();
    const testMongoURI = mongoServer.getUri();
    await mongoose.connect(testMongoURI);

    const testUser = new User({
      username: 'settingstester',
      email: 'settings@test.com',
      password: 'password123',
      isEmailVerified: true
    });
    await testUser.save();
    mockUserId = testUser._id;

    // Seed a recipe for recently viewed and favorites tests
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

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Recipe.deleteMany({});
    await MealPrepPlan.deleteMany({});
    await ShoppingList.deleteMany({});
    await PortionStorage.deleteMany({});
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

    expect(res.statusCode).toEqual(200);
    expect(res.body.nutritionSettings.dailyMealsCount).toEqual(4);
    expect(res.body.nutritionSettings.dailySnacksCount).toEqual(1);
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
    const recordRes = await request(app)
      .post(`/api/users/recently-viewed/${mockRecipeId}`)
      .set('Authorization', `Bearer ${mockToken}`);

    expect(recordRes.statusCode).toEqual(200);
    expect(recordRes.body.success).toBe(true);

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

    expect(res.statusCode).toEqual(200);
    expect(res.body.nutritionSettings.dietaryRestrictions).toContain('Vegetarian');
    expect(res.body.nutritionSettings.dietaryRestrictions).toHaveLength(2);
    expect(res.body.nutritionSettings.likedFoods).toContain('Spinach');
    expect(res.body.nutritionSettings.likedFoods).toHaveLength(3);
    expect(res.body.nutritionSettings.dislikedFoods).toContain('Pork');
  });

  it('should add a recipe to favorites if it is not already favorited', async () => {
    const response = await request(app)
      .post(`/api/users/favorites/${mockRecipeId}`)
      .set('Authorization', `Bearer ${mockToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.isFavorite).toBe(true);

    const userInDb = await User.findById(mockUserId);
    expect(userInDb.favoriteRecipes.map((id) => id.toString())).toContain(mockRecipeId.toString());
  });

  it('should remove a recipe from favorites if it is already favorited', async () => {
    const response = await request(app)
      .post(`/api/users/favorites/${mockRecipeId}`)
      .set('Authorization', `Bearer ${mockToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.isFavorite).toBe(false);

    const userInDb = await User.findById(mockUserId);
    expect(userInDb.favoriteRecipes.map((id) => id.toString())).not.toContain(
      mockRecipeId.toString()
    );
  });

  it('should update settings without mutating email address via PUT /api/users/settings', async () => {
    const res = await request(app)
      .put('/api/users/settings')
      .set('Authorization', `Bearer ${mockToken}`)
      .send({
        email: 'attempted_override@test.com',
        measurementSystem: 'metric'
      });

    expect(res.statusCode).toEqual(200);

    const userInDb = await User.findById(mockUserId);
    expect(userInDb.email).toEqual('settings@test.com');
  });

  it('should dispatch verification link for email change via POST /api/users/request-email-change', async () => {
    sendEmail.mockClear();

    const res = await request(app)
      .post('/api/users/request-email-change')
      .set('Authorization', `Bearer ${mockToken}`)
      .send({ newEmail: 'brandnewemail@test.com' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toContain('Verification link dispatched');
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const userInDb = await User.findById(mockUserId);
    expect(userInDb.pendingEmail).toEqual('brandnewemail@test.com');
  });

  it('should delete user account and associated data via DELETE /api/users/me (UAT-41)', async () => {
    // Create a temporary user to delete
    const tempUser = new User({
      username: 'deletemeuser',
      email: 'delete@test.com',
      password: 'password123',
      isEmailVerified: true
    });
    await tempUser.save();
    const tempUserId = tempUser._id;

    const tempToken = jwt.sign(
      { userId: tempUserId },
      process.env.JWT_SECRET || 'local_docker_development_only_secret_key_12345'
    );

    // Create associated data
    await MealPrepPlan.create({
      userId: tempUserId,
      name: 'Temp Plan',
      recipes: []
    });

    await ShoppingList.create({
      userId: tempUserId,
      items: []
    });

    await PortionStorage.create({
      userId: tempUserId,
      recipeId: mockRecipeId,
      recipeTitle: 'Test Recipe',
      portionsInStorage: 2
    });

    const tempRecipe = await Recipe.create({
      title: 'Temp Recipe',
      recipeType: 'Meal',
      createdBy: tempUserId,
      portions: 1,
      ingredients: [
        {
          name: 'Flour',
          weightInGrams: 100,
          nutrition: {
            calories: 100,
            protein: 10,
            totalCarbs: 20,
            fiber: 2,
            sugarAlcohols: 0,
            netCarbs: 18,
            fat: 1
          }
        }
      ]
    });

    const res = await request(app)
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${tempToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toContain('deleted successfully');

    // Verify User document deleted
    const userCheck = await User.findById(tempUserId);
    expect(userCheck).toBeNull();

    // Verify associated user records deleted
    const plansCheck = await MealPrepPlan.find({ userId: tempUserId });
    expect(plansCheck.length).toBe(0);

    const listCheck = await ShoppingList.find({ userId: tempUserId });
    expect(listCheck.length).toBe(0);

    const storageCheck = await PortionStorage.find({ userId: tempUserId });
    expect(storageCheck.length).toBe(0);

    // Verify Recipe is soft-deleted per ADR 002
    const recipeCheck = await Recipe.findById(tempRecipe._id);
    expect(recipeCheck.isDeleted).toBe(true);
    expect(recipeCheck.isPublic).toBe(false);
  });
});
