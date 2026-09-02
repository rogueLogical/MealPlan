# Admin Panel - Centralized Audit Logging System

## Question

Design and implement centralized audit logging system for all database-modifying operations. Create `AuditLog` Mongoose model with fields: action, actorId (User reference), targetType (collection name), targetId (document ID), beforeSnapshot (pre-change document), afterSnapshot (post-change document), timestamp, ipAddress, userAgent. Implement TTL index on timestamp for automatic deletion of logs older than 30 days. Create middleware hook to automatically log all database modifications in API routes.

### Context

Admin panel feature in scope. Part of the MealPlan administration system. No centralized logging exists currently - implementing from scratch. Only capture actions that impact data in the database (as per Q5).

### Labels

wayfinder:task

---

**Status**: Open

This ticket is part of the admin panel implementation map. See [Map](../../wayfinder-map.md).
