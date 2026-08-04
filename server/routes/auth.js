const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');

// POST /api/auth/register - Create account & send verification email
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, profilePicture } = req.body;

    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedUsername = username.trim();

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: sanitizedEmail }, { username: sanitizedUsername }]
    });
    if (existingUser) {
      return res.status(400).json({ message: 'Username or Email is already taken.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');

    const newUser = new User({
      username: sanitizedUsername,
      email: sanitizedEmail,
      password,
      profilePicture: profilePicture || undefined,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + 86400000) // 24 hours
    });

    await newUser.save();

    const clientBaseUrl = process.env.CLIENT_URL || 'http://localhost:4200';
    const verificationUrl = `${clientBaseUrl}/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: newUser.email,
      subject: 'Verify Your MealPlan Email Address',
      text: `Hello ${newUser.username},\n\nThank you for creating an account with MealPlan. Please verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis verification link will expire in 24 hours.`
    });

    res.status(201).json({
      message: 'Account created successfully. Please check your email to verify your address.',
      user: { id: newUser._id, username: newUser.username, email: newUser.email }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({
      message: 'Server error during account creation.'
    });
  }
});

// POST /api/auth/login - Authenticate user (enforces email verification)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Reject login attempts if email is unverified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message:
          'Please verify your email address before logging in. Check your inbox for the verification link.',
        isEmailVerified: false,
        email: user.email
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('Error: JWT_SECRET environment variable is missing.');
      return res.status(500).json({ message: 'Internal server configuration error.' });
    }
    const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '24h' });

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

// POST /api/auth/verify-email - Consume token and mark email verified
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required.' });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Email verification token is invalid or has expired.'
      });
    }

    // If an email change request was pending, update the primary email
    if (user.pendingEmail) {
      user.email = user.pendingEmail;
      user.pendingEmail = undefined;
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    res.status(200).json({
      message: 'Email address verified successfully. You may now log in.',
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('verify-email Error:', error);
    res.status(500).json({ message: 'Internal server error during email verification.' });
  }
});

// POST /api/auth/resend-verification - Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: sanitizedEmail }, { pendingEmail: sanitizedEmail }]
    });

    if (!user) {
      return res.status(200).json({
        message:
          'If an account matching that email address exists, a new verification link has been sent.'
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 86400000); // 24 hours
    await user.save();

    const clientBaseUrl = process.env.CLIENT_URL || 'http://localhost:4200';
    const verificationUrl = `${clientBaseUrl}/verify-email?token=${verificationToken}`;
    const targetEmail = user.pendingEmail || user.email;

    await sendEmail({
      to: targetEmail,
      subject: 'Verify Your MealPlan Email Address',
      text: `Hello ${user.username},\n\nHere is your new verification link:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.`
    });

    res.status(200).json({
      message:
        'If an account matching that email address exists, a new verification link has been sent.'
    });
  } catch (error) {
    console.error('resend-verification Error:', error);
    res.status(500).json({ message: 'Failed to resend verification email.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res
        .status(200)
        .json({ message: 'If that email address exists, a recovery link has been dispatched.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 Hour
    await user.save();

    const clientBaseUrl = process.env.CLIENT_URL || 'http://localhost:4200';
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
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Password recovery token is invalid or has expired.' });
    }

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

module.exports = router;
