# Admin Panel - User Activity Monitoring (Audit Logging)

## Question

Design and implement centralized audit logging system for all database-modifying operations. Create `AuditLog` Mongoose model with schema: action (string), actorId (User reference), targetType (collection name), targetId (document ObjectId or array of IDs), beforeSnapshot (pre-change document as mongoose object), afterSnapshot (post-change document), timestamp (Date, auto-populated by Mongoose timestamps), ipAddress (string from req.ip), userAgent (string from req.get('user-agent')). Create TTL index on timestamp for automatic deletion of logs older than 30 days. Implement middleware hook to automatically create audit log entries for all API route database modifications.

### Context

Admin panel feature in scope. Part of the MealPlan administration system. No centralized logging exists currently - implementing from scratch per Q5. Only capture actions that impact data in the database (not GET requests). Need to integrate with existing Express.js middleware stack.

### Labels

wayfinder:task

---

**Status**: Open

This ticket is part of the admin panel implementation map. See [Map](../../wayfinder-map.md).
