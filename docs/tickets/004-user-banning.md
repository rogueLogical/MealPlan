# Admin Panel - User Account Banning

## Question

Design and implement user account banning API for admin panel. Support both temporary bans (with expiry timestamp that auto-reinstates account) and permanent bans (no expiry). Preserve all user data during and after ban. Send email notification to banned user explaining the action. Use existing nodemailer service. Implement middleware hook in authentication layer that validates `isBanned` and `banExpiresAt` fields on every request (returns 403 Forbidden if banned past expiry or permanently). Send admin alert if email dispatch fails (admin@mealplan.local recipient).

### Context

Admin panel feature in scope. Part of the MealPlan administration system. User data remains during/after ban per Q6. Need to add `isBanned` and `banExpiresAt` fields to User model or separate collection. Middleware must check ban status before processing any requests.

### Labels

wayfinder:task

---

**Status**: Open

This ticket is part of the admin panel implementation map. See [Map](../../wayfinder-map.md).
