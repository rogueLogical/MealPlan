import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { of, throwError } from 'rxjs';

import { RecipeMacronutrientBalancer } from './recipe-macronutrient-balancer';
import { RecipeBalancer } from '../../services/recipe-balancer';
import { ToastService } from '../../services/toast';
import {
  RecipePayload,
  RecipeIngredient,
  BalanceRecipeResponse,
  InterventionOption,
} from '../../models/recipe.model';

interface MockRecipeBalancer {
  balanceRecipe: Mock;
}

describe('RecipeMacronutrientBalancer Component State Machine', () => {
  let component: RecipeMacronutrientBalancer;
  let fixture: ComponentFixture<RecipeMacronutrientBalancer>;
  let mockBalancerService: MockRecipeBalancer;
  let mockToastService: { showError: Mock; showSuccess: Mock };

  const mockInitialIngredients: RecipeIngredient[] = [
    {
      ingredientId: '1',
      name: 'Chicken Breast',
      weightInGrams: 150,
      nutrition: {
        calories: 247,
        protein: 46,
        totalCarbs: 0,
        netCarbs: 0,
        fat: 5,
        fiber: 0,
        sugarAlcohols: 0,
      },
      baselineNutrition: {
        calories: 165,
        protein: 31,
        totalCarbs: 0,
        netCarbs: 0,
        fat: 3.6,
        fiber: 0,
        sugarAlcohols: 0,
      },
    },
  ];

  beforeEach(async () => {
    mockBalancerService = {
      balanceRecipe: vi.fn(),
    };

    mockToastService = {
      showError: vi.fn(),
      showSuccess: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RecipeMacronutrientBalancer],
      providers: [
        { provide: RecipeBalancer, useValue: mockBalancerService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeMacronutrientBalancer);
    component = fixture.componentInstance;

    // Supply required @Input() properties before ngOnInit
    component.originalRecipe = {
      title: 'Test Recipe',
      recipeType: 'Meal',
      isPublic: false,
      portions: 1,
      tags: ['Keto'], // Simulate an existing restriction
      ingredients: mockInitialIngredients,
    } as RecipePayload;

    component.mealTargets = { protein: 50, fat: 20, netCarbs: 10 };

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should initialize and deeply clone the ingredients to prevent mutating the parent builder', () => {
    expect(component.currentState).toBe('CONFIG');
    expect(component.currentIngredients.length).toBe(1);

    // Ensure it's a clone, not a direct reference
    expect(component.currentIngredients).not.toBe(component.originalRecipe.ingredients);

    // Verify it picked up the 'Keto' tag from the original recipe input
    expect(component.selectedDietaryRestrictions).toContain('Keto');
  });

  it('should toggle dietary restrictions correctly', () => {
    // Currently contains 'Keto'
    component.toggleRestriction('Dairy-Free');
    expect(component.selectedDietaryRestrictions).toContain('Dairy-Free');
    expect(component.selectedDietaryRestrictions).toContain('Keto');

    component.toggleRestriction('Keto'); // Uncheck Keto
    expect(component.selectedDietaryRestrictions).not.toContain('Keto');
  });

  it('should transition to REVIEW state when the solver successfully balances the recipe', () => {
    const successResponse: BalanceRecipeResponse = {
      status: 'success',
      ingredients: [
        { ...mockInitialIngredients[0], weightInGrams: 160 }, // The solver tweaked the weight
      ],
    };
    mockBalancerService.balanceRecipe.mockReturnValue(of(successResponse));

    component.executeBalancer();

    expect(mockBalancerService.balanceRecipe).toHaveBeenCalled();
    expect(component.currentState).toBe('REVIEW');
    expect(component.isApproximateResult).toBe(false);
    expect(component.currentIngredients[0].weightInGrams).toBe(160); // Verify the new weights applied
  });

  it('should transition to INTERVENTION state when the solver hits a mathematical conflict', () => {
    const interventionResponse: BalanceRecipeResponse = {
      status: 'action_required',
      intervention: {
        type: 'SWAP',
        targetIngredient: 'Chicken Breast',
        reasoning: 'Too much protein for targets.',
        options: [],
      },
    };
    mockBalancerService.balanceRecipe.mockReturnValue(of(interventionResponse));

    component.executeBalancer();

    expect(component.currentState).toBe('INTERVENTION');
    expect(component.currentIntervention?.type).toBe('SWAP');
  });

  it('should replace the target ingredient and recursively re-run the solver when a SWAP is selected', () => {
    // Setup an active SWAP intervention state
    component.currentIntervention = {
      type: 'SWAP',
      targetIngredient: 'Chicken Breast',
      reasoning: 'Test',
      options: [],
    };

    const mockOption: InterventionOption = {
      _id: 'mock_turkey_id', // Mocking the real DB ID
      name: 'Turkey Breast',
      servingSize: 100,
      reasonForRecommendation: 'Similar but leaner.',
      nutritionPerServing: {
        calories: 150,
        protein: 30,
        totalCarbs: 0,
        netCarbs: 0,
        fat: 1,
        fiber: 0,
        sugarAlcohols: 0,
      },
    } as InterventionOption;

    // Provide a dummy response for the subsequent recursive API call
    mockBalancerService.balanceRecipe.mockImplementation((payload: BalanceRecipeResponse) =>
      of({ status: 'success', ingredients: payload.ingredients }),
    );
    const executeSpy = vi.spyOn(component, 'executeBalancer');

    component.selectInterventionOption(mockOption);

    // Verify it replaced the existing ingredient
    expect(component.currentIngredients.length).toBe(1);
    expect(component.currentIngredients[0].name).toBe('Turkey Breast');
    expect(component.currentIngredients[0].ingredientId).toBe('mock_turkey_id');

    // Verify it incremented the circuit breaker and fired the recursive API call
    expect(component.interventionCount).toBe(1);
    expect(executeSpy).toHaveBeenCalled();
  });

  it('should push a new ingredient and recursively re-run the solver when an ADD is selected', () => {
    // Setup an active ADD intervention state
    component.currentIntervention = {
      type: 'ADD',
      targetIngredient: null,
      reasoning: 'Missing fat.',
      options: [],
    };

    const mockOption: InterventionOption = {
      _id: 'mock_oil_id', // Mocking the real DB ID
      name: 'Olive Oil',
      servingSize: 100,
      reasonForRecommendation: 'Adds healthy fats.',
      nutritionPerServing: {
        calories: 120,
        protein: 0,
        totalCarbs: 0,
        netCarbs: 0,
        fat: 14,
        fiber: 0,
        sugarAlcohols: 0,
      },
    } as InterventionOption;

    mockBalancerService.balanceRecipe.mockImplementation((payload: BalanceRecipeResponse) =>
      of({ status: 'success', ingredients: payload.ingredients }),
    );
    component.selectInterventionOption(mockOption);

    // Verify it appended the new ingredient alongside the Chicken Breast
    expect(component.currentIngredients.length).toBe(2);
    expect(component.currentIngredients[1].name).toBe('Olive Oil');
    expect(component.currentIngredients[1].ingredientId).toBe('mock_oil_id');
    expect(component.currentIngredients[1].weightInGrams).toBe(100); // Verify default 100g starting point

    // Verify circuit breaker increment
    expect(component.interventionCount).toBe(1);
  });

  it('should emit the finalized ingredient array when saved, and emit cancel when cancelled', () => {
    const saveSpy = vi.spyOn(component.updateRecipe, 'emit');
    const cancelSpy = vi.spyOn(component.cancelBalancer, 'emit');

    component.onSave();
    expect(saveSpy).toHaveBeenCalledWith(component.currentIngredients);

    component.onCancel();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('should handle API errors gracefully by catching the error and returning to the CONFIG state', () => {
    mockBalancerService.balanceRecipe.mockReturnValue(throwError(() => new Error('API Down')));

    component.executeBalancer();

    expect(mockToastService.showError).toHaveBeenCalled();
    expect(component.currentState).toBe('CONFIG'); // Should bounce back to config so user can try again
  });
});
