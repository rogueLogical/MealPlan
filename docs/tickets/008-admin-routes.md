# Admin Panel - Admin Routes and Controllers Structure

## Question

Design and implement admin API routes under `/admin/*` paths. Create `server/routes/admin/` directory structure with:
- `userManagement.js`: admin user operations (ban/unban, promote/demote role, delete account)
- `contentModeration.js`: recipe/ingredient admin operations (bulk delete, cleanup, restore deleted items)
- `auditLogs.js`: audit log viewer and filtering endpoints
- `featureFlags.js`: feature flag toggle and configuration endpoints
- Create dedicated middleware for super-admin role verification (separate from regular auth check)

### Context

Admin panel feature in scope. Part of the MealPlan administration system. Admin actions require API-only implementation initially (Angular frontend added later). Email alerts must be sent to admin@mealplan.local when emails fail per Q8.

### Labels

wayfinder:task

---

**Status**: Open

This ticket is part of the admin panel implementation map. See [Map](../../wayfinder-map.md).
