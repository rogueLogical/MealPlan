**Title:** Implementation of Soft-Deletes for Recipe Data Retention

**Status:** Accepted and Implemented

**Context:** In a community recipe application, users rely on recipes created by others for their personal meal plans. A "Hard Delete" approach—where an author deleting their recipe completely wipes it from the database—results in a poor user experience, as other users unexpectedly lose access to recipes they have favorited or depend on.

**Decision:** Use a "Soft Delete" pattern (`isDeleted: boolean`) for all user-generated recipes. Standard public search queries will filter out `isDeleted: true`. The `GET /api/recipes/favorites` query will explicitly bypass the `isDeleted` check. The `POST /api/recipes/:id/fork` endpoint will permit copying of soft-deleted recipes only if the recipe ID exists in the requesting user's `favoriteRecipes` array.

**Consequences:**

- Users never lose access to their saved library, ensuring trust in the platform.
- Data integrity is maintained for historical meal plans.
- The database size will grow indefinitely since records are not permanently purged, which may require future data retention policies for abandoned accounts.
