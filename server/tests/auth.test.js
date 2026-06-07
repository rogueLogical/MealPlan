const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

describe('User Authentication API Integration Contract Suites', () => {
  // Before tests execute, connect to a database connection
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const testMongoURI = mongoServer.getUri();
    await mongoose.connect(testMongoURI);
  });

  // Clean the test User records after every test execution
  afterEach(async () => {
    await User.deleteMany({});
  });

  // Sever database sessions completely when tests conclude
  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('should successfully register a new user with encrypted credential security hashing parameters', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'testdeveloper',
      email: 'test@mealplan.com',
      password: 'securePassword123'
    });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.username).toEqual('testdeveloper');
  });

  it('should reject login access when providing an incorrect password signature combo parameter', async () => {
    // Inject a default mock user
    const setupUser = new User({
      username: 'loginTester',
      email: 'login@test.com',
      password: 'mypassword123'
    });
    await setupUser.save();

    const res = await request(app).post('/api/auth/login').send({
      username: 'loginTester',
      password: 'wrongPasswordAttempt'
    });

    expect(res.statusCode).toEqual(401);
    expect(res.body.message).toContain('Invalid username');
  });
});
