import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecipeBuilder } from './recipe-builder';
import { IngredientService } from '../../services/ingredient';
import { ToastService } from '../../services/toast';
import { Ingredient, NutritionMacros } from '../../models/ingredient.model';

describe('RecipeBuilder Component Math & Form Logic', () => {
  let component: RecipeBuilder;
  let fixture: ComponentFixture<RecipeBuilder>;

  // Dummy ingredient for testing reactive math (Chicken Breast per 100g)
  const mockIngredient: Ingredient = {
    _id: 'ing123',
    name: 'Chicken Breast',
    servingSize: 100,
    servingUnit: 'g',
    nutritionPerServing: {
      calories: 165,
      protein: 31,
      fat: 3.6,
      totalCarbs: 0,
      fiber: 0,
      sugarAlcohols: 0,
      netCarbs: 0,
    },
    nutrition: {
      calories: 165,
      protein: 31,
      fat: 3.6,
      totalCarbs: 0,
      fiber: 0,
      sugarAlcohols: 0,
      netCarbs: 0,
    },
  };

  beforeEach(async () => {
    const mockIngredientService = {};
    const mockToastService = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };

    await TestBed.configureTestingModule({
      // Import the component and ReactiveFormsModule
      imports: [RecipeBuilder, ReactiveFormsModule],
      providers: [
        { provide: IngredientService, useValue: mockIngredientService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeBuilder);
    component = fixture.componentInstance;

    // Trigger change detection to run ngOnInit and setup the form
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should initialize with an empty recipe form and default values', () => {
    expect(component.recipeForm).toBeTruthy();
    expect(component.recipeForm.get('title')?.value).toBe('');
    expect(component.recipeForm.get('recipeType')?.value).toBe('Meal');
    expect(component.recipeForm.get('portions')?.value).toBe(1);
    expect(component.ingredients.length).toBe(0);
  });

  it('should successfully add an ingredient and immediately calculate baseline reactive math', () => {
    component.addIngredientToRecipe(mockIngredient);

    // Verify it was pushed to the FormArray
    expect(component.ingredients.length).toBe(1);
    expect(component.ingredients.at(0).get('name')?.value).toBe('Chicken Breast');

    // Verify the reactive math subscription picked it up (100g baseline)
    expect(component.recipeTotalsPerPortion.calories).toBe(165);
    expect(component.recipeTotalsPerPortion.protein).toBe(31);
  });

  it('should dynamically scale the reactive math when an ingredient weight is changed', () => {
    component.addIngredientToRecipe(mockIngredient);

    // Change the user input from 100g to 200g
    component.ingredients.at(0).get('weightInGrams')?.setValue(200);

    // Verify the math doubled automatically
    expect(component.recipeTotalsPerPortion.calories).toBe(330);
    expect(component.recipeTotalsPerPortion.protein).toBe(62);
  });

  it('should automatically scale ingredient weights when the portions input is changed', () => {
    component.addIngredientToRecipe(mockIngredient);

    // Verify starting state (1 portion = 100g of chicken)
    expect(component.ingredients.at(0).get('weightInGrams')?.value).toBe(100);

    // The user decides to meal-prep and bumps the recipe yield to 4 portions
    component.recipeForm.get('portions')?.setValue(4);

    // The component should automatically multiply the 100g by 4
    expect(component.ingredients.at(0).get('weightInGrams')?.value).toBe(400);

    // But because the recipe now yields 4 portions, the *per portion* macros
    // should remain identical to the original 100g baseline (165 cal / 31g pro)
    expect(component.recipeTotalsPerPortion.calories).toBe(165);
    expect(component.recipeTotalsPerPortion.protein).toBe(31);
  });

  it('should recalculate math correctly when an ingredient is removed', () => {
    // Add two ingredients
    component.addIngredientToRecipe(mockIngredient);
    component.addIngredientToRecipe({
      ...mockIngredient,
      _id: 'ing456',
      name: 'Olive Oil',
    });

    expect(component.ingredients.length).toBe(2);
    expect(component.recipeTotalsPerPortion.calories).toBe(330); // 165 * 2

    // Remove the first ingredient
    component.removeIngredient(0);

    expect(component.ingredients.length).toBe(1);
    expect(component.recipeTotalsPerPortion.calories).toBe(165);
  });

  it('should format the payload accurately for saving', () => {
    component.recipeForm.patchValue({ title: 'Chicken Meal Prep' });
    component.addIngredientToRecipe(mockIngredient);
    component.ingredients.at(0).get('weightInGrams')?.setValue(200);

    const payload = component.currentRecipePayload;

    expect(payload.title).toBe('Chicken Meal Prep');
    expect(payload.portions).toBe(1);
    expect(payload.ingredients.length).toBe(1);

    // The payload array should reflect the absolute totals for that ingredient row
    expect(payload.ingredients[0].weightInGrams).toBe(200);
    expect(payload.ingredients[0].nutrition.calories).toBe(330);
  });

  it('should remain valid and saveable when an ingredient has a null ingredientId (AI Fallback)', () => {
    const aiFallbackIngredient = {
      _id: '', // No ID (AI fallback)
      name: 'Synthetic Spice',
      servingSize: 100,
      servingUnit: 'g',
      nutrition: {
        calories: 50,
        protein: 1,
        totalCarbs: 10,
        fiber: 2,
        sugarAlcohols: 0,
        netCarbs: 8,
        fat: 0,
      },
    } as unknown as Ingredient;

    // Adds a custom ingredient with null ID to the form
    component.addIngredientToRecipe(aiFallbackIngredient);

    expect(component.ingredients.length).toBe(1);
    expect(component.ingredients.at(0).get('ingredientId')?.value).toBeNull();

    // Verify that the Form Control is valid (no Validators.required blocking it)
    expect(component.ingredients.at(0).valid).toBe(true);
  });

  it('should be invalid when an ingredient weight is set to less than 1g', () => {
    component.addIngredientToRecipe(mockIngredient);

    // Set ingredient weight to 0g
    component.ingredients.at(0).get('weightInGrams')?.setValue(0);

    // Verify that less than 1g correctly triggers validation failure
    expect(component.ingredients.at(0).get('weightInGrams')?.invalid).toBe(true);
    expect(component.recipeForm.get('ingredients')?.invalid).toBe(true);
  });

  it('should scale displayAmount proportionately using the weight multiplier in onBalancedRecipeSaved', () => {
    // Initial State: Set 1 Portion recipe, weight = 100g, displayAmount = 3 cloves
    component.recipeForm.get('portions')?.setValue(1);
    component.addIngredientToRecipe(mockIngredient);
    component.ingredients.at(0).get('weightInGrams')?.setValue(100);
    component.ingredients.at(0).get('displayAmount')?.setValue(3);

    // Simulate Balancer scaling up weight from 100g to 150g per portion
    const balancedIngredient = {
      ingredientId: 'ing123',
      name: 'Chicken Breast',
      weightInGrams: 150,
      displayAmount: 3,
      displayUnit: 'cloves',
      nutrition: {} as unknown as NutritionMacros,
      baselineNutrition: mockIngredient.nutrition,
    };

    component.onBalancedRecipeSaved([balancedIngredient]);

    // 3. Verify proportional scaling: displayAmount should be 3 * 1.5 = 4.5
    expect(component.ingredients.at(0).get('weightInGrams')?.value).toBe(150);
    expect(component.ingredients.at(0).get('displayAmount')?.value).toBe(4.5);
  });

  it('should scale displayAmount proportionately when weightInGrams is manually changed', () => {
    component.addIngredientToRecipe(mockIngredient);
    component.ingredients.at(0).get('weightInGrams')?.setValue(100);
    component.ingredients.at(0).get('displayAmount')?.setValue(2);

    // Manually double the weight from 100g to 200g
    component.ingredients.at(0).get('weightInGrams')?.setValue(200);

    // Verify displayAmount scaled proportionately to 4
    expect(component.ingredients.at(0).get('displayAmount')?.value).toBe(4);
  });

  it('should preserve displayAmount during backspace-erasures and scale cleanly on subsequent keystrokes', () => {
    component.addIngredientToRecipe(mockIngredient);
    component.ingredients.at(0).get('weightInGrams')?.setValue(800);
    component.ingredients.at(0).get('displayAmount')?.setValue(4);

    // Simulate user backspacing to clear the input field (newWeight = null)
    component.ingredients.at(0).get('weightInGrams')?.setValue(null);

    // Verify displayAmount is preserved at 4, rather than zeroing out
    expect(component.ingredients.at(0).get('displayAmount')?.value).toBe(4);

    // User types a new weight (e.g., 200g)
    component.ingredients.at(0).get('weightInGrams')?.setValue(200);

    // Verify that the scale calculates from the baseline: 200g / 800g = 0.25x. New display = 4 * 0.25 = 1
    expect(component.ingredients.at(0).get('displayAmount')?.value).toBe(1);
  });

  it('should establish a new baseline when the user manually edits displayAmount to correct ratios', () => {
    component.addIngredientToRecipe(mockIngredient);
    component.ingredients.at(0).get('weightInGrams')?.setValue(100);
    component.ingredients.at(0).get('displayAmount')?.setValue(2);

    // The user manually edits displayAmount from 2 to 5 (at 100g)
    // This should establish a new baseline: weight = 100, displayAmount = 5
    component.ingredients.at(0).get('displayAmount')?.setValue(5);

    // The user now manually edits weightInGrams from 100g to 200g
    component.ingredients.at(0).get('weightInGrams')?.setValue(200);

    // Verify that it scales from the new baseline (ratio = 200 / 100 = 2x, displayAmount = 5 * 2 = 10)
    expect(component.ingredients.at(0).get('displayAmount')?.value).toBe(10);
  });

  it('should prevent standard Enter from submitting the form and instead shift focus to the next field', () => {
    const submitSpy = vi.spyOn(component, 'onSubmit').mockImplementation(() => undefined);
    const preventDefaultSpy = vi.fn();

    const mockEvent = {
      key: 'Enter',
      ctrlKey: false,
      metaKey: false,
      preventDefault: preventDefaultSpy,
      target: document.createElement('input'),
    } as unknown as KeyboardEvent;

    component.handleEnterKey(mockEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('should trigger onSubmit when Ctrl + Enter is pressed inside the form', () => {
    const submitSpy = vi.spyOn(component, 'onSubmit').mockImplementation(() => undefined);
    const preventDefaultSpy = vi.fn();

    const mockEvent = {
      key: 'Enter',
      ctrlKey: true,
      metaKey: false,
      preventDefault: preventDefaultSpy,
      target: document.createElement('input'),
    } as unknown as KeyboardEvent;

    component.handleEnterKey(mockEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(submitSpy).toHaveBeenCalled();
  });

  it('should prevent Shift + Enter from submitting the form and instead shift focus backward', () => {
    const submitSpy = vi.spyOn(component, 'onSubmit').mockImplementation(() => undefined);
    const preventDefaultSpy = vi.fn();

    const mockEvent = {
      key: 'Enter',
      ctrlKey: false,
      metaKey: false,
      shiftKey: true, // Shift pressed
      preventDefault: preventDefaultSpy,
      target: document.createElement('input'),
    } as unknown as KeyboardEvent;

    component.handleEnterKey(mockEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(submitSpy).not.toHaveBeenCalled();
  });
});
