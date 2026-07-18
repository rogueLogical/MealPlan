import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Recipe, UserMacroTargets } from '../../models/recipe.model';
import { AuthService } from '../../services/auth';
import { MealPrepService } from '../../services/meal-prep';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipe-detail.html',
  styleUrls: ['./recipe-detail.scss'],
})
export class RecipeDetail implements OnInit {
  @Input({ required: true }) recipe!: Recipe;
  @Input() isFavorite = false;
  @Input() targetMacros?: UserMacroTargets;

  @Output() toggleFavorite = new EventEmitter<Recipe>();
  @Output() copyRecipe = new EventEmitter<Recipe>();
  @Output() closeDetail = new EventEmitter<void>();
  @Output() editRecipe = new EventEmitter<Recipe>();

  private authService = inject(AuthService);
  private prepService = inject(MealPrepService);
  private toastService = inject(ToastService);

  currentUserId?: string;

  // Portions dialog overlay state
  showPortionDialog = false;
  selectedDelta = 0;

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUserId = user?.id;
    });
  }

  openPortionDialog(): void {
    this.selectedDelta = this.recipe.portions || 1;
    this.showPortionDialog = true;
  }

  closePortionDialog(): void {
    this.showPortionDialog = false;
  }

  submitPortionsToStorage(): void {
    if (this.selectedDelta <= 0) return;

    this.prepService
      .adjustPortionStorage(this.recipe._id, this.recipe.title, this.selectedDelta)
      .subscribe({
        next: () => {
          this.toastService.showSuccess(
            `Added ${this.selectedDelta} portions of "${this.recipe.title}" to storage.`,
          );
          this.closePortionDialog();
        },
        error: (err) => {
          console.error('Adjust Storage Error', err);
          this.toastService.showError('Failed to add portions to storage.');
        },
      });
  }

  get isOwner(): boolean {
    return this.recipe.createdBy === this.currentUserId;
  }

  get displayMacros() {
    return this.recipe.nutritionPerPortion || this.recipe.totalNutrition;
  }

  onClose(): void {
    this.closeDetail.emit();
  }

  onEdit(): void {
    this.editRecipe.emit(this.recipe);
    this.closeDetail.emit();
  }

  onFavoriteClicked(): void {
    this.toggleFavorite.emit(this.recipe);
  }

  onCopyClicked(): void {
    this.copyRecipe.emit(this.recipe);
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
