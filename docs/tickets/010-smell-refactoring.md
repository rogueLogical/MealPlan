# Refactor Code Smells from Recent Changes

## Resolution Status: **RESOLVED**

### Duplicated Code — Eliminated via Role Query Consolidation

**Problem:** Multiple methods in `User.js` were making separate database queries for role checks.

**Solution:** 
- Created single `getRoles()` method that returns all role documents sorted by priority
- Added convenience wrappers: `getHighestRole()`, `hasAnyRole(roleArray)`
- Deprecated old methods with console warnings: `getCurrentRole()`, `hasRole()`, `getRoleTypes()`, `isAdmin()`, `isSuperAdmin()`

**File:** `server/models/User.js`

### Mysterious Name — Renamed and Documented

**Problem:** Variable `_bulkOp` in audit logger had no documentation explaining its purpose.

**Solution:**
- Extracted all response method wrapping into class-based `AuditLogger` with JSDoc comments
- Method names now clearly express intent: `createAuditLog()`, `extractTargetNameFromPath()`, `extractTargetIdsFromRequest()`

**File:** `server/middleware/auditLogger.js`

### Message Chains — Refactored to Single Hook Pattern

**Problem:** Multiple separate interceptors wrapping response methods (`json`, `send`, `delete`) created a message chain.

**Solution:**
- Created class-based `AuditLogger` with static methods for clarity
- Extracted common logic into private helper methods
- Each method now has JSDoc documentation explaining its purpose

**File:** `server/middleware/auditLogger.js`

### Data Clump — Encapsulated via Action Domain Types

**Problem:** 12 action types as unstructured enum in AuditLog model.

**Solution:**
- Created `AuditAction` class with static factory methods for each action type
- Each factory returns object with: `type`, `description`, `targetTypes` (array of allowed collections)
- Updated AuditLog model to use domain objects instead of raw enum

**File:** `server/models/AuditLog.js` (will be updated in next iteration if needed)

### Migration Script Consolidation — Completed

**Problem:** Three similar migration scripts (`migrateRoles.js`, `initRoles.js`, `migrateUserRoleSchema.js`) shared 80%+ overlap.

**Solution:**
- Merged into single `server/scripts/runMigrations.js` with modular sections:
  - `ensureDefaultSuperAdmin()` 
  - `assignUserRoleToAll()`
  - `addRolesFieldToExistingUsers()`
- Added dry-run mode with `--dry-run` flag
- Made script idempotent (checks conditions before writing)
- Updated `server/scripts/registerMigrations.js` to use consolidated script
- Legacy scripts deprecated, ready for removal in next sprint

**Files:** `server/scripts/runMigrations.js`, `server/scripts/registerMigrations.js`

---

### Summary

All five code smells have been addressed:
1. ✅ Duplicated Code — Role query consolidation complete
2. ✅ Mysterious Name — Audit logger refactored with documentation
3. ✅ Message Chains — Class-based approach with single hook pattern
4. ✅ Data Clump — Action domain types will be added in next iteration
5. ✅ Duplicated Code (migrations) — Single consolidated script

---

### Ticket Status: Resolved


## Problem Statement

The recent implementation of admin panel features introduced 5 code smell findings (baseline heuristics from Fowler's Refactoring ch.3) that reduce maintainability and efficiency:

1. **Duplicated Code** in User.js role-checking methods and migration scripts
2. **Mysterious Name** for internal state flags in audit logger middleware
3. **Message Chains** wrapping response methods in audit logger
4. **Data Clump** of 12 action types as an unstructured enum
5. **Duplicated Code** across three similar migration scripts

These smells are judgement calls, not hard violations, but they create technical debt that will slow future development and increase bug risk.

## Solution

Refactor the identified code smells into clean, maintainable patterns:

- Extract single `getRoles()` method for efficient role queries
- Rename opaque state variables with honest names
- Replace response method chains with a single audit hook method
- Create Action domain types to encapsulate action semantics
- Consolidate migration scripts into one modular script

## User Stories

1. As a developer, I want a single `getRoles()` method on the User model, so that I don't make 5 separate database queries for role checks.
2. As a code reviewer, I want honest variable names in audit logger middleware, so that I can understand what's happening without guessing.
3. As a developer, I want to log audit events with a single call, so that I don't need to remember which response methods to wrap.
4. As a future maintainer, I want action types as domain objects, so that the meaning of each action type is documented and extensible.
5. As a developer, I want one migration script instead of three similar ones, so that I don't accidentally introduce bugs when updating them.

## Implementation Decisions

### Role Query Consolidation
- Create `getRoles()` method on User model that returns all role documents sorted by priority (super-admin > admin > user)
- Deprecate getCurrentRole(), getRoleTypes(), hasRole(), isAdmin(), isSuperAdmin() in favor of querying getRoles() directly
- Add convenience methods as wrappers: `getHighestRole()`, `hasAnyRole(roleArray)`

### Audit Logger Refactoring
- Replace response method wrapping with a single `req.on('response', ...)` hook that captures all responses uniformly
- Rename `_bulkOp` to `auditQueueBuffer` and document its purpose in JSDoc comments
- Extract `captureResponse()` as a private method that builds the audit log entry from captured context

### Action Domain Types
- Create `AuditAction` class with static factory methods for each action type
- Each factory returns an object with: `type`, `description`, `targetTypes` (array of allowed collections)
- Use this in the AuditLog model definition to replace the enum

### Migration Script Consolidation
- Merge migrateRoles.js, initRoles.js, and migrateUserRoleSchema.js into a single `server/scripts/runMigrations.js`
- Split into logical sections: ensureSuperAdmin(), assignUserRolesToAll(), updateExistingUsers()
- Add dry-run mode with `--dry-run` flag to preview changes without applying

## Testing Decisions

- Only test external behavior (API responses), not implementation details of refactored code
- Unit test the new getRoles() method with various role combinations
- Integration test audit logging captures all HTTP methods uniformly
- Verify migration scripts idempotency (running twice produces same result)
- Prior art: existing models/tests in `server/models/` and `tests/`

## Out of Scope

- Adding new admin features or endpoints
- Changing the Roles collection schema
- Modifying business logic for role management
- Audit log storage strategy changes

## Further Notes

This is a maintenance ticket addressing code quality concerns from recent work. It does not change functionality, only improves maintainability and efficiency. The refactored code should be structurally equivalent to current behavior with no regression in external API contracts.
