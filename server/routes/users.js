const express = require('express');
const router = express.Router();
const User = require('../models/User');
const checkAuth = require('../middleware/auth');
const PortionStorage = require('../models/PortionStorage');

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
        const { calories, protein, netCarbs, fat } = nutritionSettings.dailyMacroTargets;
        if (calories !== undefined)
          updatePayload['nutritionSettings.dailyMacroTargets.calories'] = calories;
        if (protein !== undefined)
          updatePayload['nutritionSettings.dailyMacroTargets.protein'] = protein;
        if (netCarbs !== undefined)
          updatePayload['nutritionSettings.dailyMacroTargets.netCarbs'] = netCarbs;
        if (fat !== undefined) updatePayload['nutritionSettings.dailyMacroTargets.fat'] = fat;
      }

      // Update meal macro breakdown structure
      if (nutritionSettings.dailyMealsCount !== undefined) {
        updatePayload['nutritionSettings.dailyMealsCount'] = nutritionSettings.dailyMealsCount;
      }
      if (nutritionSettings.dailySnacksCount !== undefined) {
        updatePayload['nutritionSettings.dailySnacksCount'] = nutritionSettings.dailySnacksCount;
      }

      if (nutritionSettings.mealMacroSplitPercentage) {
        const split = nutritionSettings.mealMacroSplitPercentage;

        if (split.calories !== undefined)
          updatePayload['nutritionSettings.mealMacroSplitPercentage.calories'] = split.calories;
        if (split.protein !== undefined)
          updatePayload['nutritionSettings.mealMacroSplitPercentage.protein'] = split.protein;
        if (split.netCarbs !== undefined)
          updatePayload['nutritionSettings.mealMacroSplitPercentage.netCarbs'] = split.netCarbs;
        if (split.fat !== undefined)
          updatePayload['nutritionSettings.mealMacroSplitPercentage.fat'] = split.fat;
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
    console.error('Fetch User Profile API Error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// POST /api/users/favorites/:recipeId
router.post('/favorites/:recipeId', checkAuth, async (req, res) => {
  try {
    const userId = req.userData.userId;
    const { recipeId } = req.params;

    const user = await User.findById(userId);

    // Check if the recipe is already in the array
    const index = user.favoriteRecipes.indexOf(recipeId);
    let isFavorite = false;

    if (index === -1) {
      // Not favorited yet, so add it
      user.favoriteRecipes.push(recipeId);
      isFavorite = true;
    } else {
      // Already favorited, so remove it
      user.favoriteRecipes.splice(index, 1);
    }

    await user.save();

    res.status(200).json({
      success: true,
      isFavorite,
      favoriteRecipes: user.favoriteRecipes,
      message: 'Favorite status updated'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/users/storage - Fetch user's portion storage
router.get('/storage', checkAuth, async (req, res) => {
  try {
    const storage = await PortionStorage.find({ userId: req.userData.userId });
    res.status(200).json({ storage });
  } catch (err) {
    console.error('Fetch Storage Error:', err);
    res.status(500).json({ message: 'Failed to fetch portion storage.' });
  }
});

// POST /api/users/storage/adjust - Increment or decrement portions
router.post('/storage/adjust', checkAuth, async (req, res) => {
  try {
    const { recipeId, recipeTitle, delta } = req.body;

    const storageItem = await PortionStorage.findOneAndUpdate(
      { userId: req.userData.userId, recipeId },
      {
        $inc: { portionsInStorage: delta },
        $setOnInsert: { recipeTitle }
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (storageItem.portionsInStorage < 0) {
      storageItem.portionsInStorage = 0;
      await storageItem.save();
    }

    res.status(200).json({ message: 'Portion storage adjusted.', storageItem });
  } catch (err) {
    console.error('Adjust Storage Error:', err);
    res.status(500).json({ message: 'Failed to adjust portion storage.' });
  }
});

module.exports = router;
