# MealPlan Server API Documentation

## Base URL

All API requests should be prefixed with `/api`.

- Local Development: `http://localhost:3000/api`
- Production: `https://mealplanserver-[id].azurewebsites.net/api`

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
    "profilePicture": "[https://example.com/avatar.png](https://example.com/avatar.png)" // Optional
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

## Users (`/users`)

All `/users` endpoints require a valid Bearer JWT in the `Authorization` header.

`GET /users/me` (or `/users/profile`)

Retrieves the full profile and settings for the currently authenticated user.

- Success Response (200): Returns the complete user document (excluding the password hash). The response object includes the `nutritionSettings`, the user's calculated macro targets, and the `favoriteRecipes` array containing the ObjectIds of saved recipes.

`PUT /users/settings`

Updates the authenticated user's account preferences and nutritional targets.

- Body:
  ```JSON
  {
    "email": "updated@example.com",
    "measurementSystem": "metric",
    "profilePicture": "[https://example.com/avatar.png](https://example.com/avatar.png)",
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
      "tags": ["Keto", "High-Fat", "High-Fiber", "Vegan"]
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

Creates a new ingredient entry. Automatically assigns the authenticated user as the creator.

- Body: Ingredient object (matches the GET data structure above, excluding `_id` and `netCarbs`).
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

## Recipes (`/recipes`)

All `/recipes` endpoints require a valid Bearer JWT in the `Authorization` header.

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
      },
      {
        "ingredientId": "60d5ecb8b392d8...",
        "name": "Keto Bread",
        "weightInGrams": 50,
        "displayAmount": 2,
        "displayUnit": "Slices",
        "nutrition": {
          "calories": 120,
          "protein": 10.0,
          "totalCarbs": 14.0,
          "fiber": 12.0,
          "sugarAlcohols": 0,
          "netCarbs": 2.0,
          "fat": 6.0
        }
      }
    ]
  }
  ```
- Success Response (201): Returns the created recipe with the `totalNutrition` automatically calculated by the backend.

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
