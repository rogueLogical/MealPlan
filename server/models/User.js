const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    profilePicture: {
      type: String,
      default: ''
    },
    recipes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recipe'
      }
    ],
    nutritionSettings: {
      dailyMacroTargets: {
        calories: { type: Number, default: 2000 },
        protein: { type: Number, default: 150 },
        carbs: { type: Number, default: 200 },
        fat: { type: Number, default: 70 }
      },
      likedFoods: [{ type: String }],
      dislikedFoods: [{ type: String }],
      dietaryRestrictions: [{ type: String }]
    }
  },
  {
    timestamps: true
  }
);

// hash the password upon change
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// function to check if password matches the stored password
UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', UserSchema);
