# MealPlan Server API Documentation

## Base URL

All API requests should be prefixed with `/api`.

- Local Development: `http://localhost:3000/api`
- Production: `https://mealplanserver-[id].azurewebsites.net/api`

---

## Authentication (`/auth`)

`POST /auth/register`

Creates a new user account.

- Auth Required: No
- Body:
  ```JSON
  {
    "username": "testuser",
    "email": "test@example.com",
    "password": "securePassword123!",
    "profilePicture": "https://example.com/avatar.png" // Optional
  }
  ```
- Success Response (201): Returns a success message and basic user object.

`POST /auth/login`

Authenticates a user and provisions a JWT session token.

- Auth Required: No
- Body:
  ```JSON
  {
    "username": "testuser",
    "password": "securePassword123!"
  }
  ```
- Success Response (200): Returns a JWT token and user profile object.

`POST /auth/forgot-password`

Generates a secure recovery token and dispatches an email with a reset link.

- Auth Required: No
- Body:
  ```JSON
  { "email": "test@example.com" }
  ```
- Success Response (200): Returns a generic dispatch confirmation message.

`POST /auth/reset-password`

Consumes a recovery token to overwrite an existing account password.

- Auth Required: No
- Body:
  ```JSON
  {
    "token": "crypto_hex_string_12345",
    "newPassword": "BrandNewSecurePassword789!"
  }
  ```
- Success Response (200): Returns a success message.

---

## Users (`/users`)

All `/users` endpoints require a valid Bearer JWT in the `Authorization` header.

`GET /users/me`

Retrieves the full profile and settings for the currently authenticated user.

- Success Response (200): Returns the complete user document (excluding the password hash). The response object includes the `nutritionSettings`, the user's calculated macro targets, and the `favoriteRecipes` array containing the ObjectIds of saved recipes.

`PUT /users/settings`

Updates the authenticated user's account preferences and nutritional targets.

- Body:
  ```JSON
  {
    "email": "updated@example.com",
    "measurementSystem": "metric",
    "profilePicture": "https://example.com/avatar.png",
    "nutritionSettings": {
      "dailyMacroTargets": { "calories": 2500, "protein": 180, "netCarbs": 150, "fat": 70 },
      "dailyMealsCount": 4,
      "dailySnacksCount": 1,
      "mealMacroSplitPercentage": { "calories": 80, "protein": 80, "netCarbs": 80, "fat": 80 },
      "likedFoods": ["Chicken", "Broccoli"],
      "dislikedFoods": ["Pork"],
      "dietaryRestrictions": ["Dairy-Free"]
    }
  }
  ```
- Success Response (200): Returns the updated settings blocks.

`POST /users/favorites/:recipeId`

Toggles a recipe's favorite status for the authenticated user. If the recipe is currently favorited, it will be removed. If it is not, it will be added.

- Success Response (200):
  ```JSON
  {
    "success": true,
    "isFavorite": true,
    "favoriteRecipes": ["60d5ec...", "60d5ed..."]
  }
  ```

`GET /users/storage`

Retrieves a list of all recipe portions currently prepared and in storage for the authenticated user.

- Success Response (200):
  ```JSON
  {
    "storage": [
      {
        "_id": "60d5ecb8b392d7... (auto-generated)",
        "recipeId": "60d5ecb8b392d7...",
        "recipeTitle": "Keto Avocado Bread",
        "portionsInStorage": 4,
        "createdAt": "2026-07-18T18:00:00.000Z",
        "updatedAt": "2026-07-18T18:30:00.000Z"
      }
    ]
  }
  ```

`POST /users/storage/adjust`

Increments or decrements the stored portion count for a specific recipe. Enforces a floor boundary limit of 0 (portion counts cannot fall below zero).

- Body:
  ```JSON
  {
    "recipeId": "60d5ecb8b392d7...",
    "recipeTitle": "Keto Avocado Bread",
    "delta": -1
  }
  ```
- Success Response (200): Returns the adjusted storage document.

---

## Ingredients (`/ingredients`)

All `/ingredients` endpoints require a valid Bearer JWT in the `Authorization` header.

`GET /ingredients`

Retrieves a paginated list of ingredients. Supports text search and tag filtering.

- Query Parameters:
  - `page` (number): Page number for pagination (Default: 1).
  - `limit` (number): Number of items per page (Default: 50).
  - `q` (string): Optional search query for the ingredient name.
  - `tags` (string): Optional comma-separated list of tags (e.g., `Keto,Dairy-Free`).

- Success Response (200):
  ```JSON
  {
    "data": [
      {
      "_id": "60d5ecb8b392d7... (auto-generated)",
      "name": "avocado, raw",
      "createdBy": "user_id_here (optional)",
      "servingSize": 150,
      "servingUnit": "g",
      "nutritionPerServing": {
        "protein": 3.0,
        "totalCarbs": 12.8,
        "fiber": 10.0,
        "sugarAlcohols": 0,
        "netCarbs": 2.8, // AUTO-CALCULATED
        "fat": 22.0,
        "calories": 240  // AUTO-CALCULATED
      },
      "nutrition": {     // AUTO-CALCULATED (100g Baseline)
        "protein": 2.0,
        "totalCarbs": 8.5,
        "fiber": 6.7,
        "sugarAlcohols": 0,
        "netCarbs": 1.9,
        "fat": 14.7,
        "calories": 160
      },
      "tags": ["Keto", "High-Fat", "High-Fiber", "Vegan", "Gluten-Free"] // AI + Math Auto-Tagged on save
      }
    ],
    "meta": {
      "totalItems": 150,
      "currentPage": 1,
      "itemsPerPage": 50,
      "totalPages": 3
    }
  }
  ```

`POST /ingredients`

Creates a new ingredient entry. Automatically assigns the authenticated user as the creator, calculates calorie metrics, and applies both math-based and Gemini AI semantic dietary tags before saving.

- Body: Ingredient payload matching the schema properties (excluding `_id` and calculated `netCarbs`).
- Success Response (201): Returns the newly created ingredient.

`GET /ingredients/:id`

Retrieves a single ingredient by its database ID.

- Success Response (200): Returns the ingredient object.

`PUT /ingredients/:id`

Updates an existing ingredient. Users can only update ingredients they created.

- Body: Partial or complete ingredient object.
- Success Response (200): Returns the updated ingredient.

`DELETE /ingredients/:id`

Permanently deletes an ingredient. Users can only delete ingredients they created.

- Success Response (200): Returns a deletion confirmation message.

---

## Recipes (`/recipes`)

All `/recipes` endpoints require a valid Bearer JWT in the `Authorization` header.

`GET /recipes`

Retrieves a paginated list of public, non-deleted recipes. Supports text search and tag filtering.

- Query Parameters: Same as `/ingredients`.
- Success Response (200): Returns a paginated array of recipe objects.

`GET /recipes/me`

Retrieves a list of recipes created by the currently authenticated user (excluding deleted ones).

- Success Response (200): Returns an array of recipes owned by the user.

`GET /recipes/favorites`

Retrieves a list of all recipes currently favorited by the authenticated user.
_Note: This endpoint explicitly bypasses the `isDeleted: false` database check. This architectural decision ensures users retain access to recipes they rely on and have saved, even if the original author deletes the public record._

- Success Response (200): Returns an array of recipe objects under the `data` key.

`POST /recipes`

Creates a new recipe. The `ingredients` array requires `weightInGrams` for backend macro calculations, while `displayAmount` and `displayUnit` are optional strings for frontend rendering.

- Body:
  ```JSON
  {
    "title": "Keto Avocado Toast",
    "description": "A low-carb morning staple.",
    "instructions": "Toast the bread. Mash the avocado. Combine.",
    "prepTimeMinutes": 5,
    "portions": 1,
    "tags": ["Keto", "Vegetarian", "High-Fat"],
    "ingredients": [
      {
        "ingredientId": "60d5ecb8b392d7...",
        "name": "Avocado, raw",
        "weightInGrams": 100,
        "displayAmount": 0.5,
        "displayUnit": "Medium",
        "nutrition": {
          "calories": 160,
          "protein": 2.0,
          "totalCarbs": 8.5,
          "fiber": 6.7,
          "sugarAlcohols": 0,
          "netCarbs": 1.8,
          "fat": 14.7
        }
      }
    ]
  }
  ```
- Success Response (201): Returns the created recipe with the `totalNutrition` automatically calculated by the backend.

`GET /recipes/:id`

Retrieves a single recipe by its database ID.

- Success Response (200): Returns the recipe document.

`PUT /recipes/:id`

Updates an existing recipe. Users can only update recipes they created.

- Body: Accepts the same `RecipePayload` object structure as the `POST /recipes` endpoint.
- Success Response (200): Returns the updated recipe object with newly calculated `totalNutrition`.

`POST /recipes/:id/fork`

Creates a personal copy of an existing public recipe, adding it to the authenticated user's library.
_Note: Users are permitted to fork a soft-deleted recipe ONLY if that recipe ID currently exists in their `favoriteRecipes` array. Otherwise, it will return a 404._

- Success Response (201): Returns the newly created copied recipe object.

`DELETE /recipes/:id`

Performs a "soft-delete" on a recipe. Sets the `isDeleted` flag to `true` rather than wiping the database record. This successfully hides the recipe from public search while preserving the underlying data for users who have already favorited it. Users can only delete recipes they created.

- Success Response (200): Returns a deletion confirmation message.

`POST /recipes/generate`

Generates a complete, structured recipe based on a natural language text description, classified by category (meal/snack), and optionally targeted to match the user's personal dietary restrictions and macro settings splits. Resolves ingredients through a sequential waterfall of local database checks, USDA lookups, and AI estimation fallbacks.

- Auth Required: Yes
- Body:
  ```JSON
  {
    "description": "Creamy garlic chicken with asparagus and brown rice",
    "recipeType": "Meal", // "Meal" | "Snack"
    "useMacroTargets": true,
    "dietaryRestrictions": ["Dairy-Free"]
  }
  ```
- Success Response (200): Returns a complete structured recipe payload, suitable to be patched directly into the client-side `recipe-builder`:
  ```JSON
  {
    "title": "Creamy Garlic Chicken with Asparagus",
    "recipeType": "Meal",
    "isPublic": false,
    "description": "A delicious garlic chicken dish paired with fresh asparagus.",
    "instructions": "1. Preheat the oven to 375°F.\n\n2. Sauté garlic and onions in olive oil.\n\n3. Bake chicken until temperature hits 165°F.",
    "prepTimeMinutes": 10,
    "cookTimeMinutes": 20,
    "portions": 4,
    "tags": ["Low-Carb", "Gluten-Free", "Dairy-Free"],
    "ingredients": [
      {
        "ingredientId": "60d5ecb8b392d7...", // ObjectID if matched locally or via USDA. Otherwise null.
        "name": "chicken breast",
        "weightInGrams": 450,
        "displayAmount": 1,
        "displayUnit": "lb",
        "nutrition": {
          "calories": 742,
          "protein": 140,
          "totalCarbs": 0,
          "fiber": 0,
          "sugarAlcohols": 0,
          "netCarbs": 0,
          "fat": 16
        }
      }
    ]
  }
  ```

`POST /recipes/balance`

Executes the mathematical Non-Negative Least Squares (NNLS) optimizer to scale active recipe ingredients so they align with a user's exact per-portion macronutrient targets.

- Auth Required: Yes
- Body:
  ```JSON
  {
    "ingredients": [
      {
        "ingredientId": "60d5ecb8b392d7...",
        "name": "chicken breast",
        "weightInGrams": 150,
        "nutrition": {
          "calories": 247,
          "protein": 46,
          "totalCarbs": 0,
          "fiber": 0,
          "sugarAlcohols": 0,
          "netCarbs": 0,
          "fat": 5
        }
      }
    ],
    "targets": {
      "protein": 50,
      "fat": 15,
      "netCarbs": 10
    },
    "dietaryRestrictions": ["Dairy-Free"],
    "interventionCount": 0
  }
  ```
- Success Response (200): Depending on mathematical feasibility, returns one of three states:
  - **State A: Success (strictly feasible)**
    ```JSON
    {
      "status": "success",
      "ingredients": [ /* scaled ingredients array */ ]
    }
    ```
  - **State B: Action Required (mathematically infeasible, requests swap/addition)**
    ```JSON
    {
      "status": "action_required",
      "ingredients": [ /* partially scaled ingredients */ ],
      "intervention": {
        "type": "ADD", // "ADD" | "SWAP" | "REMOVE"
        "targetIngredient": null,
        "reasoning": "Deficiency Conflict: Missing a source of netCarbs.",
        "options": [
          {
            "_id": "60d5ecb8b392d8...",
            "name": "Brown Rice",
            "servingSize": 100,
            "nutritionPerServing": { "calories": 111, "protein": 3, "totalCarbs": 23, "fiber": 2, "sugarAlcohols": 0, "netCarbs": 21, "fat": 1 },
            "reasonForRecommendation": "Excellent source of complex carbs."
          }
        ]
      }
    }
    ```
  - **State C: Approximate Success (circuit-breaker tripped at 4 attempts)**
    ```JSON
    {
      "status": "approximate_success",
      "ingredients": [ /* closest approximate scaled ingredients */ ]
    }
    ```

---

## Meal Prep Plans (`/meal-plans`)

All `/meal-plans` endpoints require a valid Bearer JWT in the `Authorization` header.

`GET /meal-plans`

Retrieves a list of all meal prep plans belonging to the authenticated user, sorted by recency (`updatedAt` descending), with recipe details populated.

- Success Response (200): Returns an array of plans.

`GET /meal-plans/active`

Retrieves the currently active meal prep plan (if any exists).

- Success Response (200): Returns the active plan document.

`POST /meal-plans`

Creates a new meal prep plan. If `isActive: true` is supplied, it deactivates all other active plans belonging to this user.

- Body:
  ```JSON
  {
    "name": "Week 30 Prep Cycle",
    "isActive": true,
    "recipes": [
      {
        "recipeId": "60d5ecb8b392d7...",
        "plannedPortions": 8
      }
    ]
  }
  ```
- Success Response (201): Returns the newly created plan.

`PUT /api/meal-plans/:id`

Updates an existing plan. If `isActive` is set to `true`, the system automatically deactivates all other active plans belonging to this user first.

- Body: Same structure as `POST /meal-plans`.
- Success Response (200): Returns the updated plan document.

`POST /api/meal-plans/:id/activate`

Activates a historical plan, resetting all planned recipes to un-completed (`isCompleted: false`) and deactivating any other active plan.

- Success Response (200): Returns the activated plan.

`POST /api/meal-plans/:id/deactivate`

Deactivates the targeted active plan (leaving the user with no currently active plan).

- Success Response (200): Returns the deactivated plan.

`POST /api/meal-plans/:id/restart`

Resets the progress on the targeted active plan, setting all completed checklist flags back to un-completed (`isCompleted: false`).

- Success Response (200): Returns the reset plan.

`DELETE /api/meal-plans/:id`

Permanently deletes an inactive plan from the user's profile.
_Note: Users are blocked from deleting their currently active plan. Active plans must be deactivated or replaced first (returns 400 on breach)._

- Success Response (200): Returns a deletion confirmation.

`POST /api/meal-plans/:id/complete-recipe`

Marks a planned recipe inside the active plan as completed. Automatically logs prepared batches into Portion Storage. If `portionsToAdd` is passed as `0`, the system marks the plan checklist completed but skips Portion Storage logging.

- Body:
  ```JSON
  {
    "recipeId": "60d5ecb8b392d7...",
    "portionsToAdd": 8 // Optional (Defaults to planned portions value)
  }
  ```
- Success Response (200): Returns the updated plan.

---

## Shopping List (`/shopping-list`)

All `/shopping-list` endpoints require a valid Bearer JWT in the `Authorization` header.

`GET /api/shopping-list`

Retrieves the authenticated user's current shopping list. Automatically instantiates an empty list if none exists.

- Success Response (200): Returns the shopping list object containing an array of items.

`PUT /api/shopping-list`

Updates/re-orders the entire shopping list. To prevent subdocument ID unlinking, this endpoint preserves the existing item `_id` values when supplied in the payload.

- Body:
  ```JSON
  {
    "planId": "60d5ecb8b392d9...",
    "items": [
      {
        "_id": "60d5ecb8b392d7... (Preserves existing ID)",
        "ingredientId": "60d5ecb8b392d8...",
        "name": "Avocado, raw",
        "quantity": 4,
        "unit": "pieces",
        "weightInGrams": 600,
        "isChecked": false,
        "orderIndex": 0
      }
    ]
  }
  ```
- Success Response (200): Returns the updated list.

`PATCH /api/shopping-list/item/:itemId`

Checks or unchecks an individual item inside the list array. This endpoint uses Mongoose subdocument casting and marking utilities to force database array persistence.

- Body:
  ```JSON
  {
    "isChecked": true
  }
  ```
- Success Response (200): Returns the updated list.

`POST /api/shopping-list/item`

Appends a manual, custom item to the bottom of the needed list.

- Body:
  ```JSON
  {
    "name": "Paper Towels",
    "quantity": 2,
    "unit": "rolls"
  }
  ```
- Success Response (201): Returns the updated list.

`POST /api/shopping-list/append-plan`

Consolidates and appends a plan's scaled recipe ingredients directly to the user's current shopping list.
_Note: If an ingredient matches an existing unchecked list item, their quantities and weights are added together. If it matches an existing checked item, the new plan's scaled quantity/weight replaces the old value, and the item is automatically unchecked (moving it back up to needed items). If there is no match, it is appended to the bottom._

- Body:
  ```JSON
  {
    "planId": "60d5ecb8b392d7..."
  }
  ```
- Success Response (200): Returns the updated shopping list.

`DELETE /api/shopping-list/item/:itemId`

Permanently removes an item from the shopping list array.

- Success Response (200): Returns the updated list.
