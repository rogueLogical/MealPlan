# Wire Business Rules Middleware to Admin Routes

## Resolution Status: **RESOLVED**

### Business Rules Middleware Wired

`ensureAdminsExist()` middleware has been wired to all user management routes that modify roles:

**Users Route (`server/routes/admin/users.js`):**
- `POST /admin/users/:userId/promote` — applies `superAdminCheck` + `ensureAdminsExist` before demotion
- `DELETE /admin/users/:userId/delete` — applies `superAdminCheck` + `ensureAdminsExist` before hard delete

**Business Rule Logic:**
- At least one super-admin must always exist (checked before any demotion/deletion)
- At least one admin or super-admin must always exist (checks Roles collection, not denormalized fields)
- Rejects with 400 status and clear message if constraint would be violated

**Other Admin Routes:** No middleware needed for these endpoints:
- `content.js` — bulk delete/cleanup operations don't affect user roles or admin counts
- `logs.js`, `features.js` — read-only or feature flag management, no role changes

---

### Ticket Status: Resolved

## Problem Statement

The `ensureAdminsExist()` middleware exists and correctly enforces the business rule that "at least one super-admin and one admin must always exist," but it is not applied to any routes. This means role demotion operations could accidentally remove all admins/super-admins from the system.

## Solution

Apply the ensureAdminsExist() middleware to all routes that modify user roles or delete users.

## User Stories

1. As a system guardian, I want every role demotion to check admin counts first, so that no single operator can cripple the system.
2. As an administrator, I want clear error messages when I try to remove the last admin, so that I don't accidentally break the system.
3. As a developer, I want middleware hooks that are obvious in route definitions, so that audit trails show business rule enforcement happened.

## Implementation Decisions

### Route Protection Matrix

| Route File | Middleware Hook | Reason |
|------------|-----------------|--------|
| `/admin/users/:id/promote` | ensureAdminsExist() before role update | Demotion must preserve at least one admin per role type |
| `/admin/users/:id/demote` | ensureAdminsExist() | Can only demote if count > 1 |
| `/admin/users/:id/delete` | ensureAdminsExist() | Never delete last admin/super-admin |
| `/admin/users/:id/ban` | No hook (ban doesn't change role) | Banning is separate from role management |

### Middleware Placement
- Insert ensureAdminsExist() in route stack BEFORE the handler function
- Return early with 400 status and message if business rule violated
- Log the check result to console for audit purposes

### Error Messages
Use consistent error format:
```javascript
return res.status(400).json({
  error: 'INSUFFICIENT_ADMIN_COUNT',
  message: 'Cannot perform operation: would leave system without required admin roles'
});
```

## Testing Decisions

- Test with 1 super-admin, 0 admins: all demotions should be blocked
- Test with 1 super-admin, 1 admin: can remove admin but not super-admin
- Test with 2+ of each: operations allowed normally
- Verify error messages are clear and actionable

## Out of Scope

- Changing the Roles collection schema
- Adding new admin roles or permission levels
- Modifying ban/unban logic (separate concern)

## Further Notes

This is a hard bug fix. The business rule exists but is not enforced. Without enforcement, the system can be left in an unrecoverable state where no admin remains to manage other users. Priority should be high.
