import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecipeGenerator } from './recipe-generator';
import { RecipeService } from '../../services/recipe';
import { UserService } from '../../services/user';
import { ToastService } from '../../services/toast';
import { of, throwError } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('RecipeGenerator Component Unit Tests', () => {
  let component: RecipeGenerator;
  let fixture: ComponentFixture<RecipeGenerator>;

  let mockRecipeService: Partial<RecipeService>;
  let mockUserService: Partial<UserService>;
  let mockToastService: Partial<ToastService>;

  beforeEach(async () => {
    mockRecipeService = {
      generateRecipe: vi
        .fn()
        .mockReturnValue(of({ title: 'AI Chicken Rice Bowl', ingredients: [] })),
    };

    mockUserService = {
      getUserProfile: vi.fn().mockReturnValue(
        of({
          user: { nutritionSettings: { dietaryRestrictions: ['Vegan', 'Gluten-Free'] } },
        }),
      ),
    };

    mockToastService = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RecipeGenerator, FormsModule],
      providers: [
        { provide: RecipeService, useValue: mockRecipeService },
        { provide: UserService, useValue: mockUserService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeGenerator);
    component = fixture.componentInstance;
  });

  it('should initialize and pre-populate dietary restrictions from user profile settings', () => {
    fixture.detectChanges(); // Triggers ngOnInit

    expect(component.dietaryRestrictions).toContain('Vegan');
    expect(component.dietaryRestrictions).toContain('Gluten-Free');
    expect(mockUserService.getUserProfile).toHaveBeenCalled();
  });

  it('should toggle restriction checkbox filters correctly', () => {
    fixture.detectChanges();

    // Check Keto
    component.toggleRestriction('Keto');
    expect(component.dietaryRestrictions).toContain('Keto');

    // Uncheck Vegan
    component.toggleRestriction('Vegan');
    expect(component.dietaryRestrictions).not.toContain('Vegan');
  });

  it('should block execution and toast error on empty description prompt', () => {
    fixture.detectChanges();
    component.description = '   ';
    component.generateRecipe();

    expect(mockToastService.showError).toHaveBeenCalledWith(expect.stringContaining('describe'));
    expect(mockRecipeService.generateRecipe).not.toHaveBeenCalled();
  });

  it('should toggle loading animation state during active API transactions', () => {
    fixture.detectChanges();
    component.description = 'Chipotle Chicken Bowl';

    vi.spyOn(component.recipeGenerated, 'emit');

    component.generateRecipe();

    expect(component.isGenerating).toBe(false); // Cleared back to false upon successful response
    expect(component.recipeGenerated.emit).toHaveBeenCalled();
    expect(mockToastService.showSuccess).toHaveBeenCalled();
  });

  it('should safely reset loading animations on generation errors', () => {
    fixture.detectChanges();
    component.description = 'Gourmet Steak';
    mockRecipeService.generateRecipe = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('API Timeout')));

    component.generateRecipe();

    expect(component.isGenerating).toBe(false); // Resets loading state so user can re-try
    expect(mockToastService.showError).toHaveBeenCalled();
  });
});
