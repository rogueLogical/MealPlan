// src/app/services/meal-prep.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Recipe } from '../models/recipe.model';

export interface PortionStorageItem {
  _id?: string;
  recipeId: string;
  recipeTitle: string;
  portionsInStorage: number;
}

export interface PlannedRecipe {
  recipeId: string | Recipe;
  plannedPortions: number;
  isCompleted: boolean;
}

export interface MealPrepPlan {
  _id?: string;
  name: string;
  isActive: boolean;
  recipes: PlannedRecipe[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ShoppingListItem {
  _id?: string;
  ingredientId?: string | null;
  name: string;
  quantity: number;
  unit: string;
  weightInGrams?: number | null;
  isChecked: boolean;
  orderIndex?: number;
}

export interface ShoppingList {
  _id?: string;
  planId?: string | null;
  items: ShoppingListItem[];
}

@Injectable({
  providedIn: 'root',
})
export class MealPrepService {
  private http = inject(HttpClient);
  private userApiUrl = `${environment.apiUrl}/users`;
  private planApiUrl = `${environment.apiUrl}/meal-plans`;
  private listApiUrl = `${environment.apiUrl}/shopping-list`;

  // --- Portion Storage Methods ---
  getPortionStorage(): Observable<{ storage: PortionStorageItem[] }> {
    return this.http.get<{ storage: PortionStorageItem[] }>(`${this.userApiUrl}/storage`);
  }

  adjustPortionStorage(
    recipeId: string,
    recipeTitle: string,
    delta: number,
  ): Observable<{ message: string; storageItem: PortionStorageItem }> {
    return this.http.post<{ message: string; storageItem: PortionStorageItem }>(
      `${this.userApiUrl}/storage/adjust`,
      { recipeId, recipeTitle, delta },
    );
  }

  // --- Meal Prep Plan Methods ---
  getAllPlans(): Observable<{ plans: MealPrepPlan[] }> {
    return this.http.get<{ plans: MealPrepPlan[] }>(this.planApiUrl);
  }

  getActivePlan(): Observable<{ plan: MealPrepPlan | null }> {
    return this.http.get<{ plan: MealPrepPlan | null }>(`${this.planApiUrl}/active`);
  }

  createPlan(
    name: string,
    recipes: { recipeId: string; plannedPortions: number }[],
    isActive?: boolean,
  ): Observable<{ message: string; plan: MealPrepPlan }> {
    return this.http.post<{ message: string; plan: MealPrepPlan }>(this.planApiUrl, {
      name,
      recipes,
      isActive,
    });
  }

  updatePlan(
    planId: string,
    name: string,
    recipes: PlannedRecipe[],
    isActive?: boolean,
  ): Observable<{ message: string; plan: MealPrepPlan }> {
    return this.http.put<{ message: string; plan: MealPrepPlan }>(`${this.planApiUrl}/${planId}`, {
      name,
      recipes,
      isActive,
    });
  }

  activatePlan(planId: string): Observable<{ message: string; plan: MealPrepPlan }> {
    return this.http.post<{ message: string; plan: MealPrepPlan }>(
      `${this.planApiUrl}/${planId}/activate`,
      {},
    );
  }

  deactivatePlan(planId: string): Observable<{ message: string; plan: MealPrepPlan }> {
    return this.http.post<{ message: string; plan: MealPrepPlan }>(
      `${this.planApiUrl}/${planId}/deactivate`,
      {},
    );
  }

  restartPlan(planId: string): Observable<{ message: string; plan: MealPrepPlan }> {
    return this.http.post<{ message: string; plan: MealPrepPlan }>(
      `${this.planApiUrl}/${planId}/restart`,
      {},
    );
  }

  deletePlan(planId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.planApiUrl}/${planId}`);
  }

  completePlannedRecipe(
    planId: string,
    recipeId: string,
    portionsToAdd?: number,
  ): Observable<{ message: string; plan: MealPrepPlan }> {
    return this.http.post<{ message: string; plan: MealPrepPlan }>(
      `${this.planApiUrl}/${planId}/complete-recipe`,
      { recipeId, portionsToAdd },
    );
  }

  // --- Shopping List Methods ---
  getShoppingList(): Observable<{ list: ShoppingList }> {
    return this.http.get<{ list: ShoppingList }>(this.listApiUrl);
  }

  updateShoppingList(
    items: ShoppingListItem[],
    planId?: string | null,
  ): Observable<{ message: string; list: ShoppingList }> {
    return this.http.put<{ message: string; list: ShoppingList }>(this.listApiUrl, {
      items,
      planId,
    });
  }

  appendPlanToShoppingList(planId: string): Observable<{ message: string; list: ShoppingList }> {
    return this.http.post<{ message: string; list: ShoppingList }>(
      `${this.listApiUrl}/append-plan`,
      { planId },
    );
  }

  toggleShoppingItem(
    itemId: string,
    isChecked: boolean,
  ): Observable<{ message: string; list: ShoppingList }> {
    return this.http.patch<{ message: string; list: ShoppingList }>(
      `${this.listApiUrl}/item/${itemId}`,
      { isChecked },
    );
  }

  addManualItem(
    name: string,
    quantity: number,
    unit: string,
  ): Observable<{ message: string; list: ShoppingList }> {
    return this.http.post<{ message: string; list: ShoppingList }>(`${this.listApiUrl}/item`, {
      name,
      quantity,
      unit,
    });
  }

  removeShoppingItem(itemId: string): Observable<{ message: string; list: ShoppingList }> {
    return this.http.delete<{ message: string; list: ShoppingList }>(
      `${this.listApiUrl}/item/${itemId}`,
    );
  }
}
