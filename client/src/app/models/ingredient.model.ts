export interface NutritionMacros {
  calories: number;
  protein: number;
  totalCarbs: number;
  fiber: number;
  sugarAlcohols: number;
  netCarbs: number;
  fat: number;
}

export interface IngredientPayload {
  name: string;
  createdBy?: string | null;
  servingSize: number;
  servingUnit?: string | null;
  tags?: string[];
  nutritionPerServing: NutritionMacros;
  standardAmount?: number;
  standardUnit?: string;
  nutrition?: NutritionMacros;
}

export interface Ingredient extends IngredientPayload {
  _id: string;
}

export interface IngredientSearchResponse {
  data: Ingredient[];
  meta: {
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    totalPages: number;
  };
}
