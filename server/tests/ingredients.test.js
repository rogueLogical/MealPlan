const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const Ingredient = require('../models/Ingredient');
const User = require('../models/User');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let creatorToken;
let otherUserToken;
let creatorId;

describe('Ingredient Management API Integration Contract Suites', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'local_docker_development_only_secret_key_12345';
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Seed two users to test ownership authorization boundaries
    const creatorUser = new User({
      username: 'creator',
      email: 'creator@test.com',
      password: 'password123'
    });
    const otherUser = new User({
      username: 'stranger',
      email: 'stranger@test.com',
      password: 'password123'
    });

    await creatorUser.save();
    await otherUser.save();

    creatorId = creatorUser._id;

    creatorToken = jwt.sign({ userId: creatorUser._id }, process.env.JWT_SECRET);
    otherUserToken = jwt.sign({ userId: otherUser._id }, process.env.JWT_SECRET);
  });

  afterEach(async () => {
    // Purge ingredients between tests for a clean slate
    await Ingredient.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('should successfully create an ingredient and automatically calculate net carbs (UT-19)', async () => {
    const res = await request(app)
      .post('/api/ingredients')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        name: 'Almond Flour',
        standardAmount: 100,
        standardUnit: 'g',
        nutrition: {
          calories: 590,
          protein: 21,
          totalCarbs: 21,
          fiber: 12,
          sugarAlcohols: 0,
          fat: 52
        },
        tags: ['Keto', 'Gluten-Free']
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.ingredient.name).toEqual('almond flour'); // Checks lowercase schema enforcement
    expect(res.body.ingredient.createdBy.toString()).toEqual(creatorId.toString());

    // Net Carbs Math Verification: 21 (Total) - 12 (Fiber) - 0 (Sugar Alcohols) = 9
    expect(res.body.ingredient.nutrition.netCarbs).toEqual(9);
  });

  it('should reject the creation of an ingredient with an identical name (UT-20)', async () => {
    // Seed the database
    await Ingredient.create({
      name: 'salt',
      nutrition: { calories: 0, protein: 0, totalCarbs: 0, fiber: 0, sugarAlcohols: 0, fat: 0 }
    });

    const res = await request(app)
      .post('/api/ingredients')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        name: 'Salt', // Capitalized to test case-insensitivity
        nutrition: { calories: 0, protein: 0, totalCarbs: 0, fiber: 0, sugarAlcohols: 0, fat: 0 }
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain('already exists');
  });

  it('should fetch paginated ingredients and filter by tags (UT-21)', async () => {
    // Seed bulk data
    await Ingredient.insertMany([
      {
        name: 'chicken breast',
        tags: ['High Protein', 'Paleo'],
        nutrition: {
          calories: 165,
          protein: 31,
          totalCarbs: 0,
          fiber: 0,
          sugarAlcohols: 0,
          fat: 3.6
        }
      },
      {
        name: 'erythritol',
        tags: ['Keto', 'Sweetener'],
        nutrition: {
          calories: 24,
          protein: 0,
          totalCarbs: 100,
          fiber: 0,
          sugarAlcohols: 100,
          fat: 0
        }
      },
      {
        name: 'broccoli',
        tags: ['Vegetarian', 'Keto'],
        nutrition: {
          calories: 34,
          protein: 2.8,
          totalCarbs: 6.6,
          fiber: 2.6,
          sugarAlcohols: 0,
          fat: 0.4
        }
      }
    ]);

    const res = await request(app)
      .get('/api/ingredients?tags=Keto&page=1&limit=1')
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.statusCode).toEqual(200);
    // Pagination verification
    expect(res.body.meta.totalItems).toEqual(2); // Erythritol and Broccoli have the Keto tag
    expect(res.body.meta.totalPages).toEqual(2); // Since limit is 1, there should be 2 pages
    expect(res.body.data).toHaveLength(1); // Only 1 item returned due to limit
  });

  it('should successfully update an ingredient and recalculate net carbs (UT-22)', async () => {
    const ingredient = await Ingredient.create({
      name: 'test bar',
      createdBy: creatorId,
      nutrition: { calories: 200, protein: 20, totalCarbs: 25, fiber: 5, sugarAlcohols: 10, fat: 8 }
    });

    // Verification before update: 25 - 5 - 10 = 10 net carbs
    expect(ingredient.nutrition.netCarbs).toEqual(10);

    const res = await request(app)
      .put(`/api/ingredients/${ingredient._id}`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        nutrition: {
          calories: 200,
          protein: 20,
          totalCarbs: 25,
          fiber: 5,
          sugarAlcohols: 15,
          fat: 8
        } // Increased Sugar Alcohols
      });

    expect(res.statusCode).toEqual(200);
    // Net Carbs Math Verification: 25 - 5 - 15 = 5 net carbs
    expect(res.body.ingredient.nutrition.netCarbs).toEqual(5);
  });

  it('should reject updates and deletions if the user is not the creator (UT-23)', async () => {
    const ingredient = await Ingredient.create({
      name: 'creator secret sauce',
      createdBy: creatorId,
      nutrition: { calories: 100, protein: 0, totalCarbs: 0, fiber: 0, sugarAlcohols: 0, fat: 10 }
    });

    const updateRes = await request(app)
      .put(`/api/ingredients/${ingredient._id}`)
      .set('Authorization', `Bearer ${otherUserToken}`) // Using the STRANGER'S token
      .send({ name: 'stolen sauce' });

    expect(updateRes.statusCode).toEqual(403);
    expect(updateRes.body.message).toContain('Forbidden');

    const deleteRes = await request(app)
      .delete(`/api/ingredients/${ingredient._id}`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(deleteRes.statusCode).toEqual(403);
  });
});
