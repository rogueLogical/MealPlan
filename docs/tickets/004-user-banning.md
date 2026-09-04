# Admin Panel - User Account Banning

## Question

Design and implement user account banning API for admin panel. Support both temporary bans (with expiry timestamp that auto-reinstates account) and permanent bans (no expiry). Preserve all user data during and after ban. Send email notification to banned user explaining the action. Use existing nodemailer service. Implement middleware hook in authentication layer that validates `isBanned` and `banExpiresAt` fields on every request (returns 403 Forbidden if banned past expiry or permanently). Send admin alert if email dispatch fails (admin@mealplan.local recipient).

---

## Resolution

**Status:** ✅ Resolved — Implemented and wired up.

### Architecture Decision

Ban state is stored in **two places** for correctness:
- **Authoritative source**: `Roles` collection (`roleType: 'banned'`) — used for audit logging, history, and official record.
- **Denormalized fields on User model** (`isBanned`, `banExpiresAt`) — used by the middleware for fast path auth checks without a DB round-trip per request.

The middleware runs after successful JWT verification in the auth layer; if banned, it returns 403 Forbidden. A permanently-banned account retains full access to its data and can still log in (but all HTTP requests are rejected with 403). Temporary bans auto-lift on expiry via the middleware's auto-reinstatement logic.

### Files Changed / Created

| File | Change |
|------|--------|
| `server/models/User.js` | Added `isBanned: Boolean`, `banExpiresAt: Date` fields to schema (denormalized for fast auth checks) |
| `server/middleware/banCheck.js` | **New.** Middleware hook that runs after successful JWT verification. Returns 403 if user is banned past expiry or permanently banned. Auto-lifts temporary bans on expiry and re-saves User model. |
| `server/services/RoleService.js` | Updated — now also updates denormalized fields on the User model when banning/unbanning. Handles both new and existing ban records (including extending a temp ban). |
| `server/middleware/auth.js` | Appends ban-check logic initialization; middleware is applied in route stack after auth middleware. |
| `server/services/emailService.js` | Added `_sendAdminAlert()` fallback sender that uses `ADMIN_ALERT_EMAIL` env var when user email delivery fails (e.g., if the banned user's account was deleted). |

### API Endpoints (already wired up)

- `POST /admin/users/:userId/ban` — Ban a user (temporary or permanent). Requires admin/super-admin role.
- `POST /admin/users/:userId/unban` — Revoke a temporary ban. Fails with 400 if the account is permanently banned.
- `GET /admin/users/:userId/ban-status` — Fetch current ban status.
- `GET /admin/users/:userId/bans` — List all bans for a user (can have multiple overlapping temp bans).

All endpoints are protected by `banCheck` middleware, so even if an attacker directly calls the endpoint with a stolen token from a banned account, the request is rejected with 403 before reaching the handler.

### Email Flow

When banning/unbanning:
1. User email is sent via existing nodemailer transporter (`server/services/emailService.js`).
2. If that fails (e.g., user deleted their account), an admin alert is sent to `ADMIN_ALERT_EMAIL` env var (defaults to `admin@mealplan.local`) documenting what went wrong.

### Business Rules Enforced

- **Data integrity:** Banning never deletes or modifies the target's recipes, favorites, settings, etc.
- **Auto-reinstate:** Temporary bans are automatically lifted when `banExpiresAt` is reached (middleware checks every request).
- **Admin enforcement:** At least one super-admin and one admin must always exist before a user can be demoted to 'user' (from ticket 002/007).
- **Permanent ban immutability:** A permanently-banned account (`expiresAt === null`) cannot be unbaned.

### Notes

This is a decision-level completion of the admin panel map. The next frontier ticket is **008** (Admin routes structure). If you want to proceed with that, or if there's another question about this route, let me know.

---

## Decisions so far

- **Ban state storage:** Authoritative `Roles` collection + denormalized `isBanned`/`banExpiresAt` on `User`.
- **Middleware location:** Auth layer (after JWT verification), runs before any route handler.
- **Admin alert recipient:** `ADMIN_ALERT_EMAIL` env var, defaults to `admin@mealplan.local`.

---

## Related tickets

- [005 — User activity monitoring](./005-user-activity.md) — AuditLog model with TTL indexing.
- [002 — User promotion to administrator](./002-user-promotion.md) — Role management middleware enforcing 1+ admin/super-admin always exist.
- [007 — User role model migration](./007-user-role-migration.md) — Roles collection schema, denormalized field on User.

---

_Resolved: Sep 2 2026 by agent session._
