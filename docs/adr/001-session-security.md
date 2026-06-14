**Title:** Use JSON Web Tokens (JWTs) for session management.

**Status:** Accepted and Implemented

**Context:** The application needs a secure solution for providing user authentication for protected routes, ideally without needing to store session information in the database.

**Decision:** Use JWTs stored in local browser storage by the client. Set them to have a 24 hour expiration window, and have the backend provide a new token with a refreshed 24 hour timeout when the user sends a request to the backend within 1 hour of their token expiring.

**Consequences:**

- Backend api routes which require user authentication are protected using the auth middleware in /server/middleware/auth.js
- The client seamlessly handles token expiration and updating refreshed tokens sent by the server with the authInterceptor in /client/src/app/interceptors/auth.ts
- Client routes which are only accessible by logged in users are protected using the authGuard stored in /client/src/app/guards/auth.ts
