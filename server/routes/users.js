const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const checkAuth = require('../middleware/auth');
const PortionStorage = require('../models/PortionStorage');
const { sendEmail } = require('../services/emailService');

// PUT /api/users/settings - Updates settings
router.put('/settings', checkAuth, async (req, res) => {
  try {
    const userId = req.userData.userId;
    const { measurementSystem, nutritionSettings, profilePicture } = req.body;

    const updatePayload = {
      hasConfiguredSettings: true
    };

    if (measurementSystem) {
      updatePayload['settings.measurementSystem'] = measurementSystem;
    }
    if (profilePicture) updatePayload['profilePicture'] = profilePicture;

    if (nutritionSettings) {
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

      if (nutritionSettings.likedFoods)
        updatePayload['nutritionSettings.likedFoods'] = nutritionSettings.likedFoods;
      if (nutritionSettings.dislikedFoods)
        updatePayload['nutritionSettings.dislikedFoods'] = nutritionSettings.dislikedFoods;
      if (nutritionSettings.dietaryRestrictions)
        updatePayload['nutritionSettings.dietaryRestrictions'] =
          nutritionSettings.dietaryRestrictions;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updatePayload },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User account profile not found.' });
    }

    res.status(200).json({
      message: 'Account dashboard configurations updated successfully!',
      settings: updatedUser.settings,
      nutritionSettings: updatedUser.nutritionSettings,
      hasConfiguredSettings: updatedUser.hasConfiguredSettings,
      dismissedWelcomeBanner: updatedUser.dismissedWelcomeBanner
    });
  } catch (err) {
    console.error('Settings API Error:', err);
    res.status(500).json({ message: 'Internal server error processing settings updates.' });
  }
});

// POST /api/users/request-email-change - Dedicated email change request endpoint
router.post('/request-email-change', checkAuth, async (req, res) => {
  try {
    const userId = req.userData.userId;
    const { newEmail } = req.body;

    if (!newEmail) {
      return res.status(400).json({ message: 'New email address is required.' });
    }

    const sanitizedNewEmail = newEmail.trim().toLowerCase();

    // Verify email is not already taken by another user
    const existingUser = await User.findOne({
      email: sanitizedNewEmail,
      _id: { $ne: userId }
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'That email address is already registered to another account.'
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.email === sanitizedNewEmail) {
      return res
        .status(400)
        .json({ message: 'New email address must be different from your current email.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.pendingEmail = sanitizedNewEmail;
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 86400000); // 24 hours

    await user.save();

    const clientBaseUrl = process.env.CLIENT_URL || 'http://localhost:4200';
    const verificationUrl = `${clientBaseUrl}/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: sanitizedNewEmail,
      subject: 'Confirm Your New MealPlan Email Address',
      text: `Hello ${user.username},\n\nYou requested to change your MealPlan account email address to ${sanitizedNewEmail}. Please click the link below to confirm this change:\n\n${verificationUrl}\n\nThis verification link will expire in 24 hours.`
    });

    res.status(200).json({
      message:
        'Verification link dispatched! Please check your new email address to confirm the change.',
      pendingEmail: sanitizedNewEmail
    });
  } catch (error) {
    console.error('Request Email Change Error:', error);
    res.status(500).json({ message: 'Failed to dispatch email change verification.' });
  }
});

// GET /api/users/me
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

// POST /api/users/dismiss-welcome
router.post('/dismiss-welcome', checkAuth, async (req, res) => {
  try {
    const userId = req.userData.userId;
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { dismissedWelcomeBanner: true } },
      { returnDocument: 'after' }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.status(200).json({ message: 'Welcome banner dismissed.', user });
  } catch (err) {
    console.error('Dismiss Welcome Banner Error:', err);
    res.status(500).json({ message: 'Failed to dismiss welcome banner.' });
  }
});

// POST /api/users/recently-viewed/:recipeId
router.post('/recently-viewed/:recipeId', checkAuth, async (req, res) => {
  try {
    const userId = req.userData.userId;
    const { recipeId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.recentlyViewedRecipes = user.recentlyViewedRecipes.filter(
      (id) => id.toString() !== recipeId
    );
    user.recentlyViewedRecipes.unshift(recipeId);

    if (user.recentlyViewedRecipes.length > 10) {
      user.recentlyViewedRecipes = user.recentlyViewedRecipes.slice(0, 10);
    }

    await user.save();
    res.status(200).json({ success: true, recentlyViewed: user.recentlyViewedRecipes });
  } catch (err) {
    console.error('Record Recently Viewed Error:', err);
    res.status(500).json({ message: 'Failed to record recently viewed recipe.' });
  }
});

// GET /api/users/recently-viewed
router.get('/recently-viewed', checkAuth, async (req, res) => {
  try {
    const userId = req.userData.userId;
    const user = await User.findById(userId).populate({
      path: 'recentlyViewedRecipes',
      match: { isDeleted: false }
    });

    if (!user) return res.status(404).json({ message: 'User not found.' });

    const recipes = (user.recentlyViewedRecipes || []).filter((r) => r !== null);

    res.status(200).json({ data: recipes });
  } catch (err) {
    console.error('Fetch Recently Viewed Error:', err);
    res.status(500).json({ message: 'Failed to fetch recently viewed recipes.' });
  }
});

// POST /api/users/favorites/:recipeId
router.post('/favorites/:recipeId', checkAuth, async (req, res) => {
  try {
    const userId = req.userData.userId;
    const { recipeId } = req.params;

    const user = await User.findById(userId);

    const index = user.favoriteRecipes.indexOf(recipeId);
    let isFavorite = false;

    if (index === -1) {
      user.favoriteRecipes.push(recipeId);
      isFavorite = true;
    } else {
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

// GET /api/users/storage
router.get('/storage', checkAuth, async (req, res) => {
  try {
    const storage = await PortionStorage.find({ userId: req.userData.userId });
    res.status(200).json({ storage });
  } catch (err) {
    console.error('Fetch Storage Error:', err);
    res.status(500).json({ message: 'Failed to fetch portion storage.' });
  }
});

// POST /api/users/storage/adjust
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
