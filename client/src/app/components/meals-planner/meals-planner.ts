import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MealPrepService, MealPrepPlan, PlannedRecipe } from '../../services/meal-prep';
import { RecipeService } from '../../services/recipe';
import { Recipe } from '../../models/recipe.model';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-meals-planner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meals-planner.html',
  styleUrls: ['./meals-planner.scss'],
})
export class MealsPlanner implements OnInit {
  private prepService = inject(MealPrepService);
  private recipeService = inject(RecipeService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  allPlans: MealPrepPlan[] = [];
  activePlan: MealPrepPlan | null = null;
  userRecipes: Recipe[] = [];
  isLoading = true;

  // Plan creation/editing states
  isCreating = false;
  editingPlanId: string | null = null;
  planName = '';
  setAsActiveOnSave = false;
  selectedRecipes: { recipe: Recipe; plannedPortions: number; isSelected: boolean }[] = [];

  // Recipe detail scaling view
  viewingPlannedRecipe: { recipe: Recipe; multiplier: number } | null = null;

  // Dialog completion overlay states
  showCompletionDialog = false;
  recipeIdToComplete: string | null = null;
  recipeTitleToComplete = '';
  completionPortions = 0;

  // Dialog confirmation overlays
  showResetConfirmDialog = false;
  showDeactivateConfirmDialog = false;
  showDeleteConfirmDialog = false;
  planIdToDelete: string | null = null;
  planNameToDelete = '';

  ngOnInit(): void {
    this.loadData();
  }

  get selectedPlanRecipes() {
    return this.selectedRecipes
      .filter((item) => item.isSelected)
      .sort((a, b) => a.recipe.title.localeCompare(b.recipe.title));
  }

  get unselectedPlanRecipes() {
    return this.selectedRecipes
      .filter((item) => !item.isSelected)
      .sort((a, b) => a.recipe.title.localeCompare(b.recipe.title));
  }

  getRecipeTitle(recipeId: string | Recipe): string {
    if (typeof recipeId === 'object' && recipeId !== null && 'title' in recipeId) {
      return recipeId.title;
    }
    const resolved = this.userRecipes.find((r) => r._id === recipeId);
    return resolved ? resolved.title : 'Unknown Recipe';
  }

  getRecipeId(recipeId: string | Recipe): string {
    if (typeof recipeId === 'object' && recipeId !== null && '_id' in recipeId) {
      return recipeId._id;
    }
    return recipeId as string;
  }

  loadData(): void {
    this.isLoading = true;
    this.prepService.getAllPlans().subscribe({
      next: (res) => {
        this.allPlans = res.plans;
        // Identify the active plan (if one exists)
        this.activePlan = res.plans.find((p) => p.isActive) || null;
        this.loadRecipes();
      },
      error: () => {
        this.toastService.showError('Failed to load meal prep plans.');
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  loadRecipes(): void {
    this.recipeService.getMyRecipes().subscribe({
      next: (res) => {
        this.userRecipes = res.data;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toastService.showError('Failed to load recipes.');
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  initiatePlanCreation(): void {
    this.editingPlanId = null;
    this.planName = '';
    this.setAsActiveOnSave = false;
    this.selectedRecipes = this.userRecipes.map((recipe) => ({
      recipe,
      plannedPortions: recipe.portions || 1,
      isSelected: false,
    }));
    this.isCreating = true;
    this.cdr.markForCheck();
  }

  initiatePlanEditing(plan: MealPrepPlan): void {
    if (!plan._id) return;
    this.editingPlanId = plan._id;
    this.planName = plan.name;
    this.setAsActiveOnSave = plan.isActive;

    this.selectedRecipes = this.userRecipes.map((recipe) => {
      // Find matching mapped reference in the plan
      const planned = plan.recipes.find((pr) => {
        const id = this.getRecipeId(pr.recipeId);
        return id === recipe._id;
      });

      return {
        recipe,
        plannedPortions: planned ? planned.plannedPortions : recipe.portions || 1,
        isSelected: !!planned,
      };
    });

    this.isCreating = true;
    this.cdr.markForCheck();
  }

  cancelPlan(): void {
    this.isCreating = false;
    this.editingPlanId = null;
  }

  savePlan(): void {
    const chosenRecipes = this.selectedRecipes
      .filter((sr) => sr.isSelected)
      .map((sr) => ({ recipeId: sr.recipe._id, plannedPortions: sr.plannedPortions }));

    if (chosenRecipes.length === 0) {
      this.toastService.showError('Select at least one recipe to include in your plan.');
      return;
    }

    if (this.editingPlanId) {
      // Edit Mode
      const formattedRecipes = chosenRecipes.map((r) => ({
        recipeId: r.recipeId,
        plannedPortions: r.plannedPortions,
        isCompleted: false,
      }));

      this.prepService
        .updatePlan(this.editingPlanId, this.planName, formattedRecipes, this.setAsActiveOnSave)
        .subscribe({
          next: () => {
            this.toastService.showSuccess('Meal Prep Plan updated.');
            this.isCreating = false;
            this.editingPlanId = null;
            this.loadData();
          },
          error: (err) => {
            console.error('Update Plan Error', err);
            this.toastService.showError('Failed to update meal prep plan.');
          },
        });
    } else {
      // Create Mode
      this.prepService.createPlan(this.planName, chosenRecipes, this.setAsActiveOnSave).subscribe({
        next: () => {
          this.toastService.showSuccess('Meal Prep Plan created.');
          this.isCreating = false;
          this.loadData();
        },
        error: (err) => {
          console.error('Create Plan Error', err);
          this.toastService.showError('Failed to create meal prep plan.');
        },
      });
    }
  }

  // Feature 1.7.2: Append scaled ingredient requirements directly to shopping list
  appendPlanIngredientsToList(plan: MealPrepPlan): void {
    if (!plan._id) return;

    this.prepService.appendPlanToShoppingList(plan._id).subscribe({
      next: () => {
        this.toastService.showSuccess(
          `Plan ingredients appended to your Shopping List successfully.`,
        );
      },
      error: (err) => {
        console.error('Append Plan to List Error', err);
        this.toastService.showError('Failed to append ingredients to shopping list.');
      },
    });
  }

  // Dynamic Activations
  activatePlan(plan: MealPrepPlan): void {
    if (!plan._id) return;

    this.prepService.activatePlan(plan._id).subscribe({
      next: () => {
        this.toastService.showSuccess(
          `"${plan.name}" set as active plan. Progress checklist reset.`,
        );
        this.loadData();
      },
      error: (err) => {
        console.error('Activate Plan Error', err);
        this.toastService.showError('Failed to activate plan.');
      },
    });
  }

  // De-activation Confirms
  openDeactivateDialog(): void {
    this.showDeactivateConfirmDialog = true;
  }

  closeDeactivateDialog(): void {
    this.showDeactivateConfirmDialog = false;
  }

  confirmDeactivatePlan(): void {
    if (!this.activePlan?._id) return;

    this.prepService.deactivatePlan(this.activePlan._id).subscribe({
      next: () => {
        this.toastService.showSuccess('Active plan deactivated.');
        this.closeDeactivateDialog();
        this.loadData();
      },
      error: (err) => {
        console.error('Deactivate Plan Error', err);
        this.toastService.showError('Failed to deactivate plan.');
        this.closeDeactivateDialog();
      },
    });
  }

  // Active Progress Resets
  openResetDialog(): void {
    this.showResetConfirmDialog = true;
  }

  closeResetDialog(): void {
    this.showResetConfirmDialog = false;
  }

  confirmResetActivePlan(): void {
    if (!this.activePlan?._id) return;

    this.prepService.restartPlan(this.activePlan._id).subscribe({
      next: () => {
        this.toastService.showSuccess('Prep progress checklist reset successfully.');
        this.closeResetDialog();
        this.loadData();
      },
      error: (err) => {
        console.error('Reset Progress Error', err);
        this.toastService.showError('Failed to reset plan progress.');
        this.closeResetDialog();
      },
    });
  }

  // Plan Deletions
  openDeleteDialog(plan: MealPrepPlan): void {
    if (!plan._id) return;
    this.planIdToDelete = plan._id;
    this.planNameToDelete = plan.name;
    this.showDeleteConfirmDialog = true;
    this.cdr.markForCheck();
  }

  closeDeleteDialog(): void {
    this.showDeleteConfirmDialog = false;
    this.planIdToDelete = null;
    this.planNameToDelete = '';
  }

  confirmDeletePlan(): void {
    if (!this.planIdToDelete) return;

    this.prepService.deletePlan(this.planIdToDelete).subscribe({
      next: () => {
        this.toastService.showSuccess(`Deleted plan "${this.planNameToDelete}".`);
        this.closeDeleteDialog();
        this.loadData();
      },
      error: (err) => {
        console.error('Delete Plan Error', err);
        this.toastService.showError(err.error?.message || 'Failed to delete plan.');
        this.closeDeleteDialog();
      },
    });
  }

  // Feature 1.7.5: Open planned recipe scaling modal
  viewPlannedRecipe(pr: PlannedRecipe): void {
    const fullRecipe =
      typeof pr.recipeId === 'object' && pr.recipeId !== null
        ? (pr.recipeId as Recipe)
        : this.userRecipes.find((r) => r._id === pr.recipeId);
    if (!fullRecipe) return;

    this.viewingPlannedRecipe = {
      recipe: fullRecipe,
      multiplier: pr.plannedPortions / (fullRecipe.portions || 1),
    };
  }

  closePlannedRecipe(): void {
    this.viewingPlannedRecipe = null;
  }

  // Portions completions dialog
  initiateRecipeCompletion(recipeId: string, recipeTitle: string, defaultPortions: number): void {
    this.recipeIdToComplete = recipeId;
    this.recipeTitleToComplete = recipeTitle;
    this.completionPortions = defaultPortions;
    this.showCompletionDialog = true;
    this.cdr.markForCheck();
  }

  closeCompletionDialog(): void {
    this.showCompletionDialog = false;
    this.recipeIdToComplete = null;
    this.recipeTitleToComplete = '';
  }

  confirmRecipeCompletion(skipStorage = false): void {
    if (!this.activePlan?._id || !this.recipeIdToComplete) return;

    const finalPortions = skipStorage ? 0 : this.completionPortions;

    this.prepService
      .completePlannedRecipe(this.activePlan._id, this.recipeIdToComplete, finalPortions)
      .subscribe({
        next: () => {
          if (skipStorage) {
            this.toastService.showSuccess(`"${this.recipeTitleToComplete}" marked cooked in plan.`);
          } else {
            this.toastService.showSuccess(
              `Logged ${finalPortions} portions of "${this.recipeTitleToComplete}" to storage.`,
            );
          }
          this.closeCompletionDialog();
          this.loadData();
        },
        error: (err) => {
          console.error('Complete Recipe Error', err);
          this.toastService.showError('Failed to record completion.');
          this.closeCompletionDialog();
          this.cdr.markForCheck();
        },
      });
  }
}
