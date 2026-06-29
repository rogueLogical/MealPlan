**Title:** Centralized Reactive Auth State for Component Initialization

**Status:** Accepted and Implemented

**Context:** Smart components (like `RecipesLibrary`) require user-specific data (macros, favorites, custom recipes) on load. Initially, components executed multiple parallel API fetches in `ngOnInit`. This resulted in race conditions, redundant API calls, and an infinite error loop upon logout, as the component attempted to fetch data without a valid session token.

**Decision:** All component-level data fetching and initialization logic must be nested within a single RxJS subscription to the global `AuthService.currentUser$` stream. The component must explicitly check for the existence of the user object before executing any API calls, and unconditional API fetches in `ngOnInit` are strictly prohibited.

**Consequences:**

- Complete elimination of "logout loop" crashes and 401 Unauthorized errors on session termination.
- Drastic reduction in redundant database calls (e.g., retrieving the user profile multiple times on load).
- Tighter coupling of component lifecycle to the RxJS observable streams.
