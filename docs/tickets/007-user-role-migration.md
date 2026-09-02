# Admin Panel - User Role Model Migration

## Question

Migrate user role management from implicit to explicit storage. Add field `roles: [{ roleType: { type: String, enum: ['user', 'admin', 'super-admin'] } }]` to User Mongoose model (multi-role support). Create separate `Roles` collection with schema: userId (User reference), roleType (enum above), grantedBy (User reference), grantReason (text), expiresAt (Date - nullable for permanent roles), createdAt, updatedAt. Implement business rule ensuring at least one super-admin and one admin always exist in system.

### Context

Admin panel feature in scope. Part of the MealPlan administration system. Current User model has no role field - needs migration. Roles should be stored separately per Q9 (multi-role support).

### Labels

wayfinder:task

---

**Status**: Open

This ticket is part of the admin panel implementation map. See [Map](../../wayfinder-map.md).
