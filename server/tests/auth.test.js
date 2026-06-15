const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));
const { sendEmail } = require('../services/emailService');
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

  it('should successfully register a new user with encrypted credential security hashing parameters (UT-17)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'testdeveloper',
      email: 'test@mealplan.com',
      password: 'securePassword123'
    });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.username).toEqual('testdeveloper');
  });

  it('should reject login access when providing an incorrect password signature combo (UT-18)', async () => {
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

  // Recover Account
  it('should successfully dispatch a recovery email and update the database when a valid email is submitted (UT-15)', async () => {
    // Setup Preconditions: Create an existing user
    const testUser = new User({
      username: 'recoveryTester',
      email: 'recover@mealplan.com',
      password: 'password123'
    });
    await testUser.save();

    // Clear the mock history before test
    sendEmail.mockClear();

    // Action: Hit the forgot-password endpoint
    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'recover@mealplan.com'
    });

    // Verify expected response
    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toContain('recovery link has been dispatched');

    // Verify the email service was actually triggered
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toEqual('recover@mealplan.com');

    // Verify the database stored the expiration and token
    const updatedUser = await User.findOne({ email: 'recover@mealplan.com' });
    expect(updatedUser.resetPasswordToken).toBeDefined();
    expect(updatedUser.resetPasswordExpires).toBeDefined();
  });

  // Reset Password
  it('should update the user password in the database when submitting a valid reset token (UT-16)', async () => {
    // Setup Preconditions: Create a user that already has an active reset token
    const mockResetToken = 'crypto_hex_string_12345';
    const testUser = new User({
      username: 'resetTester',
      email: 'reset@mealplan.com',
      password: 'oldPassword123',
      resetPasswordToken: mockResetToken,
      resetPasswordExpires: new Date(Date.now() + 3600000) // Expires 1 hour from now
    });
    await testUser.save();

    // 2. Action: Hit the reset-password endpoint with the new password
    const res = await request(app).post('/api/auth/reset-password').send({
      token: mockResetToken,
      newPassword: 'BrandNewSecurePassword789'
    });

    // Verify expected response
    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toContain('successfully reset');

    // Fetch the updated user to verify database state
    const updatedUser = await User.findOne({ email: 'reset@mealplan.com' });

    // Verify security cleanup: Tokens should be wiped after a successful reset
    expect(updatedUser.resetPasswordToken).toBeUndefined();
    expect(updatedUser.resetPasswordExpires).toBeUndefined();

    // Verify the new password actually works by testing the model's hash comparison
    const isMatch = await updatedUser.comparePassword('BrandNewSecurePassword789');
    expect(isMatch).toBe(true);
  });
});
