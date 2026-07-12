import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NutritionMacros } from '../../models/ingredient.model';
import { Recipe, UserMacroTargets } from '../../models/recipe.model';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-recipe-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recipe-card.html',
  styleUrls: ['./recipe-card.scss'],
})
export class RecipeCard implements OnInit {
  @Input({ required: true }) recipe!: Recipe;
  @Input() isFavorite = false;
  @Input() targetMacros?: UserMacroTargets;

  @Output() toggleFavorite = new EventEmitter<Recipe>();
  @Output() edit = new EventEmitter<Recipe>();
  @Output() delete = new EventEmitter<Recipe>();
  @Output() view = new EventEmitter<Recipe>();
  @Output() copyRecipe = new EventEmitter<Recipe>();

  private authService = inject(AuthService);

  currentUserId?: string;

  ngOnInit(): void {
    // Keep track of the logged-in user to determine ownership
    this.authService.currentUser$.subscribe((user) => {
      this.currentUserId = user?.id;
    });
  }

  get totalTimeMinutes(): number {
    return (this.recipe.prepTimeMinutes || 0) + (this.recipe.cookTimeMinutes || 0);
  }

  // Safely prefers the Mongoose Virtual per-portion data, falls back to totals if missing
  get displayMacros(): NutritionMacros {
    return this.recipe.nutritionPerPortion || this.recipe.totalNutrition;
  }

  get isOwner(): boolean {
    return this.recipe.createdBy === this.currentUserId;
  }

  onViewClicked(): void {
    this.view.emit(this.recipe);
  }

  onFavoriteClicked(event: Event): void {
    event.stopPropagation();
    this.toggleFavorite.emit(this.recipe);
  }

  onEditClicked(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.edit.emit(this.recipe);
  }

  onCopyClicked(event: Event): void {
    event.stopPropagation();
    this.copyRecipe.emit(this.recipe);
  }

  onDeleteClicked(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.delete.emit(this.recipe);
  }

  getMacroClass(key: 'calories' | 'protein' | 'fat' | 'netCarbs'): string {
    if (!this.targetMacros) return '';

    const targets =
      this.recipe.recipeType === 'Snack' ? this.targetMacros.snack : this.targetMacros.meal;
    if (!targets) return '';

    const actual = this.displayMacros[key] || 0;
    const target = targets[key] || 0;

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
}
