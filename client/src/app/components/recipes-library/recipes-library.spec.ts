import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RecipesLibrary } from './recipes-library';
import { RecipeService } from '../../services/recipe';
import { UserService } from '../../services/user';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Recipe } from '../../models/recipe.model';

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
      deleteRecipe: vi.fn(),
      getMyRecipes: vi.fn().mockReturnValue(of({ data: [] })),
      getFavoriteRecipes: vi.fn().mockReturnValue(of({ data: [] })),
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

  it('should initialize data and fetch macro targets on load', () => {
    fixture.detectChanges();

    expect(component.favoriteRecipeIds).toEqual(['recipeA']);
    expect(mockUserService.getUserProfile).toHaveBeenCalledTimes(1);
  });

  it('should safely halt all execution if user logs out (null emission)', () => {
    // Log out before the component initializes
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
});
