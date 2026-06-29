import { Component, EventEmitter, OnInit, Output, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Ingredient } from '../../models/ingredient.model';
import { IngredientService } from '../../services/ingredient';
import { ToastService } from '../../services/toast';
import { IngredientForm } from '../ingredient-form/ingredient-form';
import { UserService } from '../../services/user';

@Component({
  selector: 'app-ingredient-search',
  standalone: true,
  imports: [CommonModule, FormsModule, IngredientForm],
  templateUrl: './ingredient-search.html',
  styleUrls: ['./ingredient-search.scss'],
})
export class IngredientSearch implements OnInit {
  @Output() ingredientSelected = new EventEmitter<Ingredient>();
  @Output() closeForm = new EventEmitter<void>();

  searchQuery = '';
  results: Ingredient[] = [];

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
  selectedTags: string[] = [];

  // Pagination State
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;

  // Form Modal State
  showFormModal = false;
  editingIngredientId: string | null = null;

  private ingredientService = inject(IngredientService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private userService = inject(UserService);

  ngOnInit(): void {
    this.userService.getUserProfile().subscribe({
      next: (response) => {
        const restrictions = response.user?.nutritionSettings?.dietaryRestrictions || [];

        // Pre-populate the selectedTags array with the user's saved restrictions
        // Filter against availableTags just in case an old tag got deprecated
        this.selectedTags = restrictions.filter((tag) => this.availableTags.includes(tag));

        // Fire the initial search now that the filters are loaded
        this.executeSearch();
      },
      error: (err) => {
        console.error('Failed to load user preferences for search filters:', err);
        // Fallback: If the fetch fails for some reason, just run a blank search anyway
        this.executeSearch();
      },
    });
  }

  executeSearch(page = 1): void {
    this.currentPage = page;
    this.ingredientService
      .searchIngredients(this.searchQuery, this.selectedTags, this.currentPage, 10)
      .subscribe({
        next: (res) => {
          this.results = res.data;
          this.totalPages = res.meta.totalPages;
          this.totalItems = res.meta.totalItems;
          this.cdr.markForCheck();
        },
        error: () => {
          this.toastService.showError('Failed to load ingredients.');
          this.cdr.markForCheck();
        },
      });
  }

  toggleFilterTag(tag: string): void {
    const index = this.selectedTags.indexOf(tag);
    if (index > -1) {
      // Remove it if it's already selected
      this.selectedTags.splice(index, 1);
    } else {
      // Add it to the filter list
      this.selectedTags.push(tag);
    }
    // Execute a fresh search from page 1 whenever filters change
    this.executeSearch(1);
  }

  onSearchChange(): void {
    // Reset to page 1 when query changes
    this.executeSearch(1);
  }

  selectIngredient(ingredient: Ingredient): void {
    this.ingredientSelected.emit(ingredient);
  }

  openCreateForm(): void {
    this.editingIngredientId = null;
    this.showFormModal = true;
  }

  openEditForm(id: string, event: Event): void {
    event.stopPropagation(); // Prevent the click from triggering 'selectIngredient'
    this.editingIngredientId = id;
    this.showFormModal = true;
  }

  onFormClosed(): void {
    this.showFormModal = false;
    this.executeSearch(this.currentPage); // Refresh current page to reflect changes/deletions
  }

  onFormSaved(): void {
    this.showFormModal = false;
    this.executeSearch(this.currentPage); // Refresh to show new/updated ingredient
  }

  closeSearch(): void {
    this.closeForm.emit();
  }
}
