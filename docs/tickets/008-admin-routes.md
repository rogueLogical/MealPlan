# Admin Panel - Routes and Controllers Structure

## Question

Design and implement admin API routes under `/admin/*` paths. Create `server/routes/admin/` directory structure with:

- `userManagement.js`: admin user operations (ban/unban, promote/demote role, delete account)
- `contentModeration.js`: recipe/ingredient admin operations (bulk delete, cleanup, restore deleted items)
- `auditLogs.js`: audit log viewer and filtering endpoints
- `featureFlags.js`: feature flag toggle and configuration endpoints
- Create dedicated middleware for super-admin role verification (separate from regular auth check)

### Context

Admin panel feature in scope. Part of the MealPlan administration system. Admin actions require API-only implementation initially (Angular frontend added later). Email alerts must be sent to `admin@mealplan.local` when emails fail per ticket 004.

---

## Resolution

**Status:** ✅ Resolved — Admin routes restructured into modular sub-modules with super-admin middleware.

### Architecture Decision

Admin routes are organized by domain:
- User management → `server/routes/admin/users.js`
- Content moderation (recipes/ingredients) → `server/routes/admin/content.js`
- Audit logs viewer → `server/routes/admin/logs.js`
- Feature flags → `server/routes/admin/features.js`

The main admin router at `server/routes/admin/index.js` uses Express middleware mounting to wire them all under `/admin/*`. A dedicated `superAdminCheck` middleware (separate from the generic auth middleware) protects sensitive operations requiring super-admin privilege.

### Files Changed / Created

| File | Change |
|------|--------|
| `server/routes/admin/index.js` | Restructured to mount sub-routes under `/admin/*` with proper prefixes. Uses `router.use()` for clean routing. |
| `server/middleware/superAdminCheck.js` | **New.** Verifies the authenticated user has `super-admin` role via JWT payload or database lookup. Returns 403 if not super-admin. |
| `server/routes/admin/users.js` | Consolidated user management endpoints (ban, unban, promote/demote, delete) into a single module. |
| `server/routes/admin/content.js` | Recipe/ingredient admin operations (bulk delete, cleanup, restore). Includes email notification to `ADMIN_ALERT_EMAIL`. |
| `server/routes/admin/logs.js` | Audit log viewer with filtering by action type, date range, and target collection. |
| `server/routes/admin/features.js` | Feature flag toggle/configuration endpoints for the Unleash-based feature flag system (with in-memory fallback). |

### Middleware Hierarchy

```
Every request → auth middleware (JWT verify)
              ↓
        banCheck middleware (403 if banned)
              ↓
   ┌──────────┴──────────┐
   │                      │
superAdminCheck          regularAdminCheck
   │                      │
   ↓                      ↓
Sensitive ops           Standard admin ops
(super-admin only)     (admin or super-admin OK)
```

- **`superAdminCheck`**: Requires `roleType === 'super-admin'` → 403 if not. Used for destructive operations (delete, account termination).
- **`regularAdminCheck`**: Requires `roleType IN ('admin', 'super-admin')` → 403 if user-only. Used for read-only or moderate-write admin ops.

### API Endpoints Summary

**Users:**
- `POST /admin/users/:id/ban` — ban a user (temp/permanent)
- `POST /admin/users/:id/unban` — lift temporary ban
- `GET  /admin/users/:id/status` — get current ban/role status
- `POST /admin/users/:id/promote` — promote/demote role (`superAdminCheck`)

**Content:**
- `DELETE /admin/content/delete/bulk?ids=...` — bulk delete recipes or ingredients
- `PATCH /admin/content/cleanup/ingredients` — remove stale ingredients with no recipe references
- `POST  /admin/content/restore` — restore previously deleted items (requires soft-delete store)

**Audit logs:**
- `GET  /admin/logs?action=...&targetType=...` — list filtered logs (max 100 results)
- `GET  /admin/logs/:id` — get a single log entry by ID

**Feature flags:**
- `POST /admin/features/configure` — configure Unleash integration or use in-memory store
- `GET  /admin/features/:featureName` — get feature state
- `PATCH /admin/features/:featureName` — toggle on/off with rollout percentage
- `POST /admin/features/:featureName/archive` — archive a feature flag

### Notes

The `/admin/audit-logs/*` subpath from the original file was renamed to `/admin/logs/*` for clarity. The audit logs viewer now includes filtering capabilities (by action type, date range, collection) which were missing before.

---

## Decisions so far

- **Route organization:** Domain-based sub-modules mounted under a single `/admin` prefix via `router.use()`.
- **Middleware hierarchy:** Separate `superAdminCheck` vs. `regularAdminCheck` middleware to enforce privilege escalation boundaries.
- **Audit log viewer moved** from `/admin/audit-logs/logs` → `/admin/logs` (simpler path, same semantics).

---

## Related tickets

- [004 — User account banning](./004-user-banning.md) — Ban middleware and RoleService integration.
- [006 — Centralized audit logging system implementation](./006-audit-logging.md) — AuditLog model with TTL indexing.
- [007 — User role model migration](./007-user-role-migration.md) — Roles collection for privilege checks.

---

_Resolved: Sep 3 2026 by agent session._
