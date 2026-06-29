const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, profilePicture } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'Username or Email is already taken.' });
    }

    // Create the new user profile
    const newUser = new User({
      username,
      email,
      password,
      profilePicture: profilePicture || undefined
    });

    await newUser.save();

    res.status(201).json({
      message: 'User account created successfully.',
      user: { id: newUser._id, username: newUser.username, email: newUser.email }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({
      message: 'Server error during account creation'
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Lookup user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Generate a JWT for user to access protected endpoints after logging in
    const jwtSecret = process.env.JWT_SECRET;
    //  if environment variable is not available, shutdown the backend server entirely
    //  this is for security purposes
    if (!jwtSecret) {
      console.error('Error: JWT_SECRET environment variable is missing.');
      return res.status(500).json({ message: 'Internal server configuration error.' });
    }
    const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '24h' });

    // Login success payload data
    res.status(200).json({
      message: 'Login successful.',
      token: token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        favoriteRecipes: user.favoriteRecipes
      }
    });
  } catch (err) {
    console.error('Login API Error:', err);
    res.status(500).json({ message: 'Internal server error during authentication.' });
  }
});

// POST /api/auth/forgot-password // password Recovery Request Link Generation
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Security Best Practice: Return a 200 OK regardless to prevent attacks
    if (!user) {
      return res
        .status(200)
        .json({ message: 'If that email address exists, a recovery link has been dispatched.' });
    }

    // Generate a secure secure recovery string valid for 1 hour
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 Hour Expiry Window
    await user.save();

    // get the client URL from an environment variable for the email link
    const clientBaseUrl = process.env.CLIENT_URL;

    const recoveryUrl = `${clientBaseUrl}/reset-password?token=${resetToken}`;
    await sendEmail({
      to: user.email,
      subject: 'MealPlan Account Password Reset Request',
      text: `Hello ${user.username},\n\nYour username is: ${user.username}\n\nYou can reset your account password by clicking this link:\n${recoveryUrl}\n\nThis link expires in 1 hour.`
    });

    return res
      .status(200)
      .json({ message: 'If that email address exists, a recovery link has been dispatched.' });
  } catch (error) {
    console.error('forgot-password API Error:', error);
    return res.status(500).json({ message: 'An internal server error occurred.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() } // Verifies expiration has not passed
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Password recovery token is invalid or has expired.' });
    }

    // Overwrite old password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Your password has been successfully reset.' });
  } catch (error) {
    console.error('reset-password API Error:', error);
    return res.status(500).json({ message: 'An internal server error occurred.' });
  }
});

//export routes
module.exports = router;
