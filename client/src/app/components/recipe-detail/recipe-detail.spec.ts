import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeDetail } from './recipe-detail';
import { AuthService } from '../../services/auth';
import { of } from 'rxjs';
import { Recipe } from '../../models/recipe.model';

describe('RecipeDetail', () => {
  let component: RecipeDetail;
  let fixture: ComponentFixture<RecipeDetail>;
  let mockRecipe: Recipe;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeDetail],
      providers: [
        {
          provide: AuthService,
          useValue: { currentUser$: of(null) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeDetail);
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
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
