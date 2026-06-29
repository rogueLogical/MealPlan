import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RecipesLibrary } from './recipes-library';
import { RecipeService } from '../../services/recipe';
import { UserService } from '../../services/user';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Recipe, RecipePayload } from '../../models/recipe.model';

describe('RecipesLibraryComponent', () => {
  interface MockUser {
    id: string;
    favoriteRecipes?: string[];
  }
  let component: RecipesLibrary;
  let fixture: ComponentFixture<RecipesLibrary>;

  let mockAuthService: { currentUser$: Observable<MockUser | null> };
  let mockUserService: { getUserProfile: ReturnType<typeof vi.fn> };
  let mockRecipeService: {
    forkRecipe: ReturnType<typeof vi.fn>;
    deleteRecipe: ReturnType<typeof vi.fn>;
    getMyRecipes: ReturnType<typeof vi.fn>;
    getFavoriteRecipes: ReturnType<typeof vi.fn>;
    updateRecipe: ReturnType<typeof vi.fn>;
    createRecipe: ReturnType<typeof vi.fn>;
  };
  let mockToastService: {
    showSuccess: ReturnType<typeof vi.fn>;
    showError: ReturnType<typeof vi.fn>;
    showInfo: ReturnType<typeof vi.fn>;
  };

  let currentUserSubject: BehaviorSubject<MockUser | null>;

  beforeEach(async () => {
    currentUserSubject = new BehaviorSubject<MockUser | null>({
      id: 'user123',
      favoriteRecipes: ['recipeA'],
    });

    mockAuthService = { currentUser$: currentUserSubject.asObservable() };

    mockUserService = {
      getUserProfile: vi.fn().mockReturnValue(of({ user: { favoriteRecipes: [] } })),
    };

    mockRecipeService = {
      forkRecipe: vi.fn(),
      deleteRecipe: vi.fn().mockReturnValue(of({ message: 'Recipe deleted.' })),
      getMyRecipes: vi.fn().mockReturnValue(of({ data: [] })),
      getFavoriteRecipes: vi.fn().mockReturnValue(of({ data: [] })),
      updateRecipe: vi.fn().mockReturnValue(of({ message: 'Recipe Saved!' })),
      createRecipe: vi.fn().mockReturnValue(of({ message: 'Recipe created successfully!' })),
    };

    mockToastService = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showInfo: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RecipesLibrary],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserService, useValue: mockUserService },
        { provide: RecipeService, useValue: mockRecipeService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipesLibrary);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- Base Component Initialization & Utility Tests ---

  it('should initialize data and fetch macro targets on load', () => {
    fixture.detectChanges();

    expect(component.favoriteRecipeIds).toEqual(['recipeA']);
    expect(mockUserService.getUserProfile).toHaveBeenCalledTimes(1);
  });

  it('should safely halt all execution if user logs out (null emission)', () => {
    currentUserSubject.next(null);
    fixture.detectChanges();
    expect(mockUserService.getUserProfile).not.toHaveBeenCalled();
  });

  it('should display a success toast when a recipe is copied', () => {
    const mockForkRes = { recipe: { _id: 'new123', title: 'Cookie' }, message: 'Success' };

    mockRecipeService.forkRecipe.mockReturnValue(of(mockForkRes));

    component.myRecipes = [];
    component.isCopying = false;

    component.onCopyRecipe({ _id: 'old123', title: 'Cookie' } as unknown as Recipe);

    expect(mockRecipeService.forkRecipe).toHaveBeenCalledWith('old123');
    expect(component.myRecipes[0]._id).toBe('new123');
    expect(mockToastService.showSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/Successfully copied/),
    );
  });

  // --- Grid Synchronization & State Mutation Tests ---

  describe('Grid Synchronization on Recipe Modifications', () => {
    it('should sync both My Recipes and My Favorites grids when saving an edited recipe', () => {
      // Trigger ngOnInit to execute initial data fetches
      fixture.detectChanges();

      // Reset spy call counts so we only track what happens inside the save method
      mockRecipeService.getMyRecipes.mockClear();
      mockRecipeService.getFavoriteRecipes.mockClear();

      // Setup Edit Mode
      component.editingRecipeId = 'existing-recipe-id';
      const mockPayload = { title: 'Updated Recipe' } as RecipePayload;

      // Execute save action
      component.onSaveRecipeTest(mockPayload);

      expect(mockRecipeService.updateRecipe).toHaveBeenCalledWith(
        'existing-recipe-id',
        mockPayload,
      );
      expect(mockToastService.showSuccess).toHaveBeenCalledWith('Recipe Saved!');

      // Critical Assertion: Verify BOTH grids request fresh data
      expect(mockRecipeService.getMyRecipes).toHaveBeenCalledTimes(1);
      expect(mockRecipeService.getFavoriteRecipes).toHaveBeenCalledTimes(1);
    });

    it('should only sync My Recipes (and skip My Favorites) when creating a brand new recipe', () => {
      fixture.detectChanges();

      mockRecipeService.getMyRecipes.mockClear();
      mockRecipeService.getFavoriteRecipes.mockClear();

      // Setup Create Mode
      component.editingRecipeId = null;
      const mockPayload = { title: 'Brand New Recipe' } as RecipePayload;

      // Execute save action
      component.onSaveRecipeTest(mockPayload);

      expect(mockRecipeService.createRecipe).toHaveBeenCalledWith(mockPayload);
      expect(mockToastService.showSuccess).toHaveBeenCalledWith('Recipe created successfully!');

      // Critical Assertion: Verify the optimization
      // It MUST fetch My Recipes, but MUST NOT waste a call fetching Favorites
      expect(mockRecipeService.getMyRecipes).toHaveBeenCalledTimes(1);
      expect(mockRecipeService.getFavoriteRecipes).not.toHaveBeenCalled();
    });

    it('should sync both My Recipes and My Favorites grids when deleting a recipe', () => {
      fixture.detectChanges();

      mockRecipeService.getMyRecipes.mockClear();
      mockRecipeService.getFavoriteRecipes.mockClear();

      const mockRecipe = { _id: 'recipe-to-delete-123', title: 'Test Recipe' } as unknown as Recipe;

      // Trigger the modal to open
      component.onDeleteRecipe(mockRecipe);

      // Execute the actual deletion confirmation
      component.confirmDelete();

      // Assert the API was called with the ID extracted from the staged recipe
      expect(mockRecipeService.deleteRecipe).toHaveBeenCalledWith('recipe-to-delete-123');

      // Verify BOTH grids request fresh data to get the updated isDeleted flag
      expect(mockRecipeService.getMyRecipes).toHaveBeenCalledTimes(1);
      expect(mockRecipeService.getFavoriteRecipes).toHaveBeenCalledTimes(1);
    });
  });
});
