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
    ],
    isBanned: {
      type: Boolean,
      default: false
    },
    banExpiresAt: {
      type: Date,
      default: null
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

// helper to fetch all roles from Roles collection, sorted by priority (most recent first)
UserSchema.methods.getRoles = async function () {
  return await Roles.find({ userId: this._id }).sort({ grantedAt: -1 });
};

// convenience method to get the highest-priority role
UserSchema.methods.getHighestRole = async function () {
  const roles = await this.getRoles();
  const priority = { 'super-admin': 3, admin: 2, user: 1 };
  return [...roles]
    .reverse()
    .find((r) => priority[r.roleType] === Math.max(...Object.values(priority))).roleType;
};

// convenience method to check if user has any of the specified roles
UserSchema.methods.hasAnyRole = async function (roleArray) {
  const roles = await this.getRoles();
  return roles.some((r) => roleArray.includes(r.roleType));
};

// deprecated: getCurrentRole() - use getHighestRole() instead
UserSchema.methods.getCurrentRole = async function () {
  console.warn('[User] getCurrentRole() is deprecated, use getHighestRole() instead');
  return await this.getHighestRole();
};

// deprecated: hasRole() - use hasAnyRole() with specific role or getHighestRole() for priority check
UserSchema.methods.hasRole = async function (roleType) {
  console.warn('[User] hasRole() is deprecated, use hasAnyRole([role]) instead');
  return await this.hasAnyRole([roleType]);
};

// deprecated: getRoleTypes() - use getRoles() directly or hasAnyRole() for checks
UserSchema.methods.getRoleTypes = async function () {
  console.warn('[User] getRoleTypes() is deprecated, use getRoles() instead');
  const roles = await this.getRoles();
  return [...new Set(roles.map((r) => r.roleType))];
};

// deprecated: isAdmin() - use hasAnyRole(['admin', 'super-admin']) or check getHighestRole()
UserSchema.methods.isAdmin = async function () {
  console.warn('[User] isAdmin() is deprecated, use hasAnyRole(["admin", "super-admin"]) instead');
  return await this.hasAnyRole(['admin', 'super-admin']);
};

// deprecated: isSuperAdmin() - use hasAnyRole(['super-admin']) or check getHighestRole()
UserSchema.methods.isSuperAdmin = async function () {
  console.warn('[User] isSuperAdmin() is deprecated, use hasAnyRole(["super-admin"]) instead');
  return await this.hasAnyRole(['super-admin']);
};

module.exports = mongoose.model('User', UserSchema);
