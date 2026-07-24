import {
  Component,
  EventEmitter,
  OnInit,
  OnDestroy,
  Output,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecipeService } from '../../services/recipe';
import { UserService } from '../../services/user';
import { ToastService } from '../../services/toast';
import { RecipePayload } from '../../models/recipe.model';

@Component({
  selector: 'app-recipe-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipe-generator.html',
  styleUrls: ['./recipe-generator.scss'],
})
export class RecipeGenerator implements OnInit, OnDestroy {
  @Output() closeGenerator = new EventEmitter<void>();
  @Output() recipeGenerated = new EventEmitter<RecipePayload>();

  description = '';
  recipeType: 'Meal' | 'Snack' = 'Meal';
  useMacroTargets = true;
  dietaryRestrictions: string[] = [];

  availableRestrictions = [
    'Vegetarian',
    'Vegan',
    'Pescatarian',
    'Keto',
    'Low-Carb',
    'Paleo',
    'Gluten-Free',
    'Dairy-Free',
    'Nut-Free',
    'Shellfish-Free',
    'Soy-Free',
    'Kosher',
    'Halal',
  ];

  isGenerating = false;
  statusText = 'Preheating the oven...';

  private statusTexts = [
    'Preheating the oven...',
    'Chopping the vegetables...',
    'Simmering the broth...',
    'Stirring the pot...',
    'Measuring out the spices...',
    'Plating the presentation...',
  ];
  private statusInterval: ReturnType<typeof setInterval> | null = null;

  private recipeService = inject(RecipeService);
  private userService = inject(UserService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.userService.getUserProfile().subscribe({
      next: (response) => {
        if (response.user && response.user.nutritionSettings) {
          const profileRestrictions = response.user.nutritionSettings.dietaryRestrictions || [];
          // Pre-populate filters based on user's personal dietary profile
          this.dietaryRestrictions = profileRestrictions.filter((tag) =>
            this.availableRestrictions.includes(tag),
          );
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to pre-populate settings dietary restrictions:', err);
      },
    });
  }

  ngOnDestroy(): void {
    this.clearStatusInterval();
  }

  toggleRestriction(restriction: string): void {
    const idx = this.dietaryRestrictions.indexOf(restriction);
    if (idx > -1) {
      this.dietaryRestrictions.splice(idx, 1);
    } else {
      this.dietaryRestrictions.push(restriction);
    }
  }

  generateRecipe(): void {
    if (!this.description.trim()) {
      this.toastService.showError('Please describe the recipe you want to generate.');
      return;
    }

    if (this.description.trim().length > 256) {
      this.toastService.showError('Description cannot exceed 256 characters.');
      return;
    }

    this.isGenerating = true;
    this.statusText = this.statusTexts[0];
    this.startStatusCycle();

    const payload = {
      description: this.description,
      recipeType: this.recipeType,
      useMacroTargets: this.useMacroTargets,
      dietaryRestrictions: this.dietaryRestrictions,
    };

    this.recipeService.generateRecipe(payload).subscribe({
      next: (recipe) => {
        this.clearStatusInterval();
        this.isGenerating = false;
        this.toastService.showSuccess(`"${recipe.title}" generated successfully!`);
        this.recipeGenerated.emit(recipe);
      },
      error: (err) => {
        this.clearStatusInterval();
        this.isGenerating = false;
        console.error('Recipe Generation Failed:', err);
        this.toastService.showError(
          err.error?.message || 'Failed to generate recipe. Please try again.',
        );
        this.cdr.markForCheck();
      },
    });
  }

  onCancel(): void {
    this.closeGenerator.emit();
  }

  private startStatusCycle(): void {
    let index = 1;
    this.statusInterval = setInterval(() => {
      this.statusText = this.statusTexts[index];
      index = (index + 1) % this.statusTexts.length;
      this.cdr.markForCheck();
    }, 3000);
  }

  private clearStatusInterval(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
  }
}
