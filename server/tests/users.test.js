const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server'); // Corrected relative path
const User = require('../models/User'); // Corrected relative path

describe('User Settings API Operations Contract Test Suite', () => {
  let mockToken;
  let mockUserId;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'local_docker_development_only_secret_key_12345';
    const testMongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/meandb_test';
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

  it('should explicitly reject adjustments with a 401 when the Authorization header is missing', async () => {
    const res = await request(app).put('/api/users/settings').send({ measurementSystem: 'metric' });

    expect(res.statusCode).toEqual(401);
  });
});
