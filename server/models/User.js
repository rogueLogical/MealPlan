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
    settings: {
      measurementSystem: { type: String, enum: ['metric', 'imperial'], default: 'imperial' }
    },
    nutritionSettings: {
      dailyMacroTargets: {
        calories: { type: Number, default: 2000 },
        protein: { type: Number, default: 150 },
        netCarbs: { type: Number, default: 200 },
        fat: { type: Number, default: 70 }
      },
      likedFoods: [{ type: String }],
      dislikedFoods: [{ type: String }],
      dietaryRestrictions: [{ type: String }],
      dailyMealsCount: { type: Number, default: 3 },
      dailySnacksCount: { type: Number, default: 2 },
      mealMacroSplitPercentage: {
        calories: { type: Number, default: 80 },
        protein: { type: Number, default: 80 },
        netCarbs: { type: Number, default: 80 },
        fat: { type: Number, default: 80 }
      }
    },
    resetPasswordToken: {
      type: String,
      default: undefined
    },
    resetPasswordExpires: {
      type: Date,
      default: undefined
    }
  },
  {
    timestamps: true
  }
);

// hash the password upon change
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// function to check if password matches the stored password
UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', UserSchema);
