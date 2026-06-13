const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server'); // Corrected relative path
const User = require('../models/User'); // Corrected relative path
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

describe('User Settings API Operations Contract Test Suite', () => {
  let mockToken;
  let mockUserId;

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

    // Generate a valid signed JWT bearer token matching our auth middleware constraints
    mockToken = jwt.sign(
      { userId: mockUserId },
      process.env.JWT_SECRET || 'local_docker_development_only_secret_key_12345'
    );
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('should successfully update measurement and macronutrient configuration targets when providing a valid token', async () => {
    const res = await request(app)
      .put('/api/users/settings')
      .set('Authorization', `Bearer ${mockToken}`) // Attach our authorization interceptor token
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
            carbs: 80,
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
    expect(res.body.nutritionSettings.mealMacroSplitPercentage.carbs).toEqual(80);
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
});
