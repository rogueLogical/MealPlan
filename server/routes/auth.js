const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
      process.exit(1);
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
        profilePicture: user.profilePicture
      }
    });
  } catch (err) {
    console.error('Login API Error:', err);
    res.status(500).json({ message: 'Internal server error during authentication.' });
  }
});
