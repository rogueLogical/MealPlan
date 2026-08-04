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
  beforeAll(async () => {
    process.env.JWT_SECRET = 'local_docker_development_only_secret_key_12345';
    mongoServer = await MongoMemoryServer.create();
    const testMongoURI = mongoServer.getUri();
    await mongoose.connect(testMongoURI);
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

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
    const setupUser = new User({
      username: 'loginTester',
      email: 'login@test.com',
      password: 'mypassword123',
      isEmailVerified: true
    });
    await setupUser.save();

    const res = await request(app).post('/api/auth/login').send({
      username: 'loginTester',
      password: 'wrongPasswordAttempt'
    });

    expect(res.statusCode).toEqual(401);
    expect(res.body.message).toContain('Invalid username');
  });

  it('should successfully dispatch a recovery email and update the database when a valid email is submitted (UT-15)', async () => {
    const testUser = new User({
      username: 'recoveryTester',
      email: 'recover@mealplan.com',
      password: 'password123',
      isEmailVerified: true
    });
    await testUser.save();

    sendEmail.mockClear();

    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'recover@mealplan.com'
    });

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toContain('recovery link has been dispatched');

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toEqual('recover@mealplan.com');

    const updatedUser = await User.findOne({ email: 'recover@mealplan.com' });
    expect(updatedUser.resetPasswordToken).toBeDefined();
    expect(updatedUser.resetPasswordExpires).toBeDefined();
  });

  it('should update the user password in the database when submitting a valid reset token (UT-16)', async () => {
    const mockResetToken = 'crypto_hex_string_12345';
    const testUser = new User({
      username: 'resetTester',
      email: 'reset@mealplan.com',
      password: 'oldPassword123',
      isEmailVerified: true,
      resetPasswordToken: mockResetToken,
      resetPasswordExpires: new Date(Date.now() + 3600000)
    });
    await testUser.save();

    const res = await request(app).post('/api/auth/reset-password').send({
      token: mockResetToken,
      newPassword: 'BrandNewSecurePassword789'
    });

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toContain('successfully reset');

    const updatedUser = await User.findOne({ email: 'reset@mealplan.com' });

    expect(updatedUser.resetPasswordToken).toBeUndefined();
    expect(updatedUser.resetPasswordExpires).toBeUndefined();

    const isMatch = await updatedUser.comparePassword('BrandNewSecurePassword789');
    expect(isMatch).toBe(true);
  });

  it('should successfully register a user and send verification email', async () => {
    sendEmail.mockClear();
    const res = await request(app).post('/api/auth/register').send({
      username: 'verificationtester',
      email: 'verifytest@mealplan.com',
      password: 'securePassword123'
    });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('user');
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const userInDb = await User.findOne({ email: 'verifytest@mealplan.com' });
    expect(userInDb.isEmailVerified).toBe(false);
    expect(userInDb.emailVerificationToken).toBeDefined();
  });

  it('should reject login for unverified users (UAT-39)', async () => {
    const setupUser = new User({
      username: 'unverifiedUser',
      email: 'unverified@test.com',
      password: 'mypassword123',
      isEmailVerified: false
    });
    await setupUser.save();

    const res = await request(app).post('/api/auth/login').send({
      username: 'unverifiedUser',
      password: 'mypassword123'
    });

    expect(res.statusCode).toEqual(403);
    expect(res.body.message).toContain('verify your email address');
  });

  it('should verify user email via token and allow login afterwards', async () => {
    const mockToken = 'valid_verification_token_12345';
    const setupUser = new User({
      username: 'verifyUser',
      email: 'verify@test.com',
      password: 'mypassword123',
      isEmailVerified: false,
      emailVerificationToken: mockToken,
      emailVerificationExpires: new Date(Date.now() + 3600000)
    });
    await setupUser.save();

    const verifyRes = await request(app).post('/api/auth/verify-email').send({ token: mockToken });

    expect(verifyRes.statusCode).toEqual(200);
    expect(verifyRes.body.message).toContain('verified successfully');

    const loginRes = await request(app).post('/api/auth/login').send({
      username: 'verifyUser',
      password: 'mypassword123'
    });

    expect(loginRes.statusCode).toEqual(200);
    expect(loginRes.body).toHaveProperty('token');
  });
});
