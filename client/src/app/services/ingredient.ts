import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Macros {
  calories: number;
  protein: number;
  totalCarbs: number;
  fiber: number;
  sugarAlcohols: number;
  netCarbs?: number;
  fat: number;
}

export interface Ingredient {
  _id?: string;
  name: string;
  createdBy?: string | null;
  standardAmount: number;
  standardUnit: string;
  nutrition: Macros;
  tags?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    totalPages: number;
  };
}

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
  ): Observable<PaginatedResponse<Ingredient>> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());

    if (query) params = params.set('q', query);
    if (tags && tags.length > 0) params = params.set('tags', tags.join(','));

    return this.http.get<PaginatedResponse<Ingredient>>(this.apiUrl, { params });
  }

  // READ (Single)
  getIngredientById(id: string): Observable<Ingredient> {
    return this.http.get<Ingredient>(`${this.apiUrl}/${id}`);
  }

  // CREATE
  createIngredient(
    ingredient: Ingredient,
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
