import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { RecipeBalancer } from '../../services/recipe-balancer';
import { ToastService } from '../../services/toast';
import {
  RecipePayload,
  RecipeIngredient,
  MacroTargets,
  InterventionPayload,
  InterventionOption,
} from '../../models/recipe.model';

type BalancerState = 'CONFIG' | 'LOADING' | 'INTERVENTION' | 'REVIEW';

@Component({
  selector: 'app-recipe-macronutrient-balancer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recipe-macronutrient-balancer.html',
  styleUrls: ['./recipe-macronutrient-balancer.scss'],
})
export class RecipeMacronutrientBalancer implements OnInit {
  // --- Inputs & Outputs ---
  @Input() originalRecipe!: RecipePayload;
  @Input() mealTargets!: MacroTargets;
  @Output() cancelBalancer = new EventEmitter<void>();
  @Output() updateRecipe = new EventEmitter<RecipeIngredient[]>();

  // --- State Management ---
  currentState: BalancerState = 'CONFIG';
  isApproximateResult = false;

  // --- Data Payload ---
  currentIngredients: RecipeIngredient[] = [];
  selectedDietaryRestrictions: string[] = [];
  interventionCount = 0;

  // --- Active Intervention Data ---
  currentIntervention: InterventionPayload | null = null;

  // Reusing existing tags for the UI checklist
  availableDietaryTags = [
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
  private balancerService = inject(RecipeBalancer);
  private cdr = inject(ChangeDetectorRef);
  private toastService = inject(ToastService);

  ngOnInit(): void {
    // Deep clone the ingredients so we don't mutate the parent's data until explicitly saved
    this.currentIngredients = JSON.parse(JSON.stringify(this.originalRecipe.ingredients));

    // Pre-select restrictions if the recipe already has them
    if (this.originalRecipe.tags) {
      this.selectedDietaryRestrictions = this.availableDietaryTags.filter((tag) =>
        this.originalRecipe.tags?.includes(tag),
      );
    }
  }

  toggleRestriction(tag: string): void {
    const index = this.selectedDietaryRestrictions.indexOf(tag);
    if (index > -1) {
      this.selectedDietaryRestrictions.splice(index, 1);
    } else {
      this.selectedDietaryRestrictions.push(tag);
    }
  }

  // --- The Core Recursive Loop ---

  executeBalancer(): void {
    this.currentState = 'LOADING';

    const requestPayload = {
      ingredients: this.currentIngredients,
      targets: this.mealTargets,
      dietaryRestrictions: this.selectedDietaryRestrictions,
      interventionCount: this.interventionCount,
    };

    this.balancerService
      .balanceRecipe(requestPayload)
      .pipe(
        finalize(() => {
          // Fallback safety: if an error occurs, ensure we don't stay stuck loading
          if (this.currentState === 'LOADING') this.currentState = 'CONFIG';
        }),
      )
      .subscribe({
        next: (response) => {
          if (response.status === 'action_required' && response.intervention) {
            this.currentIngredients = response.ingredients || [];
            this.currentIntervention = response.intervention;
            this.currentState = 'INTERVENTION';
            this.cdr.markForCheck();
          } else if (response.status === 'success' || response.status === 'approximate_success') {
            this.currentIngredients = response.ingredients || [];
            this.isApproximateResult = response.status === 'approximate_success';
            this.currentState = 'REVIEW';
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('Balancing failed', err);
          this.toastService.showError(
            err.error?.message || 'Recipe balancing failed. Please try again.',
          );
          this.currentState = 'CONFIG';
          this.cdr.markForCheck();
        },
      });
  }

  // --- Intervention Resolution Logic ---

  selectInterventionOption(option: InterventionOption): void {
    if (!this.currentIntervention) return;

    if (this.currentIntervention.type === 'SWAP') {
      // Find and replace the offending ingredient
      const targetIndex = this.currentIngredients.findIndex(
        (ing) =>
          ing.name.toLowerCase() === this.currentIntervention!.targetIngredient?.toLowerCase(),
      );

      if (targetIndex > -1) {
        this.currentIngredients[targetIndex] = {
          ...this.currentIngredients[targetIndex],
          ingredientId: option._id,
          name: option.name,
          weightInGrams: option.servingSize || 100,
          displayAmount: null,
          displayUnit: option.servingUnit || '',
          baselineNutrition: option.nutritionPerServing,
          nutrition: option.nutritionPerServing,
        };
      }
    } else if (this.currentIntervention.type === 'ADD') {
      // Push a new ingredient into the array.
      this.currentIngredients.push({
        ingredientId: option._id,
        name: option.name,
        weightInGrams: option.servingSize || 100,
        displayAmount: null,
        displayUnit: option.servingUnit || '',
        baselineNutrition: option.nutritionPerServing,
        nutrition: option.nutritionPerServing,
      });
    }

    // Increment the circuit breaker and run the math again
    this.interventionCount++;
    this.currentIntervention = null;
    this.executeBalancer();
  }

  executeRemoveIntervention(): void {
    if (!this.currentIntervention || this.currentIntervention.type !== 'REMOVE') return;

    // Filter out the offending ingredient entirely
    this.currentIngredients = this.currentIngredients.filter(
      (ing) => ing.name.toLowerCase() !== this.currentIntervention!.targetIngredient?.toLowerCase(),
    );

    // Increment the circuit breaker and run the math again
    this.interventionCount++;
    this.currentIntervention = null;
    this.executeBalancer();
  }

  // --- Final Actions ---

  onSave(): void {
    // Emit the mathematically balanced ingredients back to the parent recipe-builder
    this.updateRecipe.emit(this.currentIngredients);
  }

  onCancel(): void {
    this.cancelBalancer.emit();
  }

  // --- UI Helpers for Config State ---

  get currentMacrosPerPortion() {
    const portions = this.originalRecipe.portions || 1;
    let p = 0,
      f = 0,
      c = 0,
      cal = 0;

    this.currentIngredients.forEach((ing) => {
      p += ing.nutrition?.protein || 0;
      f += ing.nutrition?.fat || 0;
      c += ing.nutrition?.netCarbs || 0;
      cal += ing.nutrition?.calories || 0;
    });

    return {
      protein: Math.round((p / portions) * 10) / 10,
      fat: Math.round((f / portions) * 10) / 10,
      netCarbs: Math.round((c / portions) * 10) / 10,
      calories: Math.round(cal / portions),
    };
  }

  get targetCalories(): number {
    return this.mealTargets.protein * 4 + this.mealTargets.netCarbs * 4 + this.mealTargets.fat * 9;
  }
}
