import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Recipe } from '../../models/recipe.model';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recipe-detail.html',
  styleUrls: ['./recipe-detail.scss'],
})
export class RecipeDetail implements OnInit {
  @Input({ required: true }) recipe!: Recipe;
  @Input() isFavorite = false;

  @Output() toggleFavorite = new EventEmitter<Recipe>();
  @Output() copyRecipe = new EventEmitter<Recipe>();
  @Output() closeDetail = new EventEmitter<void>();
  @Output() editRecipe = new EventEmitter<Recipe>();

  private authService = inject(AuthService);
  currentUserId?: string;

  ngOnInit(): void {
    // Keep track of the logged-in user to determine ownership
    this.authService.currentUser$.subscribe((user) => {
      this.currentUserId = user?.id;
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
    this.closeDetail.emit(); // Close the detail view to open the builder
  }

  onFavoriteClicked(): void {
    this.toggleFavorite.emit(this.recipe);
  }

  onCopyClicked(): void {
    this.copyRecipe.emit(this.recipe);
  }
}
