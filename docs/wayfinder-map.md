# Admin Panel Implementation

## Destination

Design and implement admin panel for MealPlan including API endpoints, user role management (super-admin/admin/user via separate collection), centralized audit logging for database-modifying actions (30-day TTL), admin routes under /admin/*, recipe/ingredient database management with email notifications (nodemailer + admin alerts on failure), feature flag system exploration and selection, temporary/permanent user banning with email notifications.

## Notes

Domain: Admin system architecture, authentication middleware, audit logging, API design patterns. Skills to consult: grilling, domain-modeling. Architecture constraints: Mongoose models, MongoDB, existing nodemailer service at `server/services/emailService.js`. Business rules: enforce at least one super-admin and one admin always exist; temporary bans auto-reinstate on expiry; user data persists during/after ban.

**Feature Flag Decision**: Using Unleash (self-hosted) as determined by ticket 003, or MongoDB collection for simple initial implementation.

## Decisions so far

- **[001 - Recipe and ingredient database management](docs/tickets/001-recipe-database.md)**: **Admin endpoints** created at `/admin/ingredients/:id/delete` and `/admin/recipes/:id/delete`; **Cleaning operations**: (a) push macro updates from ingredient to all affected recipes, (b) AI-powered macronutrient review with dashboard report; **Email templates**: friendly tone, "[MealPlan] Your recipe has been archived by admin" subject, includes recipe title/author/timestamp/reason with link to details; **Admin alerts**: placeholder `admin-alerts@mealplan.local` env var `ADMIN_ALERT_EMAIL`. Status: resolved.
- **[005 - User activity monitoring](docs/tickets/005-user-activity.md)**: **AuditLog model** created at `server/models/AuditLog.js` with fields: action (enum CREATE/UPDATE/DELETE/BULK_UPDATE/etc), actorId/User ref, targetType (User/Recipe/Ingredient/etc), targetId (array of document IDs - supports bulk operations), beforeSnapshot/afterSnapshot (mongoose objects), timestamp (auto-set by Mongoose timestamps), ipAddress (from req.ip), userAgent (from req.get('user-agent')); **TTL index**: automatic deletion of logs older than 30 days via MongoDB TTL index on timestamp field; **Middleware hook**: auditLogger middleware at `server/middleware/auditLogger.js` wraps response methods (json, send) to intercept successful database operations in admin routes and create log entries with operation context. Status: resolved.
- **[002 - User promotion to administrator](docs/tickets/002-user-promotion.md)**: **Roles collection schema** defined with userId reference, roleType enum (user/admin/super-admin), grantedBy/expiredAt fields; **User model migration**: add denormalized `roles` field for display while using Roles collection as authoritative source; **API endpoints**: POST `/admin/users/:userId/roles/:roleType` (grant) and DELETE `/admin/users/:userId/roles/:roleType` (revoke); **Business rules**: middleware enforces at least one super-admin and one admin always exist before allowing removal; **Email notifications**: role change alerts to user and admin@mealplan.local on failures. Status: resolved.
- **[003 - Feature flag system exploration](docs/tickets/003-feature-flags.md)**: **Unleash (self-hosted)** recommended as primary choice due to zero cost, real-time API updates, SDK integration with Express.js, version history for rollback, no vendor lock-in; **Implementation decision**: use Docker Compose self-hosting or MongoDB collection for initial simple implementation with 5-minute cache TTL. Status: resolved.

## Not yet specified

- **User role model migration**: Add `roles: [{ roleType: { enum: ['user', 'admin', 'super-admin'] } }]` field to User schema (multi-role support), create separate Roles collection with userId reference, grantBy/grantReason/expiredAt timestamps, implement business rule ensuring 1+ super-admin and 1+ admin always exist
- **Admin routes structure**: Create `server/routes/admin/` directory with dedicated controllers for user management (ban/unban, promote/demote role, delete account), content moderation (bulk delete/cleanup/restore deleted), audit log viewer/filtering, feature flag toggle/config; implement super-admin verification middleware separate from regular auth check
- **Admin frontend design**: Design admin UI components using existing Angular framework for dashboard, user management interface, audit log viewer, role editor
- **Ban enforcement middleware**: Create middleware hook in authentication layer (existing auth checks) that validates user's `isBanned` and `banExpiresAt` fields on every request; returns 403 Forbidden if banned
- **Email alert system**: Extend nodemailer service at `server/services/emailService.js` to send admin alerts when email dispatch fails; fallback recipient: admin@mealplan.local

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
| [004](docs/tickets/004-user-banning.md) | User account banning (temp/permanent, email notifications to user, admin alerts on email failure) | Open | wayfinder:task | 007 |
| [005](docs/tickets/005-user-activity.md) | User activity monitoring (centralized audit logging with 30-day TTL, middleware hook) | Resolved | wayfinder:task,wayfinder:done | — |
| [006](docs/tickets/006-audit-logging.md) | Centralized audit logging system implementation (AuditLog model, TTL indexing, automatic logging middleware) | Open | wayfinder:task | 005 |
| [007](docs/tickets/007-user-role-migration.md) | User role model migration (add roles field to User model, create Roles collection, enforce admin count business rule) | Open | wayfinder:task | — |
| [008](docs/tickets/008-admin-routes.md) | Admin routes and controllers structure (/admin/* paths, dedicated middleware, controller organization) | Open | wayfinder:task | 006, 007 |
| [009](docs/tickets/009-audit-logger-integration.md) | Integrate audit logger middleware into existing API routes (server/routes/*.js) | Resolved | wayfinder:task,wayfinder:done | 005 |

**Ticket hierarchy**: 
- **006 → 008**: Audit logging system (006) is prerequisite for admin routes (008)
- **007 → 004, 008**: Role model migration (007) enables banning (004) and admin operations (008)
- **005 → 006**: User activity monitoring (005) is prerequisite for full audit logging implementation (006)
- **009** integrates auditLogger middleware into existing routes after model/middleware created

All tickets are unblocked except:
- **008** blocks on 006 and 007 completion
- **004** blocks on 007 completion

Frontier tickets (open, unblocked): 006, 007, 004

---

## Decisions so far

- [001 - Recipe and ingredient database management](docs/tickets/001-recipe-database.md): **Admin endpoints** created at `/admin/ingredients/:id/delete` and `/admin/recipes/:id/delete`; **Cleaning operations**: (a) push macro updates from ingredient to all affected recipes, (b) AI-powered macronutrient review with dashboard report; **Email templates**: friendly tone, "[MealPlan] Your recipe has been archived by admin" subject, includes recipe title/author/timestamp/reason with link to details; **Admin alerts**: placeholder `admin-alerts@mealplan.local` env var `ADMIN_ALERT_EMAIL`. Status: resolved.
