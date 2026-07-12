import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  OnDestroy,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Recipe, UserMacroTargets } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe';
import { RecipeCard } from '../recipe-card/recipe-card';

@Component({
  selector: 'app-recipe-search',
  standalone: true,
  templateUrl: './recipe-search.html',
  imports: [CommonModule, RecipeCard],
  styleUrls: ['./recipe-search.scss'],
})
export class RecipeSearch implements OnInit, OnDestroy {
  @Input() favoriteRecipeIds: string[] = [];
  @Input() targetMacros?: UserMacroTargets;

  @Output() closeSearch = new EventEmitter<void>();
  @Output() view = new EventEmitter<Recipe>();
  @Output() toggleFavorite = new EventEmitter<Recipe>();
  @Output() copyRecipe = new EventEmitter<Recipe>();

  searchResults: Recipe[] = [];
  isLoading = false;
  hasSearched = false;

  searchQuery = '';

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

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private cdr = inject(ChangeDetectorRef);
  private recipeService = inject(RecipeService);

  ngOnInit(): void {
    // Setup debounced listener for text input only
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe((term) => {
        this.searchQuery = term;
        this.executeSearch(1); // Reset to page 1 on new text searches
      });

    // Trigger an initial empty search
    this.executeSearch(1);
  }

  executeSearch(page = 1): void {
    this.currentPage = page;
    this.isLoading = true;
    this.hasSearched = true;

    this.cdr.markForCheck();

    // Fetch 12 items per page
    this.recipeService
      .searchPublicRecipes(this.searchQuery, this.selectedTags, this.currentPage, 12)
      .subscribe({
        next: (res) => {
          this.searchResults = res.data || [];
          this.totalPages = res.meta?.totalPages || 1;
          this.totalItems = res.meta?.totalItems || 0;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Search failed', err);
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  toggleFilterTag(tag: string): void {
    const index = this.selectedTags.indexOf(tag);
    if (index > -1) {
      this.selectedTags.splice(index, 1); // Remove if already selected
    } else {
      this.selectedTags.push(tag); // Add if not selected
    }
    this.executeSearch(1); // Reset to page 1 on filter changes
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchSubject.next(target.value);
  }

  onClose(): void {
    this.closeSearch.emit();
  }
}
