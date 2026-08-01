import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Overview } from './overview';
import { UserService } from '../../services/user';
import { MealPrepService } from '../../services/meal-prep';
import { RecipeService } from '../../services/recipe';
import { AuthService, UserProfile } from '../../services/auth';
import { ToastService } from '../../services/toast';
import { Recipe } from '../../models/recipe.model';

describe('Overview Component Test Suite', () => {
  let component: Overview;
  let fixture: ComponentFixture<Overview>;

  let mockUserService: Partial<UserService>;
  let mockPrepService: Partial<MealPrepService>;
  let mockRecipeService: Partial<RecipeService>;
  let mockAuthService: Partial<AuthService>;
  let mockToastService: Partial<ToastService>;

  const currentUserSubject = new BehaviorSubject<UserProfile | null>({
    id: 'user_123',
    username: 'dashboarduser',
    email: 'user@test.com',
    profilePicture: '',
  });

  const mockFavoriteRecipes: Recipe[] = Array.from({ length: 7 }, (_, i) => ({
    _id: `fav_${i}`,
    title: `Favorite Recipe ${i}`,
    createdBy: 'user_123',
    isDeleted: false,
    isPublic: true,
    portions: 2,
    recipeType: 'Meal',
    updatedAt: new Date(2026, 0, i + 1).toISOString(),
    createdAt: new Date(2026, 0, i + 1).toISOString(),
    ingredients: [],
    totalNutrition: {
      calories: 200,
      protein: 20,
      fat: 5,
      totalCarbs: 20,
      fiber: 2,
      sugarAlcohols: 0,
      netCarbs: 18,
    },
  }));

  beforeEach(async () => {
    mockUserService = {
      getUserProfile: vi.fn().mockReturnValue(
        of({
          user: {
            hasConfiguredSettings: false,
            dismissedWelcomeBanner: false,
            nutritionSettings: {
              dailyMacroTargets: { calories: 2000, protein: 150, netCarbs: 200, fat: 70 },
            },
          },
        }),
      ),
      dismissWelcomeBanner: vi.fn().mockReturnValue(of({ message: 'Dismissed' })),
      getRecentlyViewedRecipes: vi.fn().mockReturnValue(of({ data: [] })),
      recordRecentlyViewed: vi.fn().mockReturnValue(of({ success: true })),
      toggleFavoriteRecipe: vi.fn().mockReturnValue(of({ isFavorite: true, favoriteRecipes: [] })),
    };

    mockPrepService = {
      getActivePlan: vi.fn().mockReturnValue(of({ plan: null })),
      getShoppingList: vi.fn().mockReturnValue(
        of({
          list: {
            _id: 'list_1',
            items: [{ _id: 'item1', name: 'Broccoli', quantity: 2, unit: 'pcs', isChecked: false }],
          },
        }),
      ),
      getPortionStorage: vi.fn().mockReturnValue(
        of({
          storage: [
            { recipeId: 'rec1', recipeTitle: 'Seared Chicken', portionsInStorage: 3 },
            { recipeId: 'rec2', recipeTitle: 'Beef Stew', portionsInStorage: 6 },
          ],
        }),
      ),
    };

    mockRecipeService = {
      getFavoriteRecipes: vi.fn().mockReturnValue(of({ data: mockFavoriteRecipes })),
      forkRecipe: vi.fn().mockReturnValue(of({ recipe: { title: 'Copied' } })),
      deleteRecipe: vi.fn().mockReturnValue(of({ message: 'Deleted' })),
      updateRecipe: vi.fn().mockReturnValue(of({ message: 'Updated' })),
      createRecipe: vi.fn().mockReturnValue(of({ message: 'Created' })),
    };

    mockAuthService = {
      currentUser$: currentUserSubject.asObservable(),
      updateCurrentUser: vi.fn(),
    };

    mockToastService = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Overview],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: MealPrepService, useValue: mockPrepService },
        { provide: RecipeService, useValue: mockRecipeService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ToastService, useValue: mockToastService },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Overview);
    component = fixture.componentInstance;
  });

  it('should create the Overview component and load dashboard data on init', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component.isLoading).toBe(false);
    expect(component.shoppingListUncheckedCount).toBe(1);
    expect(component.totalPortionsInStorage).toBe(9);
  });

  it('should correctly calculate low stock items (<= 3 portions)', () => {
    fixture.detectChanges();

    expect(component.lowStockPortions.length).toBe(1);
    expect(component.lowStockPortions[0].recipeTitle).toBe('Seared Chicken');
  });

  it('should limit displayed favorite recipes to max(4, cardsPerRow)', () => {
    component.cardsPerRow = 1; // 1 cards fit in 1 row
    fixture.detectChanges();

    // max(4, 1*2) = 4
    expect(component.maxRecipesToDisplay).toBe(4);
    expect(component.displayedFavoriteRecipes.length).toBe(4);

    // If 6 cards fit in 1 row
    component.cardsPerRow = 6;
    // max(4, 6*2) = 12
    expect(component.maxRecipesToDisplay).toBe(12);
    // but only 7 recipes in list to display
    expect(component.displayedFavoriteRecipes.length).toBe(7);
  });

  it('should open recipe builder when editing a recipe', () => {
    fixture.detectChanges();

    const recipeToEdit = mockFavoriteRecipes[0];
    component.onEditRecipe(recipeToEdit);

    expect(component.showRecipeBuilder).toBe(true);
    expect(component.editingRecipeId).toBe(recipeToEdit._id);
  });

  it('should open and confirm deletion of a recipe', () => {
    fixture.detectChanges();

    const recipeToDelete = mockFavoriteRecipes[0];
    component.onDeleteRecipe(recipeToDelete);

    expect(component.recipeToDelete).toBe(recipeToDelete);

    component.confirmDelete();

    expect(mockRecipeService.deleteRecipe).toHaveBeenCalledWith(recipeToDelete._id);
    expect(mockToastService.showSuccess).toHaveBeenCalledWith(`Deleted "${recipeToDelete.title}".`);
    expect(component.recipeToDelete).toBeUndefined();
  });
});
