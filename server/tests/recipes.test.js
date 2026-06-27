const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const Ingredient = require('../models/Ingredient');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let creatorToken;
let strangerToken;
let creatorId;
let strangerId;
let mockIngredientId;

describe('Recipe Management API Integration Contract Suites', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'local_docker_development_only_secret_key_12345';
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Seed test users for ownership boundary testing
    const creatorUser = await User.create({
      username: 'recipeCreator',
      email: 'creator@recipes.com',
      password: 'password123'
    });
    const strangerUser = await User.create({
      username: 'recipeStranger',
      email: 'stranger@recipes.com',
      password: 'password123'
    });

    creatorId = creatorUser._id;
    strangerId = strangerUser._id;

    creatorToken = jwt.sign({ userId: creatorId }, process.env.JWT_SECRET);
    strangerToken = jwt.sign({ userId: strangerId }, process.env.JWT_SECRET);

    // Seed a dummy ingredient to reference in our recipe snapshots
    const dummyIngredient = await Ingredient.create({
      name: 'Test Flour',
      servingSize: 100,
      nutritionPerServing: { protein: 10, totalCarbs: 70, fiber: 5, sugarAlcohols: 0, fat: 2 }
    });
    mockIngredientId = dummyIngredient._id;
  });

  afterEach(async () => {
    await Recipe.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Ingredient.deleteMany({});
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('should successfully create a recipe and auto-calculate total macros (UT-24)', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        title: 'Test Bread',
        portions: 1,
        ingredients: [
          {
            ingredientId: mockIngredientId,
            name: 'Test Flour',
            weightInGrams: 200,
            displayAmount: 2,
            displayUnit: 'Cups',
            nutrition: {
              calories: 650,
              protein: 20,
              totalCarbs: 140,
              fiber: 10,
              sugarAlcohols: 0,
              netCarbs: 130,
              fat: 4
            }
          }
        ]
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.recipe.createdBy.toString()).toEqual(creatorId.toString());

    // Verify the math from the pre-save hook
    expect(res.body.recipe.totalNutrition.calories).toEqual(650);
    expect(res.body.recipe.totalNutrition.netCarbs).toEqual(130);
  });

  it('should intercept validation errors and return 400 when missing weightInGrams (UT-25)', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        title: 'Invalid Bread',
        portions: 1,
        ingredients: [
          {
            ingredientId: mockIngredientId,
            name: 'Test Flour',
            // Missing weightInGrams deliberately!
            displayAmount: 2,
            displayUnit: 'Cups'
          }
        ]
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toEqual('Validation Error');
    expect(res.body.details).toContain('weightInGrams');
  });

  it("should prevent strangers from editing someone else's recipe (UT-26)", async () => {
    const recipe = await Recipe.create({
      title: 'Creator Secret Recipe',
      createdBy: creatorId,
      portions: 1
    });

    const res = await request(app)
      .put(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${strangerToken}`) // Using the wrong token!
      .send({ title: 'Stolen Recipe' });

    expect(res.statusCode).toEqual(403);
    expect(res.body.message).toContain('Forbidden');
  });

  it('should soft-delete a recipe and restrict public access (UT-27)', async () => {
    const recipe = await Recipe.create({
      title: 'Recipe to Delete',
      createdBy: creatorId,
      isPublic: true,
      portions: 1
    });

    // Creator deletes it
    const deleteRes = await request(app)
      .delete(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${creatorToken}`);
    expect(deleteRes.statusCode).toEqual(200);

    // Stranger tries to view it and fails
    const publicViewRes = await request(app)
      .get(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(publicViewRes.statusCode).toEqual(404);

    // Creator can still view their own deleted recipe (for historical meal plan tracking)
    const creatorViewRes = await request(app)
      .get(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${creatorToken}`);
    expect(creatorViewRes.statusCode).toEqual(200);
    expect(creatorViewRes.body.isDeleted).toEqual(true);
  });

  it('should allow users to fork a public recipe and block forking private ones (UT-28)', async () => {
    // Setup Public & Private Recipes
    const publicRecipe = await Recipe.create({
      title: 'Public Masterpiece',
      createdBy: creatorId,
      isPublic: true,
      portions: 4
    });

    const privateRecipe = await Recipe.create({
      title: 'Private Family Secret',
      createdBy: creatorId,
      isPublic: false,
      portions: 4
    });

    // Stranger successfully forks the public recipe
    const forkRes = await request(app)
      .post(`/api/recipes/${publicRecipe._id}/fork`)
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(forkRes.statusCode).toEqual(201);
    expect(forkRes.body.recipe.title).toEqual('Public Masterpiece (Copy)');
    expect(forkRes.body.recipe.createdBy.toString()).toEqual(strangerId.toString()); // Ownership changed
    expect(forkRes.body.recipe.originalRecipeId.toString()).toEqual(publicRecipe._id.toString());
    expect(forkRes.body.recipe.isPublic).toEqual(false); // Forks should default to private

    // Stranger tries to fork the private recipe
    const failedForkRes = await request(app)
      .post(`/api/recipes/${privateRecipe._id}/fork`)
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(failedForkRes.statusCode).toEqual(403);
    expect(failedForkRes.body.message).toContain('private');
  });
});
