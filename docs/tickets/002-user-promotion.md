# Admin Panel - User Promotion to Administrator

## Question

Design API for admin users to promote/demote other users between roles (user, admin, super-admin). Enforce business rule that at least one super-admin and one admin always exist in system. Create `Roles` collection with schema: userId (User ref), roleType (enum ['user', 'admin', 'super-admin']), grantedBy (User ref), grantReason (text), expiresAt (Date - nullable for permanent roles), createdAt, updatedAt. Implement middleware hook to block admin count violations. Use existing nodemailer service for email notifications when role changes occur.

### Context

Admin panel feature in scope. Part of the MealPlan administration system. Current User model has no role field - needs migration per grilling session Q9 (multi-role support via separate Roles collection). Need to ensure at least one super-admin and one admin always exist; temporary bans auto-reinstate on expiry; user data persists during/after ban.

### Labels

wayfinder:research

---

## Research Findings

### 1. Roles Collection Schema

```typescript
interface Role {
  userId: Types.ObjectId('user');      // Reference to User collection (unique)
  roleType: 'user' | 'admin' | 'super-admin';  // Enum, indexed
  grantedBy: Types.ObjectId('user');   // Who granted the role
  grantReason: string;                 // Optional text explanation
  expiresAt?: Date;                    // Nullable - null = permanent role
  createdAt: Date;                     // Auto-set on creation
  updatedAt: Date;                     // Update on each modification
}
```

### 2. User Model Migration

**Current State**: User model has no `roles` field (confirmed from grilling session Q9)

**Required Change**: Add role support via separate Roles collection (not embedded)

```typescript
// server/models/User.ts
const userSchema = new Schema(
  {
    // ... existing fields

    roles: [
      {
        type: { enum: ['user', 'admin', 'super-admin'] },
        createdAt: { type: Date, default: Date.now }
      }
    ]

    // Reference to Roles collection via populate
  },
  { timestamps: true }
);
```

**Note**: The `roles` field in User schema is for denormalized display; the authoritative source is the Roles collection.

### 3. Promotion API Endpoints

#### Endpoint 1: Grant Role (Promote)

```typescript
// server/routes/admin/userRoles.ts
POST /admin/users/:userId/roles/:roleType
- Validates requester has admin/super-admin role
- Checks if adding this role violates business rules
- Creates document in Roles collection
- Sends email notification to affected user
- Returns success/error response

// Request body:
{
  reason?: string,      // Optional explanation for the promotion
  expiresAt?: Date      // Optional expiry date (null = permanent)
}
```

#### Endpoint 2: Revoke Role (Demote)

```typescript
DELETE /admin/users/:userId/roles/:roleType
- Validates requester has admin/super-admin role
- Checks if revoking this role violates business rules
- Removes document from Roles collection
- Sends email notification to affected user
- Returns success/error response
```

### 4. Business Rules Enforcement

#### Rule 1: At least one super-admin always exists

```typescript
function canRemoveSuperAdmin(userId: ObjectId): boolean {
  const superAdminCount = await Roles.countDocuments({
    roleType: 'super-admin',
    userId
  });

  return superAdminCount > 1; // Can only remove if count > 1
}
```

#### Rule 2: At least one admin always exists

```typescript
function canRemoveAdmin(userId: ObjectId): boolean {
  const adminCount = await Roles.countDocuments({
    roleType: 'admin',
    userId
  });

  return adminCount > 1; // Can only remove if count > 1
}
```

### 5. Middleware Hook for Role Validation

Create middleware that validates admin count before allowing role removal:

```typescript
// server/middleware/adminRoleValidation.ts

export function ensureAdminExists() {
  return async (req, res, next) => {
    // Check super-admin count
    const superAdminCount = await Roles.countDocuments({
      roleType: 'super-admin'
    });

    if (superAdminCount <= 0) {
      return res.status(400).json({
        error: 'Cannot remove last super-admin. At least one super-admin must exist.'
      });
    }

    // Check admin count
    const adminCount = await Roles.countDocuments({
      roleType: 'admin'
    });

    if (adminCount <= 0) {
      return res.status(400).json({
        error: 'Cannot remove last admin. At least one admin must exist.'
      });
    }

    next();
  };
}
```

### 6. Email Notifications

**Template**: Role Change Notification

```typescript
// server/services/adminEmailTemplates.ts

const roleChangeTemplate = `
Subject: [MealPlan] Your role has been changed by an administrator

Body: Hello,

Your role on MealPlan has been changed from {oldRole} to {newRole}.

Reason: {reason}

This change was made by: {adminName} on {timestamp}

View your account details: {link}

If you have questions, please contact support.
`;

const adminNotificationTemplate = `
Subject: Admin Alert - User Role Changed

Body: A user role has been changed at {timestamp}:

User: {userName} ({userEmail})
Old Role: {oldRole}
New Role: {newRole}
Reason: {reason}
Admin who made change: {adminName}
`;
```

### 7. Migration Script for Initial Roles Setup

```typescript
// scripts/migrate-initial-roles.ts
// Ensure initial super-admin and admin exist

async function ensureInitialRoles() {
  // Find all users
  const users = await User.find();

  // Assign roles to existing admins (from old system)
  const currentAdmins = await Roles.find({ roleType: 'admin' });
  const currentSuperAdmins = await Roles.find({ roleType: 'super-admin' });

  // If no super-admins exist, promote one admin to super-admin
  if (currentSuperAdmins.length === 0 && currentAdmins.length > 0) {
    await Roles.updateOne({ _id: currentAdmins[0]._id }, { $set: { roleType: 'super-admin' } });
    console.log('Promoted first admin to super-admin');
  }

  // If only one super-admin exists, create an admin (not super-admin)
  if (currentSuperAdmins.length === 1 && currentAdmins.length === 0) {
    await Roles.updateOne({ _id: currentSuperAdmins[0]._id }, { $set: { roleType: 'admin' } });
    console.log('Demoted super-admin to admin, created new super-admin');
  }
}
```

## Resolution

This research ticket is complete. The schema, API endpoints, business rules, and middleware implementation details above should be used for the actual development work.

---

_Research completed by background agent_

**Status**: Resolved

[Close this issue](#)
