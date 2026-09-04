# Implement Admin Panel Routes and Server Registration

## Problem Statement

The recent work created comprehensive design documents (tickets 001-009) for admin panel features, but the actual API routes were never registered with Express. Users cannot access:

- Recipe/ingredient delete endpoints
- User promotion/demotion/ban endpoints  
- Audit log viewer endpoint
- Feature flag toggle endpoints

Additionally, business rule middleware exists but is not wired to routes.

## Solution

Register all admin routes under `/admin/*` prefix and wire the business rules middleware to enforce constraints at runtime.

## User Stories

1. As an admin user, I want to delete any recipe/ingredient from the database, so that I can manage content quality.
2. As an administrator, I want to promote/demote other users between roles, so that I can manage team access levels.
3. As a super-admin, I want to ban problematic users with configurable ban durations, so that I can enforce platform rules.
4. As an auditor, I want to view all audit log entries filtered by action/type/date range, so that I can investigate incidents.
5. As a developer, I want feature flags controlled via API endpoints, so that I can enable/disable features without redeployment.
6. As a system designer, I want admin operations to respect the "always have 1+ admin" business rule, so that no single point of failure exists.

## Implementation Decisions

### Route Structure
- Mount `/admin/*` routes under main Express app via `app.use()`
- Create separate route files for each domain: users.js, content.js, logs.js, features.js
- Each route file exports a standalone Express Router with its own sub-routes

### Middleware Wiring Order
Every request follows this chain:
1. `auth` middleware (JWT verification)
2. `banCheck` middleware (returns 403 if banned)
3. Either `superAdminCheck` or `regularAdminCheck` based on route requirement
4. Route handler

### Business Rules Enforcement
- Apply `ensureAdminsExist()` to all role demotion/delete operations before they execute
- Reject with 400 status and clear message if business rule would be violated
- Business rules check Roles collection, not User model denormalized fields

## Testing Decisions

- Test each route endpoint for proper HTTP method support
- Verify middleware chain rejects unauthorized requests correctly (403, 401)
- Test business rules with edge cases: only 1 admin exists, removing last super-admin
- Use Postman collection or equivalent for API testing
- Integration test full request/response lifecycle

## Out of Scope

- Admin UI/frontend implementation (Angular SPA mentioned in tickets)
- Audit log viewer filtering beyond basic query parameters
- Feature flag SDK integration with external services like Unleash
- Email service modifications (existing nodemailer to be used as-is)

## Further Notes

This ticket bridges the gap between design/documentation and working implementation. The route files exist but are not mounted. This makes all admin features inaccessible until fixed. Priority should be on:

1. Registering routes in server.js
2. Wiring business rule middleware to routes
3. Testing that each endpoint responds correctly with proper permissions

The audit log viewer, feature flags, and content moderation endpoints can follow if needed for MVP.
