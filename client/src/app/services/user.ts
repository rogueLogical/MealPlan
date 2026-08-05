import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Recipe } from '../models/recipe.model';

export interface MacroTargets {
  calories: number;
  protein: number;
  netCarbs: number;
  fat: number;
}

export interface NutritionSettings {
  dailyMacroTargets: MacroTargets;
  likedFoods?: string[];
  dislikedFoods?: string[];
  dietaryRestrictions?: string[];
  dailyMealsCount?: number;
  dailySnacksCount?: number;
  mealMacroSplitPercentage?: MacroTargets;
}

export interface BackendUserDocument {
  _id?: string;
  email?: string;
  username?: string;
  profilePicture?: string;
  settings?: {
    measurementSystem: 'metric' | 'imperial';
  };
  nutritionSettings?: NutritionSettings;
  hasConfiguredSettings?: boolean;
  dismissedWelcomeBanner?: boolean;
  isEmailVerified?: boolean;
  pendingEmail?: string;
  favoriteRecipes?: string[];
  recentlyViewedRecipes?: string[];
}

export interface UserSettingsPayload {
  measurementSystem: 'metric' | 'imperial';
  profilePicture?: string;
  nutritionSettings: NutritionSettings;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/users`;

  getUserProfile(): Observable<{ user: BackendUserDocument }> {
    return this.http.get<{ user: BackendUserDocument }>(`${this.apiUrl}/me`);
  }

  updateUserSettings(payload: UserSettingsPayload): Observable<unknown> {
    return this.http.put<unknown>(`${this.apiUrl}/settings`, payload);
  }

  deleteAccount(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/me`);
  }

  requestEmailChange(newEmail: string): Observable<{ message: string; pendingEmail: string }> {
    return this.http.post<{ message: string; pendingEmail: string }>(
      `${this.apiUrl}/request-email-change`,
      { newEmail },
    );
  }

  dismissWelcomeBanner(): Observable<{ message: string; user: BackendUserDocument }> {
    return this.http.post<{ message: string; user: BackendUserDocument }>(
      `${this.apiUrl}/dismiss-welcome`,
      {},
    );
  }

  recordRecentlyViewed(
    recipeId: string,
  ): Observable<{ success: boolean; recentlyViewed: string[] }> {
    return this.http.post<{ success: boolean; recentlyViewed: string[] }>(
      `${this.apiUrl}/recently-viewed/${recipeId}`,
      {},
    );
  }

  getRecentlyViewedRecipes(): Observable<{ data: Recipe[] }> {
    return this.http.get<{ data: Recipe[] }>(`${this.apiUrl}/recently-viewed`);
  }

  toggleFavoriteRecipe(recipeId: string): Observable<{
    success: boolean;
    isFavorite: boolean;
    favoriteRecipes: string[];
    message: string;
  }> {
    return this.http.post<{
      success: boolean;
      isFavorite: boolean;
      favoriteRecipes: string[];
      message: string;
    }>(`${this.apiUrl}/favorites/${recipeId}`, {});
  }
}
