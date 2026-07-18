const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const MealPrepPlan = require('../models/MealPrepPlan');
const ShoppingList = require('../models/ShoppingList');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let token;
let userId;
let mockRecipeId;

describe('Shopping List API & Consolidation', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'local_docker_development_only_secret_key_12345';
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const user = await User.create({
      username: 'listtester',
      email: 'list@test.com',
      password: 'password123'
    });
    userId = user._id;
    token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    const recipe = await Recipe.create({
      title: 'Consolidated Pasta',
      recipeType: 'Meal',
      createdBy: userId,
      portions: 2,
      ingredients: [
        {
          ingredientId: new mongoose.Types.ObjectId(),
          name: 'Onion',
          weightInGrams: 100,
          displayAmount: 1,
          displayUnit: 'pieces',
          nutrition: {
            calories: 40,
            protein: 1,
            totalCarbs: 9,
            fiber: 1,
            sugarAlcohols: 0,
            netCarbs: 8,
            fat: 0
          }
        }
      ]
    });
    mockRecipeId = recipe._id;
  });

  afterEach(async () => {
    await ShoppingList.deleteMany({});
    await MealPrepPlan.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Recipe.deleteMany({});
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('should generate, append, and consolidate plan ingredients into the shopping list', async () => {
    const plan = await MealPrepPlan.create({
      userId,
      name: 'My Plan',
      isActive: true,
      recipes: [{ recipeId: mockRecipeId, plannedPortions: 4 }] // multiplier = 4/2 = 2x
    });

    // 1. Initial Append (Adds 2 pieces (200g) onion)
    const appendRes1 = await request(app)
      .post('/api/shopping-list/append-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: plan._id });

    expect(appendRes1.statusCode).toEqual(200);
    expect(appendRes1.body.list.items).toHaveLength(1);
    expect(appendRes1.body.list.items[0].quantity).toBe(2);
    expect(appendRes1.body.list.items[0].weightInGrams).toBe(200);
    expect(appendRes1.body.list.items[0].isChecked).toBe(false);

    const itemId = appendRes1.body.list.items[0]._id;

    // 2. Complete check (mark isChecked = true)
    await request(app)
      .patch(`/api/shopping-list/item/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isChecked: true });

    // 3. Append again. Since isChecked is true, it should REPLACE the quantity and uncheck!
    const appendRes2 = await request(app)
      .post('/api/shopping-list/append-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: plan._id });

    expect(appendRes2.statusCode).toEqual(200);
    expect(appendRes2.body.list.items[0].quantity).toBe(2); // Replaced, not summed (2 instead of 4)
    expect(appendRes2.body.list.items[0].isChecked).toBe(false); // Unchecked
  });

  it('should add manual custom items and correctly toggle checked state via PATCH', async () => {
    await ShoppingList.create({
      userId,
      items: []
    });

    // Add item
    const addRes = await request(app)
      .post('/api/shopping-list/item')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Napkins', quantity: 2, unit: 'packs' });

    expect(addRes.statusCode).toEqual(201);
    expect(addRes.body.list.items[0].name).toBe('Napkins');

    const itemId = addRes.body.list.items[0]._id;

    // Toggle checked state
    const toggleRes = await request(app)
      .patch(`/api/shopping-list/item/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isChecked: true });

    expect(toggleRes.statusCode).toEqual(200);
    expect(toggleRes.body.list.items[0].isChecked).toBe(true);
  });
});
