import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecipeCard } from './recipe-card';
import { Recipe } from '../../models/recipe.model';
import { AuthService } from '../../services/auth';
import { of } from 'rxjs';

describe('RecipeCard', () => {
  let component: RecipeCard;
  let fixture: ComponentFixture<RecipeCard>;
  let mockRecipe: Recipe;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeCard],
      providers: [
        {
          provide: AuthService,
          useValue: { currentUser$: of(null) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeCard);
    component = fixture.componentInstance;

    mockRecipe = {
      _id: 'recipe123',
      title: 'Test Chocolate Cookies',
      recipeType: 'Snack',
      createdBy: 'user456',
      portions: 10,
      isPublic: true,
      ingredients: [],
      totalNutrition: { calories: 200, protein: 5, carbs: 20, fat: 10 },
    } as unknown as Recipe;

    component.recipe = mockRecipe;
    component.isFavorite = false;
    fixture.detectChanges();
  });

  it('should render the recipe title in the template', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const titleElement = compiled.querySelector('h3');
    expect(titleElement?.textContent).toContain('Test Chocolate Cookies');
  });

  it('should emit copyRecipe event when the copy button is clicked', () => {
    vi.spyOn(component.copyRecipe, 'emit');

    const mockEvent = new Event('click');

    component.onCopyClicked(mockEvent);
    expect(component.copyRecipe.emit).toHaveBeenCalledWith(mockRecipe);
  });

  it('should emit toggleFavorite event when star is clicked', () => {
    vi.spyOn(component.toggleFavorite, 'emit');

    const mockEvent = new Event('click');
    component.onFavoriteClicked(mockEvent);

    expect(component.toggleFavorite.emit).toHaveBeenCalledWith(mockRecipe);
  });
});
