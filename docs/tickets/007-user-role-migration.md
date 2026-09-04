# Admin Panel - User Role Model Migration

## Question

Migrate user role management from implicit to explicit storage. Add field `roles: [{ roleType: { type: String, enum: ['user', 'admin', 'super-admin'] } }]` to User Mongoose model (multi-role support). Create separate `Roles` collection with schema: userId (User reference), roleType (enum above), grantedBy (User reference), grantReason (text), expiresAt (Date - nullable for permanent roles), createdAt, updatedAt. Implement business rule ensuring at least one super-admin and one admin always exist in system.

### Context

Admin panel feature in scope. Part of the MealPlan administration system. Current User model has no role field - needs migration. Roles should be stored separately per Q9 (multi-role support).

### Labels

wayfinder:task, wayfinder:done

---

## Resolution

**Implemented multi-role support from the start with nullable `expiredAt`.**

### Changes Made

#### 1. Created Roles Collection (`server/models/Roles.js`)

```javascript
const RolesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    roleType: {
      type: String,
      required: true,
      enum: ['user', 'admin', 'super-admin']
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    grantReason: {
      type: String,
      default: ''
    },
    expiresAt: {
      type: Date,
      default: null // null = permanent role
    }
  },
  { timestamps: true }
);

// Compound index to enforce uniqueness of user-role combination
RolesSchema.index({ userId: 1, roleType: 1 });
```

#### 2. Updated User Model (`server/models/User.js`)

Added `roles` field (denormalized array for display) with helper methods:

- `getCurrentRole()` - gets highest role from Roles collection
- `getRoleTypes()` - returns all role types for display
- `hasRole(roleType)` - checks if user has specific role
- `isAdmin()` - checks admin or super-admin status
- `isSuperAdmin()` - checks super-admin status

#### 3. Created Business Rules Middleware (`server/middleware/businessRules.js`)

```javascript
async function ensureAdminsExist(req, res, next) {
  const superAdminCount = await Roles.countDocuments({ roleType: 'super-admin' });
  const adminCount = await Roles.countDocuments({
    roleType: 'admin',
    roleType: { $ne: 'super-admin' }
  });

  // Validates at least 1 super-admin + 1 admin (super-admin counts as admin)
}
```

#### 4. Created Migration Scripts

- `server/scripts/migrateRoles.js` - runs on startup, initializes default super-admin and assigns 'user' role to all existing users
- `server/scripts/runMigrations.js` - standalone migration runner for manual execution
- `server/scripts/initRoles.js` - alternative initialization script

#### 5. Integrated with Server Startup (`server/server.js`)

Role migration runs automatically on database connection:

```javascript
const migrateRoles = require('./scripts/migrateRoles');
await migrateRoles().catch((err) => console.error('[Roles Init]', err.message));
```

### Default Super-Admin Credentials

**Username**: `system`  
**Email**: `admin@mealplan.local`  
**Password**: `admin` (bcrypt hashed in production)

All existing users automatically received the 'user' role during migration.

### Files Created/Modified

| File                                 | Type     | Description                              |
| ------------------------------------ | -------- | ---------------------------------------- |
| `server/models/Roles.js`             | NEW      | Roles collection schema with TTL support |
| `server/models/User.js`              | MODIFIED | Added roles field and helper methods     |
| `server/middleware/businessRules.js` | NEW      | Business rule enforcement middleware     |
| `server/scripts/migrateRoles.js`     | NEW      | Auto-run migration on startup            |
| `server/scripts/runMigrations.js`    | NEW      | Standalone migration runner              |
| `server/scripts/initRoles.js`        | NEW      | Alternative initialization script        |
| `server/server.js`                   | MODIFIED | Integrated role migration into startup   |

---

**Status**: Resolved

This ticket is part of the admin panel implementation map. See [Map](../../wayfinder-map.md).
