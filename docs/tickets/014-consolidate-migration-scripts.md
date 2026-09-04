# Consolidate Migration Scripts into Single Modular Script

## Resolution Status: **RESOLVED**

### Scripts Consolidated

**New consolidated script:** `server/scripts/runMigrations.js`
- Combines all migration operations from migrateRoles.js and migrateUserRoleSchema.js
- Modular structure with four main functions:
  - `ensureDefaultSuperAdmin()` — creates system/admin@mealplan.local if no super-admin exists
  - `assignUserRoleToAll()` — assigns 'user' role to all existing users in Roles collection
  - `addRolesFieldToExistingUsers()` — adds denormalized roles field to User models for display
  - Main export runs all sections in order (or logs dry-run if --dry-run flag provided)
- Idempotent: each section checks conditions before writing

**Entry Points:**
1. **Startup hook** — `server/scripts/registerMigrations.js` imported in server.js line 29, calls `registerMigrations()` which runs `runMigrations()`
2. **Standalone runner** — `node server/scripts/runMigrations.js` for manual execution or dry-run testing

**Dry-Run Mode:** Run with `node server/scripts/runMigrations.js --dry-run` to preview changes without applying them.

### Deprecated Scripts (to be removed in next sprint)

The following legacy scripts are now deprecated and point to the consolidated implementation:
- `server/scripts/migrateRoles.js` — superseded by runMigrations.js (ensureDefaultSuperAdmin + assignUserRoleToAll)
- `server/scripts/migrateUserRoleSchema.js` — superseded by runMigrations.js (addRolesFieldToExistingUsers)

Both legacy scripts should be deleted after confirming the new script works in production.

---

### Ticket Status: Resolved

## Problem Statement

Three migration scripts exist (migrateRoles.js, initRoles.js, migrateUserRoleSchema.js) that perform nearly identical operations. This creates:
- Maintenance burden to update three files for one change
- Risk of inconsistent behavior if updates are applied to only some scripts
- Confusion about which script to run in production

## Solution

Merge into single server/scripts/runMigrations.js with modular sections and dry-run mode.

## User Stories

1. As a deploy engineer, I want one migration script to run on startup, so that I don't miss critical migrations.
2. As a developer, I want to preview migration effects without applying changes, so that I can verify impact first.
3. As a system administrator, I want idempotent migrations, so that running multiple times is safe.

## Implementation Decisions

### Script Structure

```javascript
// server/scripts/runMigrations.js

// Section 1: Setup
- Connect to MongoDB
- Load models (User, Roles)
- Create logger helper

// Section 2: Ensure Default Super-Admin Exists
async function ensureDefaultSuperAdmin() { ... }

// Section 3: Assign User Role to All Existing Users  
async function assignUserRoleToAll() { ... }

// Section 4: Add Denormalized roles Field to User Models
async function addRolesFieldToExistingUsers() { ... }

// Main export: runs all sections on startup
module.exports = async () => {
  try {
    await ensureDefaultSuperAdmin();
    await assignUserRoleToAll();
    await addRolesFieldToExistingUsers();
    console.log('[Migrations] All migrations completed successfully');
  } catch (error) { ... }
};
```

### Dry-Run Mode
Add command-line flag support:
```bash
node server/scripts/runMigrations.js --dry-run
```
In dry-run mode, log what would change but don't write to database.

### Idempotency
Each section should check if operation is needed before running:
- `ensureDefaultSuperAdmin()` only creates if no super-admin exists
- `assignUserRoleToAll()` checks Roles collection first before inserting

## Testing Decisions

- Unit test each section independently
- Integration test full migration with fresh MongoDB instance
- Verify idempotency: run twice, check no duplicate entries created
- Test dry-run mode produces correct preview output

## Out of Scope

- Changing Roles collection schema
- Adding new role types beyond user/admin/super-admin
- Modifying ban/role enforcement logic

## Further Notes

The three original scripts have different entry points (startup hook vs manual run). The consolidated script should work in both cases. Server.js already imports migrateRoles - update that import to use the consolidated script instead. Document migration order so future maintainers understand dependencies between sections.
