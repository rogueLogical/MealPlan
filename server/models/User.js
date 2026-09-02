const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Roles = require('./Roles');

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
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String,
      default: undefined
    },
    emailVerificationExpires: {
      type: Date,
      default: undefined
    },
    pendingEmail: {
      type: String,
      default: undefined
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
    hasConfiguredSettings: {
      type: Boolean,
      default: false
    },
    dismissedWelcomeBanner: {
      type: Boolean,
      default: false
    },
    resetPasswordToken: {
      type: String,
      default: undefined
    },
    resetPasswordExpires: {
      type: Date,
      default: undefined
    },
    favoriteRecipes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recipe'
      }
    ],
    recentlyViewedRecipes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recipe'
      }
    ],
    roles: [
      {
        roleType: {
          type: String,
          enum: ['user', 'admin', 'super-admin']
        }
      }
    ]
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

// helper to check current highest role from Roles collection (denormalized field is for display only)
UserSchema.methods.getCurrentRole = async function () {
  const roles = await Roles.findOne({ userId: this._id }).sort({ grantedAt: -1 });
  return roles ? roles.roleType : 'user';
};

// helper to get all role types for display
UserSchema.methods.getRoleTypes = function () {
  if (!this.roles || !Array.isArray(this.roles)) return ['user'];
  const uniqueRoles = [...new Set(this.roles.map((r) => r.roleType))];
  return uniqueRoles.length === 0 ? ['user'] : uniqueRoles;
};

// function to check if user has a specific role
UserSchema.methods.hasRole = function (roleType) {
  if (!this.roles || !Array.isArray(this.roles)) {
    return roleType === 'user'; // default role
  }
  return this.roles.some((r) => r.roleType === roleType);
};

// function to check admin roles (admin OR super-admin)
UserSchema.methods.isAdmin = async function () {
  const highestRole = await Roles.findOne({ userId: this._id })
    .where('roleType')
    .in(['admin', 'super-admin'])
    .sort({ grantedAt: -1 });
  return !!highestRole;
};

// function to check if user is super-admin
UserSchema.methods.isSuperAdmin = async function () {
  const role = await Roles.findOne({ userId: this._id, roleType: 'super-admin' });
  return !!role;
};

module.exports = mongoose.model('User', UserSchema);
