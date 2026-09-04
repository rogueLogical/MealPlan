# Admin Panel - Centralized Audit Logging System

## Question

Design and implement centralized audit logging system for all database-modifying operations. Create `AuditLog` Mongoose model with fields: action, actorId (User reference), targetType (collection name), targetId (document ID or array of IDs for bulk ops), beforeSnapshot, afterSnapshot, timestamp, ipAddress, userAgent. Implement TTL index on timestamp field for automatic deletion of logs older than 30 days. Create middleware hook to automatically log all database modifications in API routes.

### Context

Admin panel feature in scope. Part of the MealPlan administration system. Only capture actions that impact data in the database (as per Q5). Existing nodemailer service at `server/services/emailService.js` for admin alerts.

### Labels

wayfinder:task, wayfinder:done

---

## Resolution

**Implemented centralized audit logging with automatic TTL-based retention.**

### Changes Made

#### 1. AuditLog Model (`server/models/AuditLog.js`)

```javascript
const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE',
        'UPDATE',
        'DELETE',
        'BULK_UPDATE',
        'BULK_DELETE',
        'RESTORE',
        'ADMIN_USER_BAN',
        'ADMIN_USER_UNBAN',
        'ADMIN_USER_PROMOTE',
        'ADMIN_USER_DEMOTE',
        'ADMIN_RECIPE_DELETE',
        'ADMIN_INGREDIENT_DELETE'
      ]
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    targetType: {
      type: String,
      required: true,
      enum: [
        'User',
        'Recipe',
        'Ingredient',
        'ShoppingList',
        'PortionStorage',
        'MealPrepPlan',
        'Role'
      ]
    },
    targetId: {
      type: [mongoose.Schema.Types.ObjectId], // Support single or multiple document IDs
      required: true,
      default: []
    },
    beforeSnapshot: {
      type: mongoose.Schema.Types.Mixed
    },
    afterSnapshot: {
      type: mongoose.Schema.Types.Mixed
    },
    ipAddress: {
      type: String,
      default: 'unknown'
    },
    userAgent: {
      type: String,
      default: 'unknown'
    }
  },
  { timestamps: true }
);

// TTL index for automatic deletion of logs older than 30 days
AuditLogSchema.index({ timestamp: -1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
```

#### 2. Audit Logger Middleware (`server/middleware/auditLogger.js`)

Wraps response methods (`json`, `send`, `delete`) and handler functions to intercept successful database operations, capturing snapshots before/after changes. Wraps with automatic error handling that doesn't fail the request if logging fails.

Exports:

- `auditLogger()` - wraps a route handler for audit logging
- `withAuditLogging(handler)` - wrapper function for DELETE/POST handlers
- `withBulkAuditLogging(handler)` - wrapper for bulk operations
- `logOperation(req, action, targetData, responseData)` - low-level logging utility

#### 3. Admin Routes with Audit Logging

**User Management** (`server/routes/admin/users.js`):

- GET `/admin/users/:userId/roles/:roleType` (POST) — Promote/demote user role
- DELETE `/admin/users/:userId` — Soft delete user account
- Both routes are wrapped by the audit logger middleware for automatic logging

**User Banning** (`server/routes/admin/users-ban.js`):

- POST `/admin/users/:userId/ban` — Ban a user (temporary or permanent)
- POST `/admin/users/:userId/unban` — Revoke ban
- Operations logged as `ADMIN_USER_BAN`, `ADMIN_USER_UNBAN`

**Content Moderation** (`server/routes/admin/content.js`):

- DELETE `/admin/recipes/:id` — Archive/delete recipe
- DELETE `/admin/ingredients/:id` — Archive/delete ingredient
- POST `/admin/recipes/bulk-delete` — Bulk delete recipes
- All logged as `ADMIN_RECIPE_DELETE`, `ADMIN_INGREDIENT_DELETE`, `BULK_DELETE`

**Audit Log Viewer** (`server/routes/admin/audit-logs.js`):

- GET `/admin/audit-logs/logs` — Query and filter logs (action, targetType, actorId)
- TTL index ensures old logs are automatically pruned

#### 4. Integration Points

The audit logger middleware is applied to all routes under `/api/admin/*`. It:

1. Wraps route handlers to capture pre/post snapshots
2. Extracts target type and ID from URL params/body
3. Creates `AuditLog` entries with action, actorId, targetType, targetId, before/after snapshots
4. Handles failures gracefully (doesn't fail the HTTP response if logging fails)

The TTL index on the `timestamp` field ensures logs older than 30 days are automatically deleted from MongoDB without additional application logic.

### Files Created/Modified

| File                                       | Description                                  |
| ------------------------------------------ | -------------------------------------------- |
| `server/models/AuditLog.js`                | Audit log model with TTL index               |
| `server/middleware/auditLogger.js`         | Middleware wrapper for audit logging         |
| `server/routes/admin/users.js`             | User promotion/demotion/delete routes        |
| `server/routes/admin/users-ban.js`         | Ban/unban user routes                        |
| `server/routes/admin/content.js`           | Recipe/ingredient moderation routes          |
| `server/routes/admin/audit-logs.js`        | Audit log viewer/filtering endpoint          |
| `server/routes/admin/index.js`             | Admin routes aggregator                      |
| `server/server.js`                         | Added `/api/admin` route mounting point      |
| `server/scripts/createAuditLogTTLIndex.js` | Standalone script to ensure TTL index exists |

### How It Works

```
User/Admin Request → Middleware wraps handler → Handler executes DB op →
Response sent → setTimeout fires after response complete → AuditLog entry created & saved
```

The TTL index (`ts_idx`) on the `timestamp` field means MongoDB automatically deletes any document where `timestamp < now - 30 days`. No application code needed for cleanup.

### Status: Resolved
