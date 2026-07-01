import { NutritionMacros, Ingredient } from './ingredient.model';

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

// --- Balancer Feature Specific Interfaces ---

export interface MacroTargets {
  protein: number;
  fat: number;
  netCarbs: number;
}

export interface InterventionOption {
  ingredientName: string;
  reasonForRecommendation: string;
  macros: NutritionMacros;
}

export interface InterventionPayload {
  type: 'SWAP' | 'ADD' | 'REMOVE';
  targetIngredient: string | null;
  reasoning: string;
  options: InterventionOption[];
}

export interface BalanceRecipeRequest {
  ingredients: RecipeIngredient[];
  targets: MacroTargets;
  dietaryRestrictions: string[];
  interventionCount: number;
}

export interface BalanceRecipeResponse {
  status: 'success' | 'action_required' | 'approximate_success';
  ingredients?: RecipeIngredient[];
  intervention?: InterventionPayload;
}

export interface InterventionOption extends Ingredient {
  reasonForRecommendation: string;
}
