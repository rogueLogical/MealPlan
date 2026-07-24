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
import { NutritionMacros } from '../../models/ingredient.model';

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
  });

  it('should initialize and deeply clone the ingredients to prevent mutating the parent builder', () => {
    fixture.detectChanges();
    expect(component.currentState).toBe('CONFIG');
    expect(component.currentIngredients.length).toBe(1);

    // Ensure it's a clone, not a direct reference
    expect(component.currentIngredients).not.toBe(component.originalRecipe.ingredients);

    // Verify it picked up the 'Keto' tag from the original recipe input
    expect(component.selectedDietaryRestrictions).toContain('Keto');
  });

  it('should toggle dietary restrictions correctly', () => {
    fixture.detectChanges();
    // Currently contains 'Keto'
    component.toggleRestriction('Dairy-Free');
    expect(component.selectedDietaryRestrictions).toContain('Dairy-Free');
    expect(component.selectedDietaryRestrictions).toContain('Keto');

    component.toggleRestriction('Keto'); // Uncheck Keto
    expect(component.selectedDietaryRestrictions).not.toContain('Keto');
  });

  it('should transition to REVIEW state when the solver successfully balances the recipe', () => {
    fixture.detectChanges();
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
    fixture.detectChanges();
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
    fixture.detectChanges();
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
    fixture.detectChanges();
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
    fixture.detectChanges();
    const saveSpy = vi.spyOn(component.updateRecipe, 'emit');
    const cancelSpy = vi.spyOn(component.cancelBalancer, 'emit');

    component.onSave();
    expect(saveSpy).toHaveBeenCalledWith(component.currentIngredients);

    component.onCancel();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('should handle API errors gracefully by catching the error and returning to the CONFIG state', () => {
    fixture.detectChanges();
    mockBalancerService.balanceRecipe.mockReturnValue(throwError(() => new Error('API Down')));

    component.executeBalancer();

    expect(mockToastService.showError).toHaveBeenCalled();
    expect(component.currentState).toBe('CONFIG'); // Should bounce back to config so user can try again
  });

  it('should calculate accurate getMacroClass highlights based on targets', () => {
    fixture.detectChanges();
    component.mealTargets = { protein: 50, fat: 20, netCarbs: 10 };

    // 1. Within 10% bounds (Target Protein = 50, tolerance = 5.1 -> range [44.9, 55.1])
    vi.spyOn(component, 'currentMacrosPerPortion', 'get').mockReturnValue({
      protein: 51,
      fat: 20,
      netCarbs: 10,
      calories: 420,
    });
    expect(component.getMacroClass('protein')).toBe('macro-within');

    // 2. Over bounds (actual = 60, target = 50)
    vi.spyOn(component, 'currentMacrosPerPortion', 'get').mockReturnValue({
      protein: 60,
      fat: 20,
      netCarbs: 10,
      calories: 420,
    });
    expect(component.getMacroClass('protein')).toBe('macro-over');

    // 3. Under bounds (actual = 40, target = 50)
    vi.spyOn(component, 'currentMacrosPerPortion', 'get').mockReturnValue({
      protein: 40,
      fat: 20,
      netCarbs: 10,
      calories: 420,
    });
    expect(component.getMacroClass('protein')).toBe('macro-under');
  });

  it('should render CONFIG state correctly in the HTML template', () => {
    component.currentState = 'CONFIG';
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.config-state')).toBeTruthy();
    expect(compiled.textContent).toContain('Review your current recipe');
  });

  it('should render LOADING state correctly in the HTML template', () => {
    component.currentState = 'LOADING';
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.loading-state')).toBeTruthy();
    expect(compiled.textContent).toContain('Crunching the numbers');
  });

  it('should render INTERVENTION state (SWAP) and display the dynamic prompt header', () => {
    component.currentState = 'INTERVENTION';
    component.currentIntervention = {
      type: 'SWAP',
      targetIngredient: 'Chicken Breast',
      reasoning: 'Too much protein',
      options: [
        {
          name: 'Turkey Breast',
          nutritionPerServing: { protein: 30, fat: 1, netCarbs: 0 },
        } as unknown as InterventionOption,
      ],
    };
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.intervention-state')).toBeTruthy();
    expect(compiled.textContent).toContain('Select an ingredient to swap');
    expect(compiled.textContent).toContain('Chicken Breast');
  });

  it('should render INTERVENTION state (ADD) and display the dynamic prompt header', () => {
    component.currentState = 'INTERVENTION';
    component.currentIntervention = {
      type: 'ADD',
      targetIngredient: null,
      reasoning: 'Lacking carbs',
      options: [],
    };
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Select an ingredient to add');
  });

  it('should render REVIEW state with approximate success warning banner', () => {
    component.currentState = 'REVIEW';
    component.isApproximateResult = true;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.review-state')).toBeTruthy();
    expect(compiled.querySelector('.warning-banner')).toBeTruthy();
    expect(compiled.textContent).toContain('Approximate Match');
  });

  it('should calculate precise getWeightChange deltas and return correct class alignments', () => {
    fixture.detectChanges();
    component.mealTargets = { protein: 50, fat: 20, netCarbs: 10 };

    // Positive change: New per-portion weight = 160g, Original = 150g. Delta = +10.
    const positiveChangeIngredient = {
      ingredientId: '1',
      name: 'Chicken Breast',
      weightInGrams: 160,
      nutrition: {} as unknown as NutritionMacros,
    };
    const posDiff = component.getWeightChange(positiveChangeIngredient);
    expect(posDiff).not.toBeNull();
    expect(posDiff?.diff).toBe(10);
    expect(posDiff?.formatted).toBe('(+10g)');
    expect(posDiff?.class).toBe('weight-increase');

    // Negative change: New per-portion weight = 120g, Original = 150g. Delta = -30.
    const negativeChangeIngredient = {
      ingredientId: '1',
      name: 'Chicken Breast',
      weightInGrams: 120,
      nutrition: {} as unknown as NutritionMacros,
    };
    const negDiff = component.getWeightChange(negativeChangeIngredient);
    expect(negDiff).not.toBeNull();
    expect(negDiff?.diff).toBe(-30);
    expect(negDiff?.formatted).toBe('(-30g)');
    expect(negDiff?.class).toBe('weight-decrease');

    // No change: New per-portion weight = 150g, Original = 150g. Delta = 0.
    const noChangeIngredient = {
      ingredientId: '1',
      name: 'Chicken Breast',
      weightInGrams: 150,
      nutrition: {} as unknown as NutritionMacros,
    };
    const zeroDiff = component.getWeightChange(noChangeIngredient);
    expect(zeroDiff).toBeNull();
  });
});
