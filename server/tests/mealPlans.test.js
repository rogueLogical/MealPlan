const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const MealPrepPlan = require('../models/MealPrepPlan');
const PortionStorage = require('../models/PortionStorage');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let token;
let userId;
let mockRecipeId;

describe('Meal Prep Plans API', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'local_docker_development_only_secret_key_12345';
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const user = await User.create({
      username: 'plannertester',
      email: 'planner@test.com',
      password: 'password123'
    });
    userId = user._id;
    token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    const recipe = await Recipe.create({
      title: 'Planner Bread',
      recipeType: 'Meal',
      createdBy: userId,
      portions: 2,
      ingredients: [
        {
          ingredientId: new mongoose.Types.ObjectId(),
          name: 'Flour',
          weightInGrams: 200,
          nutrition: {
            calories: 300,
            protein: 10,
            totalCarbs: 60,
            fiber: 2,
            sugarAlcohols: 0,
            netCarbs: 58,
            fat: 1
          }
        }
      ]
    });
    mockRecipeId = recipe._id;
  });

  afterEach(async () => {
    await MealPrepPlan.deleteMany({});
    await PortionStorage.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Recipe.deleteMany({});
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('should create an inactive plan, and then activate it with reset checkpoints', async () => {
    // 1. Create Inactive Plan
    const createRes = await request(app)
      .post('/api/meal-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Week 1 Prep',
        recipes: [{ recipeId: mockRecipeId, plannedPortions: 4 }]
      });

    expect(createRes.statusCode).toEqual(201);
    expect(createRes.body.plan.isActive).toBe(false);

    const planId = createRes.body.plan._id;

    // Manually complete a recipe in database to verify reset during activation
    await MealPrepPlan.updateOne(
      { _id: planId, 'recipes.recipeId': mockRecipeId },
      { $set: { 'recipes.$.isCompleted': true } }
    );

    // 2. Activate the Plan
    const activateRes = await request(app)
      .post(`/api/meal-plans/${planId}/activate`)
      .set('Authorization', `Bearer ${token}`);

    expect(activateRes.statusCode).toEqual(200);
    expect(activateRes.body.plan.isActive).toBe(true);
    // Verify completed status reset to false
    expect(activateRes.body.plan.recipes[0].isCompleted).toBe(false);
  });

  it('should complete planned recipes, logging portions to storage, and support skip storage', async () => {
    const plan = await MealPrepPlan.create({
      userId,
      name: 'Active Plan',
      isActive: true,
      recipes: [{ recipeId: mockRecipeId, plannedPortions: 4, isCompleted: false }]
    });

    // Case A: Complete and log portions (delta = 4)
    const completeRes1 = await request(app)
      .post(`/api/meal-plans/${plan._id}/complete-recipe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recipeId: mockRecipeId });

    expect(completeRes1.statusCode).toEqual(200);
    expect(completeRes1.body.plan.recipes[0].isCompleted).toBe(true);

    const storage = await PortionStorage.findOne({ userId, recipeId: mockRecipeId });
    expect(storage.portionsInStorage).toBe(4);

    // Reset completion status for Case B
    await MealPrepPlan.updateOne(
      { _id: plan._id, 'recipes.recipeId': mockRecipeId },
      { $set: { 'recipes.$.isCompleted': false } }
    );

    // Case B: Complete with 0 portionsToAdd (Skip storage)
    const completeRes2 = await request(app)
      .post(`/api/meal-plans/${plan._id}/complete-recipe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recipeId: mockRecipeId, portionsToAdd: 0 });

    expect(completeRes2.statusCode).toEqual(200);

    // Storage should remain unchanged at 4
    const storageAfter = await PortionStorage.findOne({ userId, recipeId: mockRecipeId });
    expect(storageAfter.portionsInStorage).toBe(4);
  });

  it('should prevent deleting an active plan, but successfully delete an inactive plan', async () => {
    const activePlan = await MealPrepPlan.create({
      userId,
      name: 'Active Plan',
      isActive: true,
      recipes: []
    });

    const inactivePlan = await MealPrepPlan.create({
      userId,
      name: 'Inactive Plan',
      isActive: false,
      recipes: []
    });

    // Try deleting active plan
    const deleteActiveRes = await request(app)
      .delete(`/api/meal-plans/${activePlan._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteActiveRes.statusCode).toEqual(400);

    // Delete inactive plan
    const deleteInactiveRes = await request(app)
      .delete(`/api/meal-plans/${inactivePlan._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteInactiveRes.statusCode).toEqual(200);
  });
});
