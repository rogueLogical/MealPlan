import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BalanceRecipeRequest, BalanceRecipeResponse } from '../models/recipe.model';

@Injectable({
  providedIn: 'root',
})
export class RecipeBalancer {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/recipes/balance`;

  balanceRecipe(payload: BalanceRecipeRequest): Observable<BalanceRecipeResponse> {
    return this.http.post<BalanceRecipeResponse>(this.apiUrl, payload);
  }
}
