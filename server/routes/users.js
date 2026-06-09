const express = require('express');
const router = express.Router();
const User = require('../models/User');
const checkAuth = require('../middleware/auth');

// PUT /api/users/settings
router.put('/settings', checkAuth, async (req, res) => {
  try {
    // Extract the authenticated user ID
    const userId = req.userData.userId;

    // Destructure valid configuration tokens out of the incoming HTTP request body
    const { measurementSystem, nutritionSettings, profilePicture, email } = req.body;

    // Build dataset object
    const updatePayload = {};

    if (measurementSystem) {
      updatePayload['settings.measurementSystem'] = measurementSystem;
    }
    if (profilePicture) updatePayload['profilePicture'] = profilePicture;

    if (email) {
      // check if email exists on an account that is not the current user
      const sanitizedEmail = email.trim().toLowerCase();
      const emailConflict = await User.findOne({
        email: sanitizedEmail,
        _id: { $ne: userId }
      });
      if (emailConflict) {
        return res.status(400).json({
          message: 'The email address you entered is already registered to another account.'
        });
      }

      updatePayload['email'] = sanitizedEmail;
    }

    if (nutritionSettings) {
      // update macro targets if provided by the client
      if (nutritionSettings.dailyMacroTargets) {
        const { calories, protein, carbs, fat } = nutritionSettings.dailyMacroTargets;
        if (calories !== undefined)
          updatePayload['nutritionSettings.dailyMacroTargets.calories'] = calories;
        if (protein !== undefined)
          updatePayload['nutritionSettings.dailyMacroTargets.protein'] = protein;
        if (carbs !== undefined) updatePayload['nutritionSettings.dailyMacroTargets.carbs'] = carbs;
        if (fat !== undefined) updatePayload['nutritionSettings.dailyMacroTargets.fat'] = fat;
      }

      // Update preferred meal structural arrays if provided by the client
      if (nutritionSettings.likedFoods)
        updatePayload['nutritionSettings.likedFoods'] = nutritionSettings.likedFoods;
      if (nutritionSettings.dislikedFoods)
        updatePayload['nutritionSettings.dislikedFoods'] = nutritionSettings.dislikedFoods;
      if (nutritionSettings.dietaryRestrictions)
        updatePayload['nutritionSettings.dietaryRestrictions'] =
          nutritionSettings.dietaryRestrictions;
    }

    // Update the user entry in the database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updatePayload },
      { returnDocument: 'after', runValidators: true } // Returns updated profile, runs schema validators
    ).select('-password'); // Exclude the encrypted password hash

    if (!updatedUser) {
      return res.status(404).json({ message: 'User account profile not found.' });
    }

    res.status(200).json({
      message: 'Account dashboard configurations updated successfully!',
      settings: updatedUser.settings,
      nutritionSettings: updatedUser.nutritionSettings
    });
  } catch (err) {
    console.error('Settings API Error:', err);
    res.status(500).json({ message: 'Internal server error processing settings updates.' });
  }
});

// GET /api/users/me // get user profile information
router.get('/me', checkAuth, async (req, res) => {
  try {
    const userId = req.userData.userId;
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User profile tracking record missing.' });
    }

    res.status(200).json({ user });
  } catch (err) {
    console.error('Settings API Error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
