import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NutritionMacros, Ingredient } from '../../models/ingredient.model';
import {
  RecipePayload,
  RecipeIngredient,
  UserMacroTargets,
  MacroTargets,
} from '../../models/recipe.model';
import { CommonModule } from '@angular/common';
import { IngredientSearch } from '../ingredient-search/ingredient-search';
import { RecipeMacronutrientBalancer } from '../recipe-macronutrient-balancer/recipe-macronutrient-balancer';
import { IngredientService } from '../../services/ingredient';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-recipe-builder',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, IngredientSearch, RecipeMacronutrientBalancer],
  templateUrl: './recipe-builder.html',
  styleUrls: ['./recipe-builder.scss'],
})
export class RecipeBuilder implements OnInit, OnDestroy, OnChanges {
  @Input() initialRecipe?: RecipePayload;
  @Input() targetMacros?: UserMacroTargets;
  @Output() saveRecipe = new EventEmitter<RecipePayload>();
  @Output() closeBuilder = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private ingredientService = inject(IngredientService);
  private toastService = inject(ToastService);
  recipeForm!: FormGroup;
  private formSub?: Subscription;
  private previousPortions = 1;

  // UI Math State (Everything rendered here is PER PORTION)
  recipeTotalsPerPortion: NutritionMacros = {
    calories: 0,
    protein: 0,
    totalCarbs: 0,
    fiber: 0,
    sugarAlcohols: 0,
    netCarbs: 0,
    fat: 0,
  };
  currentTargets?: NutritionMacros;
  ingredientMacrosPerPortion: NutritionMacros[] = [];
  availableTags = [
    'Keto',
    'Low-Carb',
    'High-Protein',
    'High-Fat',
    'High-Fiber',
    'High-Carb',
    'Vegetarian',
    'Vegan',
    'Pescatarian',
    'Paleo',
    'Kosher',
    'Halal',
    'Gluten-Free',
    'Dairy-Free',
    'Nut-Free',
    'Shellfish-Free',
    'Soy-Free',
  ];

  showIngredientSearch = false;
  showBalancerModal = false;

  ngOnInit(): void {
    this.initForm();

    // Listen for portion changes to auto-scale ingredient weights
    this.recipeForm.get('portions')?.valueChanges.subscribe((newPortions: number) => {
      if (!newPortions || newPortions < 1) return;

      const ratio = newPortions / this.previousPortions;

      // Loop through all ingredients and scale them
      this.ingredients.controls.forEach((control) => {
        const currentWeight = control.get('weightInGrams')?.value || 0;
        const currentDisplay = control.get('displayAmount')?.value;

        control.patchValue(
          {
            weightInGrams: Math.round(currentWeight * ratio * 10) / 10,
            displayAmount: currentDisplay ? parseFloat((currentDisplay * ratio).toFixed(2)) : null,
          },
          { emitEvent: false }, // Prevent infinite recalculation loops
        );
      });

      this.previousPortions = newPortions;
    });

    this.setupReactiveMath();

    if (this.initialRecipe) {
      this.patchInitialData();
    }

    // Force an initial calculation so the UI populates immediately
    this.recipeForm.updateValueAndValidity();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // This catches the async data arriving from the parent component after initialization
    if (changes['targetMacros'] && this.targetMacros) {
      // Ensure the form has actually been built before trying to read from it
      if (this.recipeForm) {
        const type = this.recipeForm.get('recipeType')?.value || 'Meal';
        this.currentTargets = type === 'Meal' ? this.targetMacros.meal : this.targetMacros.snack;
      }
    }
  }
  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
  }

  private initForm(): void {
    this.recipeForm = this.fb.group({
      title: ['', Validators.required],
      recipeType: ['Meal', Validators.required],
      isPublic: [false], // Defaults to private
      description: [''],
      instructions: [''],
      prepTimeMinutes: [0, [Validators.min(0)]],
      cookTimeMinutes: [0, [Validators.min(0)]],
      portions: [1, [Validators.required, Validators.min(1)]],
      tags: [[]], // Initialize as a standard control holding an empty array
      ingredients: this.fb.array([]),
    });
  }

  get ingredients(): FormArray {
    return this.recipeForm.get('ingredients') as FormArray;
  }

  openIngredientSearchModal(): void {
    this.showIngredientSearch = true;
  }

  addIngredientToRecipe(selectedIngredient: Ingredient): void {
    const ingredientGroup = this.fb.group({
      ingredientId: [selectedIngredient._id, Validators.required],
      name: [selectedIngredient.name, Validators.required],
      weightInGrams: [
        selectedIngredient.servingSize || 100,
        [Validators.required, Validators.min(1)],
      ],
      displayAmount: [null],
      displayUnit: [''],
      baselineNutrition: [selectedIngredient.nutrition],
    });

    this.ingredients.push(ingredientGroup);
    this.showIngredientSearch = false;
  }

  removeIngredient(index: number): void {
    this.ingredients.removeAt(index);
  }

  openBalancerModal(): void {
    if (this.ingredients.length > 0) {
      this.showBalancerModal = true;
    }
  }

  // Prepares the form data exactly how the Balancer component expects it
  get currentRecipePayload(): RecipePayload {
    const rawData = this.recipeForm.value;
    const formattedIngredients: RecipeIngredient[] = rawData.ingredients.map(
      (item: {
        ingredientId: string;
        name: string;
        weightInGrams: number;
        displayAmount: number | null;
        displayUnit: string;
        baselineNutrition: NutritionMacros;
      }) => {
        const multiplier = item.weightInGrams / 100;
        const base = item.baselineNutrition || {
          calories: 0,
          protein: 0,
          totalCarbs: 0,
          fiber: 0,
          sugarAlcohols: 0,
          fat: 0,
        };

        return {
          ingredientId: item.ingredientId,
          name: item.name,
          weightInGrams: item.weightInGrams,
          displayAmount: item.displayAmount,
          displayUnit: item.displayUnit,
          baselineNutrition: base,
          nutrition: {
            calories: Math.round((base.calories || 0) * multiplier),
            protein: (base.protein || 0) * multiplier,
            totalCarbs: (base.totalCarbs || 0) * multiplier,
            fiber: (base.fiber || 0) * multiplier,
            sugarAlcohols: (base.sugarAlcohols || 0) * multiplier,
            netCarbs:
              ((base.totalCarbs || 0) - (base.fiber || 0) - (base.sugarAlcohols || 0)) * multiplier,
            fat: (base.fat || 0) * multiplier,
          },
        };
      },
    );
    return { ...rawData, ingredients: formattedIngredients };
  }

  // Filters the complex targets down to the strict MacroTargets format
  get currentTargetsForBalancer(): MacroTargets {
    if (!this.currentTargets) {
      return { protein: 0, fat: 0, netCarbs: 0 };
    }
    return {
      protein: this.currentTargets.protein,
      fat: this.currentTargets.fat,
      netCarbs: this.currentTargets.netCarbs,
    };
  }

  onBalancedRecipeSaved(balancedIngredients: RecipeIngredient[]): void {
    // Get the current yield size of the recipe
    const currentPortions = this.recipeForm.get('portions')?.value || 1;

    this.ingredients.clear();

    balancedIngredients.forEach((ing) => {
      // The balancer returns weights for ONE portion. Scale it back up to match the recipe yield.
      const scaledWeight = Math.round(ing.weightInGrams * currentPortions * 10) / 10;
      const scaledDisplay = ing.displayAmount
        ? parseFloat((ing.displayAmount * currentPortions).toFixed(2))
        : null;

      const ingredientGroup = this.fb.group({
        ingredientId: [ing.ingredientId, Validators.required],
        name: [ing.name, Validators.required],
        weightInGrams: [scaledWeight, [Validators.required, Validators.min(1)]],
        displayAmount: [scaledDisplay],
        displayUnit: [ing.displayUnit],
        baselineNutrition: [ing.baselineNutrition],
      });
      this.ingredients.push(ingredientGroup);
    });

    this.showBalancerModal = false;
  }

  private setupReactiveMath(): void {
    // Listen to the entire form so changes to "portions" trigger recalculations
    this.formSub = this.recipeForm.valueChanges.subscribe((formValue) => {
      const portions = Math.max(1, formValue.portions || 1); // Prevent divide by 0
      const type = formValue.recipeType;
      const items = formValue.ingredients || [];

      const absoluteTotals = {
        calories: 0,
        protein: 0,
        totalCarbs: 0,
        fiber: 0,
        sugarAlcohols: 0,
        fat: 0,
      };
      const ingMacros: NutritionMacros[] = [];

      items.forEach((item: RecipeIngredient) => {
        if (!item.weightInGrams || !item.baselineNutrition) {
          ingMacros.push({
            calories: 0,
            protein: 0,
            totalCarbs: 0,
            fiber: 0,
            sugarAlcohols: 0,
            netCarbs: 0,
            fat: 0,
          });
          return;
        }

        const multiplier = item.weightInGrams / 100;
        const base = item.baselineNutrition;

        // Absolute math for this ingredient
        const absCal = (base.calories || 0) * multiplier;
        const absPro = (base.protein || 0) * multiplier;
        const absCarb = (base.totalCarbs || 0) * multiplier;
        const absFib = (base.fiber || 0) * multiplier;
        const absSA = (base.sugarAlcohols || 0) * multiplier;
        const absFat = (base.fat || 0) * multiplier;
        const absNet = Math.max(0, absCarb - absFib - absSA);

        absoluteTotals.calories += absCal;
        absoluteTotals.protein += absPro;
        absoluteTotals.totalCarbs += absCarb;
        absoluteTotals.fiber += absFib;
        absoluteTotals.sugarAlcohols += absSA;
        absoluteTotals.fat += absFat;

        // Save PER PORTION stats for this specific row
        ingMacros.push({
          calories: Math.round(absCal / portions),
          protein: Math.round((absPro / portions) * 10) / 10,
          totalCarbs: Math.round((absCarb / portions) * 10) / 10,
          fiber: Math.round((absFib / portions) * 10) / 10,
          sugarAlcohols: Math.round((absSA / portions) * 10) / 10,
          netCarbs: Math.round((absNet / portions) * 10) / 10,
          fat: Math.round((absFat / portions) * 10) / 10,
        });
      });

      const absTotalNet = Math.max(
        0,
        absoluteTotals.totalCarbs - absoluteTotals.fiber - absoluteTotals.sugarAlcohols,
      );

      // Save PER PORTION stats for the entire recipe
      this.recipeTotalsPerPortion = {
        calories: Math.round(absoluteTotals.calories / portions),
        protein: Math.round((absoluteTotals.protein / portions) * 10) / 10,
        totalCarbs: Math.round((absoluteTotals.totalCarbs / portions) * 10) / 10,
        fiber: Math.round((absoluteTotals.fiber / portions) * 10) / 10,
        sugarAlcohols: Math.round((absoluteTotals.sugarAlcohols / portions) * 10) / 10,
        netCarbs: Math.round((absTotalNet / portions) * 10) / 10,
        fat: Math.round((absoluteTotals.fat / portions) * 10) / 10,
      };

      this.ingredientMacrosPerPortion = ingMacros;

      // Update the active targets based on the toggle
      if (this.targetMacros) {
        this.currentTargets = type === 'Meal' ? this.targetMacros.meal : this.targetMacros.snack;
      }
    });
  }

  toggleTag(tag: string, event: Event): void {
    const tagsControl = this.recipeForm.get('tags');
    const currentTags: string[] = tagsControl?.value || [];
    const isChecked = (event.target as HTMLInputElement).checked;

    if (isChecked) {
      tagsControl?.setValue([...currentTags, tag]);
    } else {
      tagsControl?.setValue(currentTags.filter((t) => t !== tag));
    }
  }

  hasTag(tag: string): boolean {
    const currentTags: string[] = this.recipeForm.get('tags')?.value || [];
    return currentTags.includes(tag);
  }

  onSubmit(): void {
    if (this.recipeForm.invalid) return;

    const rawData = this.recipeForm.value;

    const formattedIngredients: RecipeIngredient[] = rawData.ingredients.map(
      (item: RecipeIngredient) => {
        const multiplier = item.weightInGrams / 100;
        const base = item.baselineNutrition!;

        return {
          ingredientId: item.ingredientId,
          name: item.name,
          weightInGrams: item.weightInGrams,
          displayAmount: item.displayAmount,
          displayUnit: item.displayUnit,
          nutrition: {
            calories: Math.round((base.calories || 0) * multiplier),
            protein: (base.protein || 0) * multiplier,
            totalCarbs: (base.totalCarbs || 0) * multiplier,
            fiber: (base.fiber || 0) * multiplier,
            sugarAlcohols: (base.sugarAlcohols || 0) * multiplier,
            netCarbs:
              ((base.totalCarbs || 0) - (base.fiber || 0) - (base.sugarAlcohols || 0)) * multiplier,
            fat: (base.fat || 0) * multiplier,
          },
        };
      },
    );

    const payload: RecipePayload = { ...rawData, ingredients: formattedIngredients };
    this.saveRecipe.emit(payload);
  }

  onClose(): void {
    this.closeBuilder.emit();
  }

  getMacroClass(key: 'calories' | 'protein' | 'fat' | 'netCarbs'): string {
    if (!this.currentTargets) return '';

    const actual = this.recipeTotalsPerPortion[key] || 0;
    const target = this.currentTargets[key] || 0;

    if (target === 0) return '';

    const tolerance = target * 0.1;

    if (actual > target + tolerance) {
      return 'macro-over';
    } else if (actual < target - tolerance) {
      return 'macro-under';
    } else {
      return 'macro-within';
    }
  }

  private patchInitialData(): void {
    if (!this.initialRecipe) return;

    this.previousPortions = this.initialRecipe.portions || 1;

    this.recipeForm.patchValue({
      title: this.initialRecipe.title,
      recipeType: this.initialRecipe.recipeType || 'Meal',
      isPublic: this.initialRecipe.isPublic || false,
      description: this.initialRecipe.description,
      tags: this.initialRecipe.tags || [],

      instructions: this.initialRecipe.instructions,
      prepTimeMinutes: this.initialRecipe.prepTimeMinutes,
      cookTimeMinutes: this.initialRecipe.cookTimeMinutes,
      portions: this.initialRecipe.portions,
    });

    this.initialRecipe.ingredients.forEach((ing: RecipeIngredient) => {
      const reverseMultiplier = 100 / ing.weightInGrams;
      const baseline: NutritionMacros = {
        calories: ing.nutrition.calories * reverseMultiplier,
        protein: ing.nutrition.protein * reverseMultiplier,
        totalCarbs: ing.nutrition.totalCarbs * reverseMultiplier,
        fiber: ing.nutrition.fiber * reverseMultiplier,
        sugarAlcohols: ing.nutrition.sugarAlcohols * reverseMultiplier,
        netCarbs: ing.nutrition.netCarbs * reverseMultiplier,
        fat: ing.nutrition.fat * reverseMultiplier,
      };

      const ingredientGroup = this.fb.group({
        ingredientId: [ing.ingredientId, Validators.required],
        name: [ing.name, Validators.required],
        weightInGrams: [ing.weightInGrams, [Validators.required, Validators.min(1)]],
        displayAmount: [ing.displayAmount],
        displayUnit: [ing.displayUnit],
        baselineNutrition: [baseline],
      });
      this.ingredients.push(ingredientGroup);
    });
  }
}
