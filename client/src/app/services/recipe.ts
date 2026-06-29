import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Recipe, RecipePayload, RecipeSearchResponse } from '../models/recipe.model';

// Replace this with your actual environment configuration path
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class RecipeService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/recipes`;

  /**
   * Search all public recipes.
   * Ignores soft-deleted and private recipes (handled by backend).
   */
  searchPublicRecipes(
    query?: string,
    tags?: string[],
    page = 1,
    limit = 50,
  ): Observable<RecipeSearchResponse> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());

    if (query) {
      params = params.set('q', query);
    }

    if (tags && tags.length > 0) {
      params = params.set('tags', tags.join(','));
    }

    return this.http.get<RecipeSearchResponse>(this.apiUrl, { params });
  }

  /**
   * Fetch all recipes created by the authenticated user.
   */
  getMyRecipes(): Observable<{ data: Recipe[] }> {
    return this.http.get<{ data: Recipe[] }>(`${this.apiUrl}/me`);
  }

  /**
   * Fetch all recipes favorited by the authenticated user.
   */
  getFavoriteRecipes(): Observable<{ data: Recipe[] }> {
    return this.http.get<{ data: Recipe[] }>(`${this.apiUrl}/favorites`);
  }

  /**
   * Fetch a single recipe by its ID.
   */
  getRecipeById(id: string): Observable<Recipe> {
    return this.http.get<Recipe>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create a brand new recipe.
   */
  createRecipe(payload: RecipePayload): Observable<{ message: string; recipe: Recipe }> {
    return this.http.post<{ message: string; recipe: Recipe }>(this.apiUrl, payload);
  }

  /**
   * Update an existing recipe (Restricted to owner).
   */
  updateRecipe(
    id: string,
    payload: RecipePayload,
  ): Observable<{ message: string; recipe: Recipe }> {
    return this.http.put<{ message: string; recipe: Recipe }>(`${this.apiUrl}/${id}`, payload);
  }

  /**
   * Soft-delete a recipe (Restricted to owner).
   */
  deleteRecipe(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  /**
   * Clone a public recipe into the user's private collection.
   */
  forkRecipe(recipeId: string): Observable<{ recipe: Recipe; message: string }> {
    return this.http.post<{ recipe: Recipe; message: string }>(
      `${this.apiUrl}/${recipeId}/fork`,
      {},
    );
  }
}
