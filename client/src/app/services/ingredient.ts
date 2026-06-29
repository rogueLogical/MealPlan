import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Ingredient,
  IngredientPayload,
  IngredientSearchResponse,
} from '../models/ingredient.model';

@Injectable({
  providedIn: 'root',
})
export class IngredientService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/ingredients`;

  // READ (All / Search)
  searchIngredients(
    query?: string,
    tags?: string[],
    page = 1,
    limit = 50,
  ): Observable<IngredientSearchResponse> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());

    if (query) params = params.set('q', query);
    if (tags && tags.length > 0) params = params.set('tags', tags.join(','));

    return this.http.get<IngredientSearchResponse>(this.apiUrl, { params });
  }

  // READ (Single)
  getIngredientById(id: string): Observable<Ingredient> {
    return this.http.get<Ingredient>(`${this.apiUrl}/${id}`);
  }

  // CREATE
  createIngredient(
    ingredient: IngredientPayload,
  ): Observable<{ message: string; ingredient: Ingredient }> {
    return this.http.post<{ message: string; ingredient: Ingredient }>(this.apiUrl, ingredient);
  }

  // UPDATE
  updateIngredient(
    id: string,
    ingredientData: Partial<Ingredient>,
  ): Observable<{ message: string; ingredient: Ingredient }> {
    return this.http.put<{ message: string; ingredient: Ingredient }>(
      `${this.apiUrl}/${id}`,
      ingredientData,
    );
  }

  // DELETE
  deleteIngredient(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
