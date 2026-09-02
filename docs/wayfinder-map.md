# Admin Panel Implementation

## Destination

Design and implement admin panel for MealPlan including API endpoints, user role management (super-admin/admin/user via separate collection), centralized audit logging for database-modifying actions (30-day TTL), admin routes under /admin/*, recipe/ingredient database management with email notifications (nodemailer + admin alerts on failure), feature flag system exploration and selection, temporary/permanent user banning with email notifications.

## Notes

Domain: Admin system architecture, authentication middleware, audit logging, API design patterns. Skills to consult: grilling, domain-modeling. Architecture constraints: Mongoose models, MongoDB, existing nodemailer service at `server/services/emailService.js`. Business rules: enforce at least one super-admin and one admin always exist; temporary bans auto-reinstate on expiry; user data persists during/after ban.

**Feature Flag Decision**: Using Unleash (self-hosted) as determined by ticket 003, or MongoDB collection for simple initial implementation.

## Decisions so far (Summary)
<!-- Detailed decisions listed below -->
- [001 - Recipe and ingredient database management](docs/tickets/001-recipe-database.md) - Resolved
- [005 - User activity monitoring](docs/tickets/005-user-activity.md) - Resolved  
- [002 - User promotion to administrator](docs/tickets/002-user-promotion.md) - Resolved
- [003 - Feature flag system exploration](docs/tickets/003-feature-flags.md) - Resolved
- [007 - User role model migration](docs/tickets/007-user-role-migration.md) - Resolved

## Not yet specified

- **Ban enforcement middleware**: Create middleware hook in authentication layer (`server/middleware/auth.js`) that validates user's `isBanned` and `banExpiresAt` fields on every request; returns 403 Forbidden if banned (covered by ticket 004)
- **Email alert system for admin operations**: Extend nodemailer service at `server/services/emailService.js` to send admin alerts when email dispatch fails; fallback recipient: admin@mealplan.local (see ticket 004, 001)

**Feature Flag Decision Applied**: Using Unleash (self-hosted) as determined by ticket 003, or MongoDB collection for simple initial implementation.

## Out of scope

<!-- work ruled beyond the destination -->
<!-- empty for now - will be populated if decisions rule out-of-scope items -->

---

### Map Tickets

| ID | Title | Status | Labels | Blocking |
|----|-------|--------|--------|----------|
| [001](docs/tickets/001-recipe-database.md) | Recipe and ingredient database management (admin delete/clean operations with email notifications) | Resolved | wayfinder:research,wayfinder:done | — |
| [002](docs/tickets/002-user-promotion.md) | User promotion to administrator (role model migration, enforce 1+ admin/super-admin exist) | Resolved | wayfinder:research,wayfinder:done | — |
| [003](docs/tickets/003-feature-flags.md) | Feature flag system exploration and selection (Unleash/LaunchDarkit vs MongoDB-based) | Resolved | wayfinder:research,wayfinder:done | — |
| [004](docs/tickets/004-user-banning.md) | User account banning (temp/permanent, email notifications to user, admin alerts on email failure) | Open | wayfinder:task | 008 |
| [005](docs/tickets/005-user-activity.md) | User activity monitoring (centralized audit logging with 30-day TTL, middleware hook) | Resolved | wayfinder:task,wayfinder:done | — |
| [006](docs/tickets/006-audit-logging.md) | Centralized audit logging system implementation (AuditLog model, TTL indexing, automatic logging middleware) | Open | wayfinder:task | 005 |
| [007](docs/tickets/007-user-role-migration.md) | User role model migration (add roles field to User model, create Roles collection, enforce admin count business rule) | Resolved | wayfinder:task,wayfinder:done | — |
| [008](docs/tickets/008-admin-routes.md) | Admin routes and controllers structure (/admin/* paths, dedicated middleware, controller organization) | Open | wayfinder:task | 006 |

**Ticket hierarchy**: 
- **006 → 008**: Audit logging system (006) is prerequisite for admin routes (008)
- **005 → 006**: User activity monitoring (005) is prerequisite for full audit logging implementation (006)

All tickets are unblocked except:
- **008** blocks on 006 completion

Frontier tickets (open, unblocked): 006, 004

---

## Detailed Decisions

### 001 - Recipe and ingredient database management

**Admin endpoints** created at `/admin/ingredients/:id/delete` and `/admin/recipes/:id/delete`; **Cleaning operations**: (a) push macro updates from ingredient to all affected recipes, (b) AI-powered macronutrient review with dashboard report; **Email templates**: friendly tone, "[MealPlan] Your recipe has been archived by admin" subject, includes recipe title/author/timestamp/reason with link to details; **Admin alerts**: placeholder `admin-alerts@mealplan.local` env var `ADMIN_ALERT_EMAIL`.

### 005 - User activity monitoring

**AuditLog model** created at `server/models/AuditLog.js` with fields: action (enum CREATE/UPDATE/DELETE/BULK_UPDATE/etc), actorId/User ref, targetType (User/Recipe/Ingredient/etc), targetId (array of document IDs - supports bulk operations), beforeSnapshot/afterSnapshot (mongoose objects), timestamp (auto-set by Mongoose timestamps), ipAddress (from req.ip), userAgent (from req.get('user-agent')); **TTL index**: automatic deletion of logs older than 30 days via MongoDB TTL index on timestamp field; **Middleware hook**: auditLogger middleware at `server/middleware/auditLogger.js` wraps response methods (json, send) to intercept successful database operations in admin routes and create log entries with operation context.

### 002 - User promotion to administrator

**Roles collection schema** defined with userId reference, roleType enum (user/admin/super-admin), grantedBy/expiredAt fields; **User model migration**: add denormalized `roles` field for display while using Roles collection as authoritative source; **API endpoints**: POST `/admin/users/:userId/roles/:roleType` (grant) and DELETE `/admin/users/:userId/roles/:roleType` (revoke); **Business rules**: middleware enforces at least one super-admin and one admin always exist before allowing removal; **Email notifications**: role change alerts to user and admin@mealplan.local on failures.

### 003 - Feature flag system exploration

**Unleash (self-hosted)** recommended as primary choice due to zero cost, real-time API updates, SDK integration with Express.js, version history for rollback, no vendor lock-in; **Implementation decision**: use Docker Compose self-hosting or MongoDB collection for initial simple implementation with 5-minute cache TTL.

### 007 - User role model migration

**Roles collection** created at `server/models/Roles.js` with fields: userId, roleType (user/admin/super-admin), grantedBy, grantReason, expiresAt (nullable); **User model** updated at `server/models/User.js` with denormalized roles field and helper methods (`getCurrentRole`, `hasRole`, `isAdmin`, `isSuperAdmin`); **Business rule middleware** at `server/middleware/businessRules.js` enforces at least one super-admin + one admin; **Migration scripts** created at `server/scripts/migrateRoles.js` and `server/scripts/runMigrations.js`; default super-admin credentials: username `system`, email `admin@mealplan.local`, password `admin`.
