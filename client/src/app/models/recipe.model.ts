import { NutritionMacros } from './ingredient.model';

export interface RecipeIngredient {
  ingredientId: string;
  name: string;
  weightInGrams: number;
  displayAmount?: number | null;
  displayUnit?: string;
  nutrition: NutritionMacros;
  baselineNutrition?: NutritionMacros;
}

export interface RecipePayload {
  title: string;
  recipeType: 'Meal' | 'Snack';
  isPublic: boolean;
  description?: string;
  instructions?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  portions: number;
  tags?: string[];
  ingredients: RecipeIngredient[];
}

export interface Recipe extends RecipePayload {
  _id: string;
  createdBy: string;
  isPublic: boolean;
  isDeleted: boolean;
  totalNutrition: NutritionMacros;
  nutritionPerPortion?: NutritionMacros;
  originalRecipeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeSearchResponse {
  data: Recipe[];
  meta: {
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    totalPages: number;
  };
}

export interface UserMacroTargets {
  meal: NutritionMacros;
  snack: NutritionMacros;
}
