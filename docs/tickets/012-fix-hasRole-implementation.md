# Fix hasRole() Implementation to Respect Spec

## Problem Statement

The `UserSchema.methods.hasRole()` method returns `true` by default when the User model's local `roles` array is empty, without querying the authoritative Roles collection. This violates ticket 002 spec: "Roles collection remains authoritative source; User model has denormalized `roles` field for display only."

## Solution

Update `hasRole()` to always query the Roles collection when the local cache is stale or empty, ensuring consistency with the authoritative source.

## User Stories

1. As a system designer, I want role checks to query the database directly, so that denormalized fields are never relied upon as the truth.
2. As a developer, I want getRoleTypes() to return actual roles from the database, not a default fallback, so that UI displays correct permissions.
3. As an auditor, I want role history in the Roles collection to always be accurate, so that promotions/demotions are recorded correctly.

## Implementation Decisions

### hasRole() Fix
```javascript
UserSchema.methods.hasRole = async function (roleType) {
  const roles = await Roles.find({ userId: this._id });
  
  if (!roles.length) {
    return false; // Default role is undefined, not 'user'
  }
  
  return roles.some((r) => r.roleType === roleType);
};
```

### getRoleTypes() Fix
```javascript
UserSchema.methods.getRoleTypes = async function () {
  const roles = await Roles.find({ userId: this._id }).sort({ grantedAt: -1 });
  
  if (!roles.length) return [];
  
  const uniqueRoles = [...new Set(roles.map((r) => r.roleType))];
  return uniqueRoles;
};
```

### getHighestRole() Addition
Add a new method that returns the highest-priority role:
- super-admin > admin > user

```javascript
UserSchema.methods.getHighestRole = async function () {
  const roles = await Roles.find({ userId: this._id }).sort(
    { grantedAt: -1 } // most recent first
  );
  
  const priority = { 'super-admin': 3, 'admin': 2, 'user': 1 };
  
  return [...roles].reverse().find((r) => priority[r.roleType] === Math.max(...Object.values(priority))).roleType;
};
```

## Testing Decisions

- Unit test hasRole() with empty roles array (should query DB and return false)
- Integration test user with only 'user' role in Roles collection returns correct hasRole results
- Verify getHighestRole() returns super-admin even when admin role also exists

## Out of Scope

- Changing the Roles collection schema
- Adding caching layer for role queries
- Modifying how roles are granted/revoked

## Further Notes

This is a bug fix to align implementation with spec. The denormalized `roles` field on User model should still exist for display performance, but all logic must query Roles collection as the source of truth. Add a note in comments explaining this separation of concerns.
