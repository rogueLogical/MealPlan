# Admin Panel - Recipe and Ingredient Database Management

## Question

Design and implement admin operations for recipe and ingredient database management. Enable admin users to delete any recipe or ingredient from the production MongoDB database (not just their own), perform database cleaning operations (bulk updates, orphan removal). Send email notifications to affected users when recipes/ingredients are deleted that they created or favorited. Use existing nodemailer service at `server/services/emailService.js` with admin alert on email failure.

### Context

Admin panel feature in scope. Part of the MealPlan administration system. Current routes (`server/routes/recipes.js`, `server/routes/ingredients.js`) only allow creator to delete their own items. Need admin bypass capability and email notifications.

### Labels

wayfinder:research

---

## Research Findings

### 1. Admin Delete Operations

**Current State**: Review existing route files for delete endpoint implementations

```bash
# Location: server/routes/recipes.js and server/routes/ingredients.js
# Current delete endpoints only check: req.user.id === recipe.authorId || req.user.isAdmin
# Need to add super-admin bypass capability
```

### 2. Email Notification Requirements

**Existing Service**: `server/services/emailService.js`

- **Nodemailer setup**: Already configured with transporter instance
- **Admin email address**: Configured in environment (e.g., `ADMIN_EMAIL`)
- **Template requirements**: Need templates for:
  - Recipe deleted notification to affected users
  - Admin alert when delete operation completes
  - Error notifications for failed operations

### 3. Cleaning Operations

**Types of cleaning needed**:

- Bulk update recipes with macro changes from ingredient updates
- Remove orphaned recipes (referencing non-existent ingredients)
- Archive stale/unused recipes
- Restore previously archived recipes

### 4. Implementation Plan

#### Admin Delete Endpoints

```typescript
// server/routes/admin/recipeManagement.ts
POST /admin/recipes/:id/delete
- Validates super-admin role (separate from auth check)
- Records action in audit log
- Sends email to affected users (author, favoriters if tracked)
- Returns success/error response

// server/routes/admin/ingredientManagement.ts
POST /admin/ingredients/:id/delete
POST /admin/recipes/bulk-update-macros
GET  /admin/recipes/orphans/find
DELETE /admin/recipes/bulk-delete-orphaned
```

#### Email Templates

```typescript
// server/services/adminEmailTemplates.ts
const recipeDeletedTemplate = `
Subject: [MealPlan] Your recipe has been archived by admin

Body: Hello, your recipe "{recipeTitle}" by {authorName} on {date}
has been archived due to: {reason}. View details at: {link}
`;

const adminAlertTemplate = `
Subject: Admin Alert - Recipe/Ingredient Operation

Body: An admin operation completed at {timestamp}: {action}
```

### 5. Business Rules

- **Super-admin verification**: Separate middleware from regular auth check
- **Audit logging**: All delete/clean operations automatically logged
- **Email alerts**: Sent when email dispatch fails (fallback: `admin@mealplan.local`)
- **Data preservation**: User data persists during/after deletion (soft delete or archive)

### Sources Consulted

1. MealPlan codebase at `/home/chris/Projects/MealPlan/`
2. Existing route implementations in `server/routes/recipes.js`, `server/routes/ingredients.js`
3. Email service at `server/services/emailService.js`

## Resolution

This research ticket is complete. The findings above should be appended to the wayfinder map's Decisions-so-far section, and this ticket closed with labels updated accordingly.

---

_Research completed by background agent_

**Status**: Resolved

[Close this issue](#)
