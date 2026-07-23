import { Component, inject, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecipeBuilder } from '../recipe-builder/recipe-builder';
import { RecipeService } from '../../services/recipe';
import { RecipePayload, UserMacroTargets } from '../../models/recipe.model';
import { UserService } from '../../services/user';
import { RecipeCard } from '../recipe-card/recipe-card';
import { Recipe } from '../../models/recipe.model';
import { RecipeDetail } from '../recipe-detail/recipe-detail';
import { AuthService } from '../../services/auth';
import { RecipeSearch } from '../recipe-search/recipe-search';
import { ToastService } from '../../services/toast';
import { Subscription } from 'rxjs';
import { RecipeGenerator } from '../recipe-generator/recipe-generator';

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [CommonModule, RecipeBuilder, RecipeCard, RecipeDetail, RecipeSearch, RecipeGenerator],
  templateUrl: './recipes-library.html',
  styleUrls: ['./recipes-library.scss'],
})
export class RecipesLibrary implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private recipeService = inject(RecipeService);
  private authService = inject(AuthService);
  private authSub?: Subscription;
  private cdr = inject(ChangeDetectorRef);
  private toastService = inject(ToastService);

  showRecipeBuilder = false;

  isSearchModalOpen = false;
  isCopying = false;

  userTargets?: UserMacroTargets;

  favoriteRecipeIds: string[] = [];
  favoriteRecipes: Recipe[] = [];

  isLoadingFavorites = true;

  myRecipes: Recipe[] = [];
  isLoadingRecipes = true;

  viewingRecipe?: Recipe | null = null;
  editingRecipeId: string | null = null;
  selectedRecipeToEdit?: Recipe;
  recipeToDelete?: Recipe;

  isGeneratorOpen = false;

  ngOnInit(): void {
    // Listen to the global auth stream safely
    this.authSub = this.authService.currentUser$.subscribe((user) => {
      // If logged out, stop completely! No data fetching allowed.
      if (!user) {
        return;
      }

      // Fetch all required component data
      this.fetchMyRecipes();
      this.fetchFavoriteRecipes();
      this.fetchUserTargets();

      // Set favorite IDs for the UI
      if (user.favoriteRecipes) {
        this.favoriteRecipeIds = user.favoriteRecipes;
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up the subscription when navigating away to prevent memory leaks
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }

  fetchUserTargets(): void {
    // Fetch the user's profile to extract their macro goals
    this.userService.getUserProfile().subscribe({
      next: (res) => {
        if (res.user?.nutritionSettings) {
          const settings = res.user.nutritionSettings;

          // Apply safe fallbacks
          const daily = settings.dailyMacroTargets || {
            calories: 0,
            protein: 0,
            netCarbs: 0,
            fat: 0,
          };
          const split = settings.mealMacroSplitPercentage || {
            calories: 80,
            protein: 80,
            netCarbs: 80,
            fat: 80,
          };
          const mealsCount = settings.dailyMealsCount || 1;
          const snacksCount = settings.dailySnacksCount || 0;

          // Calculate Per-Meal Targets
          const mealTargets = {
            calories: 0,
            protein: Math.round(
              ((daily.protein || 0) * ((split.protein || 80) / 100)) / mealsCount,
            ),
            netCarbs: Math.round(
              ((daily.netCarbs || 0) * ((split.netCarbs || 80) / 100)) / mealsCount,
            ),
            fat: Math.round(((daily.fat || 0) * ((split.fat || 80) / 100)) / mealsCount),
            totalCarbs: 0,
            fiber: 0,
            sugarAlcohols: 0, // Optional/Unused for daily goals
          };
          mealTargets.calories = Math.round(
            mealTargets.protein * 4 + mealTargets.netCarbs * 4 + mealTargets.fat * 9,
          );

          // Calculate Per-Snack Targets
          const snackTargets =
            snacksCount === 0
              ? {
                  calories: 0,
                  protein: 0,
                  netCarbs: 0,
                  fat: 0,
                  totalCarbs: 0,
                  fiber: 0,
                  sugarAlcohols: 0,
                }
              : {
                  calories: Math.round(
                    ((daily.calories || 0) * ((100 - (split.calories || 80)) / 100)) / snacksCount,
                  ),
                  protein: Math.round(
                    ((daily.protein || 0) * ((100 - (split.protein || 80)) / 100)) / snacksCount,
                  ),
                  netCarbs: Math.round(
                    ((daily.netCarbs || 0) * ((100 - (split.netCarbs || 80)) / 100)) / snacksCount,
                  ),
                  fat: Math.round(
                    ((daily.fat || 0) * ((100 - (split.fat || 80)) / 100)) / snacksCount,
                  ),
                  totalCarbs: 0,
                  fiber: 0,
                  sugarAlcohols: 0,
                };
          snackTargets.calories = Math.round(
            snackTargets.protein * 4 + snackTargets.netCarbs * 4 + snackTargets.fat * 9,
          );

          this.userTargets = {
            meal: mealTargets,
            snack: snackTargets,
          };
        }
      },
      error: (err) => console.error('Failed to load user targets for builder:', err),
    });
  }

  fetchFavoriteRecipes(): void {
    this.isLoadingFavorites = true;
    this.recipeService.getFavoriteRecipes().subscribe({
      next: (res) => {
        this.favoriteRecipes = res.data;
        this.isLoadingFavorites = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load favorite recipes', err);
        this.isLoadingFavorites = false;
        this.cdr.detectChanges();
      },
    });
  }

  onToggleFavorite(recipe: Recipe): void {
    this.userService.toggleFavoriteRecipe(recipe._id).subscribe({
      next: (res) => {
        this.favoriteRecipeIds = res.favoriteRecipes;
        // Update global auth stream so the IDs persist across the app
        this.authService.updateCurrentUser({ favoriteRecipes: res.favoriteRecipes });

        if (res.isFavorite) {
          // Refetch to get the fully populated recipe for the top section
          this.fetchFavoriteRecipes();
        } else {
          // Instantly remove it from the top array locally for a snappy UI
          this.favoriteRecipes = this.favoriteRecipes.filter((r) => r._id !== recipe._id);
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to toggle favorite', err),
    });
  }

  fetchMyRecipes(): void {
    this.isLoadingRecipes = true;
    this.recipeService.getMyRecipes().subscribe({
      next: (res) => {
        this.myRecipes = res.data;
        this.isLoadingRecipes = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load recipes', err);
        this.isLoadingRecipes = false;
        this.cdr.detectChanges();
      },
    });
  }

  toggleRecipeBuilder(): void {
    if (this.showRecipeBuilder) {
      // If closing, wipe the edit state
      this.closeBuilder();
    } else {
      this.showRecipeBuilder = true;
    }
  }

  onViewRecipe(recipe: Recipe): void {
    this.viewingRecipe = recipe;
  }

  closeView(): void {
    this.viewingRecipe = undefined;
  }

  onEditRecipe(recipe: Recipe): void {
    this.editingRecipeId = recipe._id;
    this.selectedRecipeToEdit = recipe;
    this.showRecipeBuilder = true;
  }

  closeBuilder(): void {
    this.showRecipeBuilder = false;
    this.editingRecipeId = null;
    this.selectedRecipeToEdit = undefined;
  }

  // Catches the validated payload from the builder and sends it to the API
  onSaveRecipeTest(payload: RecipePayload): void {
    if (this.editingRecipeId) {
      // EDIT MODE: Call the PUT endpoint
      this.recipeService.updateRecipe(this.editingRecipeId, payload).subscribe({
        next: () => {
          this.toastService.showSuccess('Recipe Saved!');
          this.closeBuilder();
          this.fetchMyRecipes();
          this.fetchFavoriteRecipes();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to update recipe:', err);
          this.toastService.showError('Failed to update recipe. Check console.');
        },
      });
    } else {
      // CREATE MODE: Call the POST endpoint
      this.recipeService.createRecipe(payload).subscribe({
        next: () => {
          this.toastService.showSuccess('Recipe created successfully!');
          this.closeBuilder();
          this.fetchMyRecipes();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to save recipe:', err);
          this.toastService.showError('Failed to save recipe. Check console.');
        },
      });
    }
  }

  onDeleteRecipe(recipe: Recipe): void {
    this.recipeToDelete = recipe; // Triggers the modal to open
    this.cdr.detectChanges();
  }

  confirmDelete(): void {
    if (!this.recipeToDelete) return;

    this.recipeService.deleteRecipe(this.recipeToDelete._id).subscribe({
      next: () => {
        this.toastService.showSuccess(`Deleted "${this.recipeToDelete?.title}".`);
        this.recipeToDelete = undefined;
        // Refresh the grid
        this.fetchMyRecipes();
        this.fetchFavoriteRecipes();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to delete recipe:', err);
        this.toastService.showError('Failed to delete recipe. Check console.');
        this.recipeToDelete = undefined;
        this.cdr.detectChanges();
      },
    });
  }

  cancelDelete(): void {
    this.recipeToDelete = undefined;
    this.cdr.detectChanges();
  }

  openSearchModal(): void {
    this.isSearchModalOpen = true;
  }

  closeSearchModal(): void {
    this.isSearchModalOpen = false;
  }

  onCopyRecipe(recipe: Recipe): void {
    if (this.isCopying) return;
    this.isCopying = true;

    this.recipeService.forkRecipe(recipe._id).subscribe({
      next: (res) => {
        // Grab the recipe from the correctly named property
        const newRecipe = res.recipe;

        // Unshift pushes it to the TOP of the user's local My Recipes array
        this.myRecipes.unshift(newRecipe);

        // Reset states
        this.isCopying = false;
        this.viewingRecipe = null;

        // Alert the user using the correct .title property
        this.toastService.showSuccess(`Successfully copied "${newRecipe.title}" to your library!`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to copy recipe', err);
        this.isCopying = false;
        this.toastService.showError('Failed to copy recipe. Please try again.');
      },
    });
  }

  openGeneratorModal(): void {
    this.isGeneratorOpen = true;
  }

  closeGeneratorModal(): void {
    this.isGeneratorOpen = false;
  }

  onRecipeGenerated(generatedRecipe: RecipePayload): void {
    this.isGeneratorOpen = false;

    // Wipe editingRecipeId to trigger Create Mode in the builder
    this.editingRecipeId = null;
    this.selectedRecipeToEdit = generatedRecipe as Recipe;
    this.showRecipeBuilder = true;

    this.cdr.detectChanges();
  }
}
