import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
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
  email?: string;
  profilePicture?: string;
  settings?: {
    measurementSystem: 'metric' | 'imperial';
  };
  nutritionSettings?: NutritionSettings;
}

export interface UserSettingsPayload {
  email?: string;
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

  // Fetch current user details and configurations
  getUserProfile(): Observable<{ user: BackendUserDocument }> {
    return this.http.get<{ user: UserSettingsPayload }>(`${this.apiUrl}/me`);
  }

  // Persist updated settings map to MongoDB
  updateUserSettings(payload: UserSettingsPayload): Observable<unknown> {
    return this.http.put<unknown>(`${this.apiUrl}/settings`, payload);
  }
}
