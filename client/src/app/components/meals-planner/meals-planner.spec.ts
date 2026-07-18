import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MealsPlanner } from './meals-planner';
import { MealPrepService, MealPrepPlan } from '../../services/meal-prep';
import { RecipeService } from '../../services/recipe';
import { ToastService } from '../../services/toast';
import { Recipe } from '../../models/recipe.model';
import { NutritionMacros } from '../../models/ingredient.model';

describe('MealsPlanner Component Selection, Scaling, and State Management', () => {
  let component: MealsPlanner;
  let fixture: ComponentFixture<MealsPlanner>;

  let mockPrepService: Partial<MealPrepService>;
  let mockRecipeService: Partial<RecipeService>;
  let mockToastService: Partial<ToastService>;

  const mockRecipes: Recipe[] = [
    {
      _id: 'rec123',
      title: 'Broccoli Pasta',
      portions: 2,
      ingredients: [
        {
          ingredientId: 'ing1',
          name: 'Broccoli',
          weightInGrams: 100,
          displayAmount: 1,
          displayUnit: 'cups',
          nutrition: {} as unknown as NutritionMacros,
        },
      ],
    } as unknown as Recipe,
    {
      _id: 'rec456',
      title: 'Lemon Chicken',
      portions: 1,
      ingredients: [],
    } as unknown as Recipe,
  ];

  const mockActivePlan: MealPrepPlan = {
    _id: 'plan_active_123',
    name: 'Week 29 Active Prep',
    isActive: true,
    recipes: [{ recipeId: mockRecipes[0], plannedPortions: 4, isCompleted: false }],
  };

  const mockInactivePlan: MealPrepPlan = {
    _id: 'plan_inactive_789',
    name: 'Week 28 Old Prep',
    isActive: false,
    recipes: [{ recipeId: 'rec123', plannedPortions: 2, isCompleted: true }],
  };

  beforeEach(async () => {
    mockPrepService = {
      getAllPlans: vi.fn().mockReturnValue(of({ plans: [mockActivePlan, mockInactivePlan] })),
      getActivePlan: vi.fn().mockReturnValue(of({ plan: mockActivePlan })),
      createPlan: vi.fn().mockReturnValue(of({ message: 'Saved', plan: mockActivePlan })),
      updatePlan: vi.fn().mockReturnValue(of({ message: 'Updated', plan: mockActivePlan })),
      completePlannedRecipe: vi
        .fn()
        .mockReturnValue(of({ message: 'Logged', plan: mockActivePlan })),
      appendPlanToShoppingList: vi.fn().mockReturnValue(of({ message: 'Appended' })),
      activatePlan: vi.fn().mockReturnValue(of({ message: 'Activated' })),
      deactivatePlan: vi.fn().mockReturnValue(of({ message: 'Deactivated' })),
      restartPlan: vi.fn().mockReturnValue(of({ message: 'Reset' })),
      deletePlan: vi.fn().mockReturnValue(of({ message: 'Deleted' })),
    };

    mockRecipeService = {
      getMyRecipes: vi.fn().mockReturnValue(of({ data: mockRecipes })),
    };

    mockToastService = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showInfo: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MealsPlanner, FormsModule],
      providers: [
        { provide: MealPrepService, useValue: mockPrepService },
        { provide: RecipeService, useValue: mockRecipeService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MealsPlanner);
    component = fixture.componentInstance;
  });

  // HTML Template Render coverage
  it('should render loading spinner when isLoading is true', () => {
    vi.spyOn(component, 'loadData').mockImplementation(() => {
      /* noop */
    });

    component.isLoading = true;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.loading-state')).toBeTruthy();
  });

  it('should render empty state when no active plan is found and not loading/creating', () => {
    vi.spyOn(component, 'loadData').mockImplementation(() => {
      /* noop */
    });

    component.isLoading = false;
    component.isCreating = false;
    component.activePlan = null;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state')).toBeTruthy();
  });

  // Selection Arrays Groupings and Getters
  it('should separate selected and unselected recipes into distinct arrays', () => {
    fixture.detectChanges();
    component.selectedRecipes = [
      { recipe: mockRecipes[0], plannedPortions: 4, isSelected: true },
      { recipe: mockRecipes[1], plannedPortions: 1, isSelected: false },
    ];

    const selected = component.selectedPlanRecipes;
    expect(selected).toHaveLength(1);
    expect(selected[0].recipe.title).toBe('Broccoli Pasta');

    const unselected = component.unselectedPlanRecipes;
    expect(unselected).toHaveLength(1);
    expect(unselected[0].recipe.title).toBe('Lemon Chicken');
  });

  // Safe Mongoose ID resolvers
  it('should resolve unpopulated and populated IDs safely using getRecipeId', () => {
    fixture.detectChanges();
    expect(component.getRecipeId('id_string')).toBe('id_string');

    const populatedRecipe = { _id: 'id_populated_123', title: 'Test' } as unknown as Recipe;
    expect(component.getRecipeId(populatedRecipe)).toBe('id_populated_123');
  });

  // Modal Creation Initiation
  it('should open plan creation overlay and initialize selection pool', () => {
    fixture.detectChanges();
    component.initiatePlanCreation();
    expect(component.isCreating).toBe(true);
    expect(component.editingPlanId).toBeNull();
    expect(component.selectedRecipes).toHaveLength(2);
    expect(component.selectedRecipes[0].isSelected).toBe(false);
  });

  // Modal Editing Initiation
  it('should open plan editing modal and restore previous selections', () => {
    fixture.detectChanges();
    component.initiatePlanEditing(mockActivePlan);
    expect(component.isCreating).toBe(true);
    expect(component.editingPlanId).toBe('plan_active_123');
    expect(component.selectedRecipes[0].isSelected).toBe(true);
    expect(component.selectedRecipes[0].plannedPortions).toBe(4);
  });

  it('should cancel plan creation and clear editing states', () => {
    fixture.detectChanges();
    component.isCreating = true;
    component.editingPlanId = 'plan123';
    component.cancelPlan();
    expect(component.isCreating).toBe(false);
    expect(component.editingPlanId).toBeNull();
  });

  // Save Plan validations and error branches
  it('should show error toast if attempting to save plan without selecting any recipes', () => {
    fixture.detectChanges();
    component.isCreating = true;
    component.selectedRecipes = [{ recipe: mockRecipes[0], plannedPortions: 4, isSelected: false }];
    component.savePlan();
    expect(mockToastService.showError).toHaveBeenCalledWith(
      expect.stringContaining('Select at least one'),
    );
  });

  it('should call updatePlan and refresh data when saving in Edit Mode', () => {
    fixture.detectChanges();
    component.isCreating = true;
    component.editingPlanId = 'plan_active_123';
    component.planName = 'Edited Week';
    component.selectedRecipes = [{ recipe: mockRecipes[0], plannedPortions: 4, isSelected: true }];

    component.savePlan();

    expect(mockPrepService.updatePlan).toHaveBeenCalled();
    expect(mockToastService.showSuccess).toHaveBeenCalledWith('Meal Prep Plan updated.');
    expect(component.isCreating).toBe(false);
  });

  // Shopping List Append Actions
  it('should call appendPlanToShoppingList on plan items and log success toast', () => {
    fixture.detectChanges();
    component.appendPlanIngredientsToList(mockActivePlan);
    expect(mockPrepService.appendPlanToShoppingList).toHaveBeenCalledWith('plan_active_123');
    expect(mockToastService.showSuccess).toHaveBeenCalled();
  });

  it('should handle append list errors gracefully', () => {
    fixture.detectChanges();
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
    mockPrepService.appendPlanToShoppingList = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('API Error')));
    component.appendPlanIngredientsToList(mockActivePlan);
    expect(mockToastService.showError).toHaveBeenCalled();
  });

  // Plan Activations
  it('should activate an inactive plan successfully', () => {
    fixture.detectChanges();
    component.activatePlan(mockInactivePlan);
    expect(mockPrepService.activatePlan).toHaveBeenCalledWith('plan_inactive_789');
    expect(mockToastService.showSuccess).toHaveBeenCalled();
  });

  it('should handle activation failures with error toast', () => {
    fixture.detectChanges();
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
    mockPrepService.activatePlan = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('API Error')));
    component.activatePlan(mockInactivePlan);
    expect(mockToastService.showError).toHaveBeenCalled();
  });

  // Deactivation Dialogs
  it('should manage deactivation modal state and execute deactivation', () => {
    fixture.detectChanges();
    component.openDeactivateDialog();
    expect(component.showDeactivateConfirmDialog).toBe(true);

    component.closeDeactivateDialog();
    expect(component.showDeactivateConfirmDialog).toBe(false);

    component.activePlan = mockActivePlan;
    component.confirmDeactivatePlan();
    expect(mockPrepService.deactivatePlan).toHaveBeenCalledWith('plan_active_123');
    expect(component.showDeactivateConfirmDialog).toBe(false);
  });

  // Active Progress Resets
  it('should manage progress reset modal state and execute reset', () => {
    fixture.detectChanges();
    component.openResetDialog();
    expect(component.showResetConfirmDialog).toBe(true);

    component.closeResetDialog();
    expect(component.showResetConfirmDialog).toBe(false);

    component.activePlan = mockActivePlan;
    component.confirmResetActivePlan();
    expect(mockPrepService.restartPlan).toHaveBeenCalledWith('plan_active_123');
    expect(component.showResetConfirmDialog).toBe(false);
  });

  // Deletions overlays
  it('should manage deletion modal state and execute delete', () => {
    fixture.detectChanges();
    component.openDeleteDialog(mockInactivePlan);
    expect(component.showDeleteConfirmDialog).toBe(true);
    expect(component.planIdToDelete).toBe('plan_inactive_789');

    component.closeDeleteDialog();
    expect(component.showDeleteConfirmDialog).toBe(false);

    component.planIdToDelete = 'plan_inactive_789';
    component.confirmDeletePlan();
    expect(mockPrepService.deletePlan).toHaveBeenCalledWith('plan_inactive_789');
    expect(component.showDeleteConfirmDialog).toBe(false);
  });

  // Scaling detail modal Close triggers
  it('should clear viewing planned recipe state on close', () => {
    fixture.detectChanges();
    component.viewingPlannedRecipe = { recipe: mockRecipes[0], multiplier: 2 };
    component.closePlannedRecipe();
    expect(component.viewingPlannedRecipe).toBeNull();
  });

  // Recipe completion dialog and customized submissions
  it('should manage recipe completion modal and submit with custom portion logging', () => {
    fixture.detectChanges();
    component.initiateRecipeCompletion('rec123', 'My Pasta', 4);
    expect(component.showCompletionDialog).toBe(true);
    expect(component.completionPortions).toBe(4);

    // Confirm completion with storage logging (skipStorage = false)
    component.activePlan = mockActivePlan;
    component.confirmRecipeCompletion(false);
    expect(mockPrepService.completePlannedRecipe).toHaveBeenCalledWith(
      'plan_active_123',
      'rec123',
      4,
    );
    expect(component.showCompletionDialog).toBe(false);

    // Cancel completion
    component.initiateRecipeCompletion('rec123', 'My Pasta', 4);
    component.closeCompletionDialog();
    expect(component.showCompletionDialog).toBe(false);
    expect(component.recipeIdToComplete).toBeNull();
  });

  it('should handle completion error branches', () => {
    fixture.detectChanges();
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
    mockPrepService.completePlannedRecipe = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('API Error')));
    component.activePlan = mockActivePlan;
    component.recipeIdToComplete = 'rec123';

    component.confirmRecipeCompletion(false);

    expect(mockToastService.showError).toHaveBeenCalled();
    expect(component.showCompletionDialog).toBe(false);
  });
});
