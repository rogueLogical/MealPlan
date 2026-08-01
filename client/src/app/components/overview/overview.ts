import { Component, OnInit, HostListener, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { UserService, BackendUserDocument } from '../../services/user';
import { MealPrepService, MealPrepPlan, PortionStorageItem } from '../../services/meal-prep';
import { RecipeService } from '../../services/recipe';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

import { Recipe, RecipePayload, UserMacroTargets } from '../../models/recipe.model';
import { RecipeCard } from '../recipe-card/recipe-card';
import { RecipeDetail } from '../recipe-detail/recipe-detail';
import { RecipeBuilder } from '../recipe-builder/recipe-builder';
import { FocusTrapDirective } from '../../directives/focus-trap';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, RecipeCard, RecipeDetail, RecipeBuilder, FocusTrapDirective],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview implements OnInit {
  private userService = inject(UserService);
  private prepService = inject(MealPrepService);
  private recipeService = inject(RecipeService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = true;
  userProfile: BackendUserDocument | null = null;
  activePlan: MealPrepPlan | null = null;

  shoppingListUncheckedCount = 0;
  totalPortionsInStorage = 0;
  lowStockPortions: PortionStorageItem[] = [];

  favoriteRecipes: Recipe[] = [];
  favoriteRecipeIds: string[] = [];
  recentlyViewedRecipes: Recipe[] = [];
  userTargets?: UserMacroTargets;

  viewingRecipe: Recipe | null = null;

  // Recipe Builder / Edit / Delete States
  showRecipeBuilder = false;
  editingRecipeId: string | null = null;
  selectedRecipeToEdit?: Recipe;
  recipeToDelete?: Recipe;

  cardsPerRow = 1;

  ngOnInit(): void {
    this.calculateCardsPerRow();
    this.authService.currentUser$.subscribe((user) => {
      if (!user) return;
      this.loadDashboardData();
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.calculateCardsPerRow();
  }

  calculateCardsPerRow(): void {
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const isMobile = windowWidth <= 768;
    const padding = isMobile ? 48 : 80;
    const sidebarWidth = isMobile ? 0 : 260;

    const availableWidth = Math.max(300, windowWidth - sidebarWidth - padding);
    const cardMinWidth = 320;
    const gap = 24;

    const fitInRow = Math.max(1, Math.floor((availableWidth + gap) / (cardMinWidth + gap)));
    this.cardsPerRow = fitInRow;
  }

  // Display limit: max(4, cards that fit in 2 rows)
  get maxRecipesToDisplay(): number {
    return Math.max(4, this.cardsPerRow * 2);
  }

  get displayedFavoriteRecipes(): Recipe[] {
    return this.favoriteRecipes.slice(0, this.maxRecipesToDisplay);
  }

  get displayedRecentlyViewedRecipes(): Recipe[] {
    return this.recentlyViewedRecipes.slice(0, this.maxRecipesToDisplay);
  }

  loadDashboardData(): void {
    this.isLoading = true;

    forkJoin({
      profileRes: this.userService.getUserProfile(),
      activePlanRes: this.prepService.getActivePlan(),
      shoppingListRes: this.prepService.getShoppingList(),
      storageRes: this.prepService.getPortionStorage(),
      favoritesRes: this.recipeService.getFavoriteRecipes(),
      recentlyViewedRes: this.userService.getRecentlyViewedRecipes(),
    }).subscribe({
      next: (res) => {
        this.userProfile = res.profileRes.user;
        this.activePlan = res.activePlanRes.plan;

        // Shopping List Count
        const shoppingItems = res.shoppingListRes.list?.items || [];
        this.shoppingListUncheckedCount = shoppingItems.filter((i) => !i.isChecked).length;

        // Portion Storage Calculations
        const storageItems = res.storageRes.storage || [];
        this.totalPortionsInStorage = storageItems.reduce(
          (sum, item) => sum + (item.portionsInStorage || 0),
          0,
        );
        // Low Stock Threshold: <= 3 portions remaining (and > 0)
        this.lowStockPortions = storageItems.filter(
          (item) => item.portionsInStorage > 0 && item.portionsInStorage <= 3,
        );

        // Favorite Recipes (sorted by updatedAt descending)
        const favs = res.favoritesRes.data || [];
        this.favoriteRecipes = favs.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        this.favoriteRecipeIds = this.favoriteRecipes.map((r) => r._id);

        // Recently Viewed Recipes
        this.recentlyViewedRecipes = res.recentlyViewedRes.data || [];

        // Hydrate macro targets
        this.calculateUserTargets(this.userProfile);

        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load dashboard data:', err);
        this.toastService.showError('Failed to load home dashboard summaries.');
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  get showWelcomeBanner(): boolean {
    if (!this.userProfile) return false;
    return !this.userProfile.hasConfiguredSettings && !this.userProfile.dismissedWelcomeBanner;
  }

  get activePlanProgress(): { completed: number; total: number } {
    if (!this.activePlan || !this.activePlan.recipes) {
      return { completed: 0, total: 0 };
    }
    const total = this.activePlan.recipes.length;
    const completed = this.activePlan.recipes.filter((r) => r.isCompleted).length;
    return { completed, total };
  }

  getRecipeTitle(recipeId: string | Recipe): string {
    if (typeof recipeId === 'object' && recipeId !== null && 'title' in recipeId) {
      return recipeId.title;
    }
    return 'Recipe';
  }

  getRecipeId(recipeId: string | Recipe): string {
    if (typeof recipeId === 'object' && recipeId !== null && '_id' in recipeId) {
      return recipeId._id;
    }
    return recipeId as string;
  }

  dismissBanner(): void {
    this.userService.dismissWelcomeBanner().subscribe({
      next: () => {
        if (this.userProfile) {
          this.userProfile.dismissedWelcomeBanner = true;
        }
        this.toastService.showSuccess('Welcome banner dismissed.');
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Failed to dismiss banner:', err),
    });
  }

  onViewRecipe(recipe: Recipe): void {
    this.viewingRecipe = recipe;
  }

  closeView(): void {
    this.viewingRecipe = null;
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

  onSaveRecipe(payload: RecipePayload): void {
    if (this.editingRecipeId) {
      this.recipeService.updateRecipe(this.editingRecipeId, payload).subscribe({
        next: () => {
          this.toastService.showSuccess('Recipe updated successfully!');
          this.closeBuilder();
          this.loadDashboardData();
        },
        error: (err) => {
          console.error('Failed to update recipe:', err);
          this.toastService.showError('Failed to update recipe.');
        },
      });
    } else {
      this.recipeService.createRecipe(payload).subscribe({
        next: () => {
          this.toastService.showSuccess('Recipe created successfully!');
          this.closeBuilder();
          this.loadDashboardData();
        },
        error: (err) => {
          console.error('Failed to create recipe:', err);
          this.toastService.showError('Failed to create recipe.');
        },
      });
    }
  }

  onDeleteRecipe(recipe: Recipe): void {
    this.recipeToDelete = recipe;
  }

  confirmDelete(): void {
    if (!this.recipeToDelete) return;

    this.recipeService.deleteRecipe(this.recipeToDelete._id).subscribe({
      next: () => {
        this.toastService.showSuccess(`Deleted "${this.recipeToDelete?.title}".`);
        this.recipeToDelete = undefined;
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Failed to delete recipe:', err);
        this.toastService.showError('Failed to delete recipe.');
        this.recipeToDelete = undefined;
      },
    });
  }

  cancelDelete(): void {
    this.recipeToDelete = undefined;
  }

  onToggleFavorite(recipe: Recipe): void {
    this.userService.toggleFavoriteRecipe(recipe._id).subscribe({
      next: (res) => {
        this.favoriteRecipeIds = res.favoriteRecipes;
        this.authService.updateCurrentUser({ favoriteRecipes: res.favoriteRecipes });

        if (res.isFavorite) {
          this.recipeService.getFavoriteRecipes().subscribe((favRes) => {
            this.favoriteRecipes = (favRes.data || []).sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            );
            this.cdr.markForCheck();
          });
        } else {
          this.favoriteRecipes = this.favoriteRecipes.filter((r) => r._id !== recipe._id);
        }
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Failed to toggle favorite', err),
    });
  }

  onCopyRecipe(recipe: Recipe): void {
    this.recipeService.forkRecipe(recipe._id).subscribe({
      next: (res) => {
        this.toastService.showSuccess(`Successfully copied "${res.recipe.title}" to your library!`);
      },
      error: (err) => {
        console.error('Failed to copy recipe', err);
        this.toastService.showError('Failed to copy recipe.');
      },
    });
  }

  private calculateUserTargets(user: BackendUserDocument | null): void {
    if (!user || !user.nutritionSettings) return;

    const settings = user.nutritionSettings;
    const daily = settings.dailyMacroTargets || { calories: 0, protein: 0, netCarbs: 0, fat: 0 };
    const split = settings.mealMacroSplitPercentage || {
      calories: 80,
      protein: 80,
      netCarbs: 80,
      fat: 80,
    };
    const mealsCount = settings.dailyMealsCount || 1;
    const snacksCount = settings.dailySnacksCount || 0;

    const mealTargets = {
      calories: 0,
      protein: Math.round(((daily.protein || 0) * ((split.protein || 80) / 100)) / mealsCount),
      netCarbs: Math.round(((daily.netCarbs || 0) * ((split.netCarbs || 80) / 100)) / mealsCount),
      fat: Math.round(((daily.fat || 0) * ((split.fat || 80) / 100)) / mealsCount),
      totalCarbs: 0,
      fiber: 0,
      sugarAlcohols: 0,
    };
    mealTargets.calories = Math.round(
      mealTargets.protein * 4 + mealTargets.netCarbs * 4 + mealTargets.fat * 9,
    );

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
            calories: 0,
            protein: Math.round(
              ((daily.protein || 0) * ((100 - (split.protein || 80)) / 100)) / snacksCount,
            ),
            netCarbs: Math.round(
              ((daily.netCarbs || 0) * ((100 - (split.netCarbs || 80)) / 100)) / snacksCount,
            ),
            fat: Math.round(((daily.fat || 0) * ((100 - (split.fat || 80)) / 100)) / snacksCount),
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
}
