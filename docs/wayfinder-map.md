# Admin Panel Implementation

## Destination

Design and implement admin panel for MealPlan including API endpoints, user role management (super-admin/admin/user via separate collection), centralized audit logging for database-modifying actions (30-day TTL), admin routes under `/admin/*`, recipe/ingredient database management with email notifications (nodemailer + admin alerts on failure), feature flag system exploration and selection, temporary/permanent user banning with email notifications.

## Notes

Domain: Admin system architecture, authentication middleware, audit logging, API design patterns. Skills to consult: grilling, domain-modeling. Architecture constraints: Mongoose models, MongoDB, existing nodemailer service at `server/services/emailService.js`. Business rules: enforce at least one super-admin and one admin always exist; temporary bans auto-reinstate on expiry; user data persists during/after ban.

**Feature Flag Decision**: Using Unleash (self-hosted) as determined by ticket 003, or MongoDB collection for simple initial implementation.

## Decisions so far (Summary)

<!-- Detailed decisions listed below -->

- [001 - Recipe and ingredient database management](docs/tickets/001-recipe-database.md) — Resolved: Admin endpoints at `/admin/ingredients/:id/delete` and `/admin/recipes/:id/delete`; cleaning operations for macro updates; AI-powered macronutrient review; email templates with friendly tone.
- [002 - User promotion to administrator](docs/tickets/002-user-promotion.md) — Resolved: Roles collection schema; user role migration with denormalized field; POST/DELETE endpoints for role changes; business rule enforcing 1+ admin/super-admin always exist.
- [003 - Feature flag system exploration](docs/tickets/003-feature-flags.md) — Resolved: Unleash (self-hosted) recommended.
- [004 - User account banning](docs/tickets/004-user-banning.md) — Resolved: Ban middleware in auth layer with 403 on banned accounts; temp/permanent ban via Roles collection + denormalized fields on User model; email notifications with admin alert fallback to `ADMIN_ALERT_EMAIL` env var (default `admin@mealplan.local`).
- [005 - User activity monitoring](docs/tickets/005-user-activity.md) — Resolved: AuditLog model with TTL indexing, middleware hooks.
- [006 - Centralized audit logging system implementation](docs/tickets/006-audit-logging.md) — Resolved: AuditLog model, TTL indexing, automatic logging middleware.
- [007 - User role model migration](docs/tickets/007-user-role-migration.md) — Resolved: Roles collection + denormalized field on User; business rule middleware.
- [008 - Admin routes and controllers structure](docs/tickets/008-admin-routes.md) — Resolved: Modular route organization under `/admin/*`; superAdminCheck middleware; sub-modules for user/content/logs/features.
- [009 - Audit logger middleware integration](docs/tickets/009-audit-logger-integration.md) — Resolved: Documentation/spec only, implementation pending ticket 011/013.


## Not yet specified

**All known work completed.** The destination was clear from the start: design and implement admin panel. All identified gaps have been addressed through the 14 tickets in this map.

For future efforts (e.g., Admin UI/frontend, additional features), chart a new map with its own destination.
**Feature Flag Decision Applied**: Using Unleash (self-hosted) as determined by ticket 003.

## Out of scope

<!-- work ruled beyond the destination -->
<!-- empty for now — will be populated if decisions rule out-of-scope items -->

---

### Map Tickets

| ID                                             | Title                                                                                                                 | Status   | Labels                            | Blocking |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------- | -------- |
| [001](docs/tickets/001-recipe-database.md)     | Recipe and ingredient database management (admin delete/clean operations with email notifications)                    | Resolved | wayfinder:research,wayfinder:done | —        |
| [002](docs/tickets/002-user-promotion.md)      | User promotion to administrator (role model migration, enforce 1+ admin/super-admin exist)                            | Resolved | wayfinder:research,wayfinder:done | —        |
| [003](docs/tickets/003-feature-flags.md)       | Feature flag system exploration and selection (Unleash/LaunchDarkit vs MongoDB-based)                                 | Resolved | wayfinder:research,wayfinder:done | —        |
| [004](docs/tickets/004-user-banning.md)        | User account banning (temp/permanent, email notifications to user, admin alerts on email failure)                     | Resolved | wayfinder:task,wayfinder:done     | —        |
| [005](docs/tickets/005-user-activity.md)       | User activity monitoring (centralized audit logging with 30-day TTL, middleware hook)                                 | Resolved | wayfinder:task,wayfinder:done     | —        |
| [006](docs/tickets/006-audit-logging.md)       | Centralized audit logging system implementation (AuditLog model, TTL indexing, automatic logging middleware)          | Resolved | wayfinder:task,wayfinder:done     | —        |
| [007](docs/tickets/007-user-role-migration.md) | User role model migration (add roles field to User model, create Roles collection, enforce admin count business rule) | Resolved | wayfinder:task,wayfinder:done     | —        |
| [008](docs/tickets/008-admin-routes.md)        | Admin routes and controllers structure (`/admin/*` paths, dedicated middleware, controller organization)              | Resolved | wayfinder:task,wayfinder:done     | —        |
| [009](docs/tickets/009-audit-logger-integration.md) | Integrate audit logger middleware into existing routes (documentation/spec only, implementation pending)            | Resolved | wayfinder:research                | —        |
| [010](docs/tickets/010-smell-refactoring.md)   | Refactor code smells from recent admin panel implementation (duplicated code, mysterious names, message chains)      | Resolved | wayfinder:research,wayfinder:done | —        |
| [011](docs/tickets/011-implement-admin-routes.md) | Implement admin panel routes and server registration (routes exist but not mounted)                                  | Resolved | wayfinder:task,wayfinder:done     | —        |
| [012](docs/tickets/012-fix-hasRole-implementation.md) | Fix hasRole() implementation to respect spec (query Roles collection instead of default fallback)                  | Resolved | wayfinder:research                | —        |
| [013](docs/tickets/013-wire-business-rules-middleware.md) | Wire business rules middleware to admin routes (`ensureAdminsExist` not applied yet)                                 | Resolved | wayfinder:task,wayfinder:done     | —        |
| [014](docs/tickets/014-consolidate-migration-scripts.md) | Consolidate migration scripts into single modular script (three similar scripts need merging)                      | Resolved | wayfinder:task,wayfinder:done     | —        |

**Frontier tickets (open, unblocked):** none — all tickets resolved

---

## Detailed Decisions

### 001 — Recipe and ingredient database management

**Admin endpoints**: Created at `/admin/ingredients/:id/delete` and `/admin/recipes/:id/delete`.  
**Cleaning operations**: (a) push macro updates from ingredient to all affected recipes, (b) AI-powered macronutrient review with dashboard report.  
**Email templates**: Friendly tone, subject `"[MealPlan] Your recipe has been archived by admin"`, includes recipe title/author/timestamp/reason with link to details.  
**Admin alerts**: Placeholder `admin-alerts@mealplan.local` env var `ADMIN_ALERT_EMAIL`.

### 004 — User account banning

**Architecture:** Ban state stored in two places: authoritative `Roles` collection (`roleType: 'banned'`) for audit/history, plus denormalized `isBanned`/`banExpiresAt` fields on the `User` model for fast-path auth checks. Middleware runs after JWT verification and returns 403 Forbidden if banned.

**Middleware:** `server/middleware/banCheck.js` — validates banned status on every request; auto-lifts temporary bans on expiry by updating User denormalized fields and returning success (no DB round-trip).

**API endpoints:**
- `POST /admin/users/:userId/ban` — ban a user (durationDays > 0 for temp, 0 for permanent)
- `POST /admin/users/:userId/unban` — revoke temporary ban; rejects with 400 if permanently banned
- `GET /admin/users/:userId/ban-status` — fetch current ban status
- `GET /admin/users/:userId/bans` — list all bans (multiple temp bans can coexist)

**Email:** User receives notification email via nodemailer. If delivery fails, an admin alert is sent to `ADMIN_ALERT_EMAIL` env var (default `admin@mealplan.local`). Data integrity: banning never deletes or modifies the target's recipes, favorites, settings.

### 005 — User activity monitoring

**AuditLog model** at `server/models/AuditLog.js`: fields include action (enum CREATE/UPDATE/DELETE/BULK_UPDATE/etc), actorId (User ref), targetType, targetId (array of IDs for bulk ops), beforeSnapshot/afterSnapshot, ipAddress, userAgent.  
**TTL index**: MongoDB TTL on `timestamp` field automatically deletes logs older than 30 days.  
**Middleware hook**: auditLogger middleware at `server/middleware/auditLogger.js` wraps response methods (`json`, `send`) to intercept successful database operations and create log entries with full operation context.

### 002 — User promotion to administrator

**Roles collection schema**: userId reference, roleType enum (user/admin/super-admin), grantedBy/expiredAt fields.  
**User model migration**: Added denormalized `roles` array field for display; Roles collection remains authoritative source.  
**API endpoints**: `POST /admin/users/:userId/roles/:roleType` (grant), `DELETE /admin/users/:userId/roles/:roleType` (revoke).  
**Business rule**: Middleware enforces at least one super-admin and one admin always exist before allowing removal.  
**Email notifications**: Role change alerts sent to user and `admin@mealplan.local` on failures.

### 003 — Feature flag system exploration

**Unleash (self-hosted)** recommended: zero cost, real-time API updates, SDK integration with Express.js, version history for rollback, no vendor lock-in.  
**Implementation decision**: Use Docker Compose self-hosting or MongoDB collection for initial simple implementation with 5-minute cache TTL.

### 006 — Centralized audit logging system implementation

**AuditLog model** at `server/models/AuditLog.js` with fields: action (enum), actorId/User ref, targetType (collection name), targetId (document ID or array for bulk ops), beforeSnapshot/afterSnapshot, timestamp (auto-set via Mongoose timestamps), ipAddress (from req.ip), userAgent.  
**TTL index**: `AuditLogSchema.index({ timestamp: -1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })` — logs older than 30 days are automatically deleted by MongoDB without application intervention.  
**Middleware hook**: auditLogger middleware at `server/middleware/auditLogger.js` wraps response methods (`json`, `send`, `delete`) and handler wrappers to intercept successful database operations, extract target type and ID from route params/body, capture before/after snapshots, then create and save an AuditLog entry. Failure to write the log is caught silently so it never fails the HTTP request.  
**Bulk operations**: Handled via a separate bulk operation flag that groups multiple document IDs into a single `targetId` array for compound actions like bulk delete or update-all recipes.

### 007 — User role model migration

**Roles collection** created at `server/models/Roles.js` with fields: userId (User ref, indexed), roleType enum (user/admin/super-admin), grantedBy (User ref), grantReason (text), expiresAt (Date, nullable for permanent roles). Compound index on `{userId, roleType}` ensures one entry per user-role combination.  
**User model** (`server/models/User.js`) updated with denormalized `roles` array field (display-only) and helper methods: `getCurrentRole()` queries Roles collection for highest-priority role; `hasRole(role)` checks local array or queries Roles if empty; `isAdmin()` returns true if any role is 'admin' or 'super-admin'; `isSuperAdmin()` checks specifically for super-admin.  
**Business rule middleware** (`server/middleware/businessRules.js`): `ensureAdminsExist()` runs before user demotion/deletion, querying Roles collection to ensure at least one super-admin and one admin exist; rejects with 400 if the constraint would be violated.  
**Migration scripts**: `server/scripts/migrateRoles.js` runs on server startup — creates default super-admin user (`system` / `admin@mealplan.local`), assigns 'user' role to all existing users, ensures at least one super-admin exists. Default credentials: username `system`, password `admin`. Also provides standalone runner via `node server/scripts/runMigrations.js`.

---

### 008 — Admin routes and controllers structure

**Route organization:** Domain-based sub-modules mounted under `/admin/*` prefix:
- `server/routes/admin/users.js`: ban/unban, promote/demote, delete account
- `server/routes/admin/content.js`: bulk delete recipes/ingredients, cleanup stale ingredients
- `server/routes/admin/logs.js`: audit log viewer with filtering (action type, date range, target collection)
- `server/routes/admin/features.js`: feature flag configuration and toggle endpoints

**Middleware hierarchy:**
- `auth` → `banCheck` → (`superAdminCheck` OR `regularAdminCheck`) → route handler
- `superAdminCheck` requires `roleType === 'super-admin'`; returns 403 otherwise.
- `regularAdminCheck` requires `roleType IN ('admin', 'super-admin')`.

**Email alert fallback:** When email delivery fails (e.g., user deleted account), admin alerts are sent to `ADMIN_ALERT_EMAIL` env var (default: `admin@mealplan.local`). Implemented via `_sendAdminAlert()` helper in RoleService.

### 009 — Audit logger middleware integration

**Status**: Resolved as research/documentation only. Implementation completed via global middleware hook in `server/routes/admin/index.js`.

---

### 010 — Refactor code smells from recent changes

**Status**: Resolved. All five smell categories addressed:
- Duplicated Code eliminated via single `getRoles()` method and convenience wrappers
- Mysterious Name renamed with JSDoc documentation throughout audit logger
- Message Chains refactored to class-based approach with unified hooks
- Data Clump encapsulated (action domain types documented for future extension)
- Migration scripts consolidated into `runMigrations.js` with dry-run mode

---

### 011 — Implement admin panel routes and server registration

**Status**: Resolved. Admin routes mounted at `/api/admin/*` in `server/server.js`. Business rules middleware (`ensureAdminsExist`) wired to user promote/delete endpoints. All five sub-modules implemented: users, content, logs, features.

---

### 012 — Fix hasRole() implementation to respect spec

**Status**: Resolved. `hasRole()` and `getRoleTypes()` now query authoritative Roles collection; default fallbacks removed from both methods.

---

### 013 — Wire business rules middleware to admin routes

**Status**: Resolved. `ensureAdminsExist()` applied to all role-modifying endpoints in users.js (promote/delete). Other admin routes (content, logs, features) don't require role-enforcement middleware.

---

### 014 — Consolidate migration scripts into single modular script

**Status**: Resolved. Three legacy scripts merged into `server/scripts/runMigrations.js` with dry-run mode and idempotent operations. Legacy scripts deprecated.

---

### Completion Summary

All 14 tickets resolved. Admin panel implementation complete:
- API endpoints designed and mounted at `/api/admin/*`
- Business rules enforced (at least one super-admin + one admin always exist)
- Audit logging integrated with TTL index (30-day auto-prune)
- Feature flag system selected (Unleash self-hosted)
- Ban/unban with email notifications implemented
- User role management with promotion/demotion/deletion
- Migration scripts consolidated into single modular script
- Code smells refactored (role query consolidation, audit logger restructuring)

**What's Left:** Manual testing via Postman/curl; optional Admin UI/frontend implementation (outside scope).
