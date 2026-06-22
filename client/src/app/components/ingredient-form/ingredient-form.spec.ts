import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IngredientForm } from './ingredient-form';
import { IngredientService } from '../../services/ingredient';
import { ToastService } from '../../services/toast';
import { AuthService } from '../../services/auth';
import { of } from 'rxjs';

describe('IngredientForm', () => {
  let component: IngredientForm;
  let fixture: ComponentFixture<IngredientForm>;

  let mockIngredientService: {
    createIngredient: ReturnType<typeof vi.fn>;
    updateIngredient: ReturnType<typeof vi.fn>;
    getIngredientById: ReturnType<typeof vi.fn>;
  };

  let mockToastService: {
    showSuccess: ReturnType<typeof vi.fn>;
    showError: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const mockAuthService = {
      currentUser$: of({ id: 'mock-user-id' }),
      isLoggedIn: vi.fn().mockReturnValue(true),
    };

    mockIngredientService = {
      createIngredient: vi.fn().mockReturnValue(of({ success: true, message: 'Created!' })),
      updateIngredient: vi.fn().mockReturnValue(of({ success: true, message: 'Updated!' })),
      getIngredientById: vi.fn().mockReturnValue(
        of({
          data: {
            name: 'Test',
            servingSize: 100,
            nutritionPerServing: { protein: 0, fat: 0, totalCarbs: 0, fiber: 0, sugarAlcohols: 0 },
          },
        }),
      ),
    };

    mockToastService = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [IngredientForm],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: IngredientService, useValue: mockIngredientService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IngredientForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should accurately calculate Net Carbs and trap at 0', () => {
    // Standard calculation
    component.formData.nutritionPerServing = {
      protein: 0,
      fat: 0,
      totalCarbs: 20,
      fiber: 5,
      sugarAlcohols: 5,
    };
    expect(component.uiNetCarbs).toBe(10);

    // Negative trap calculation
    component.formData.nutritionPerServing = {
      protein: 0,
      fat: 0,
      totalCarbs: 10,
      fiber: 15,
      sugarAlcohols: 0,
    };
    expect(component.uiNetCarbs).toBe(0);
  });

  it('should accurately calculate and round Calories to 1 decimal point', () => {
    component.formData.nutritionPerServing = {
      protein: 2.5,
      fat: 1.1,
      totalCarbs: 5,
      fiber: 0,
      sugarAlcohols: 0,
    };
    // Protein(2.5 * 4 = 10) + Fat(1.1 * 9 = 9.9) + NetCarbs(5 * 4 = 20) = 39.9
    expect(component.uiCalories).toBe(39.9);
  });

  it('should block submission if name is empty', () => {
    component.formData.name = '   ';
    component.onSubmit();

    expect(mockToastService.showError).toHaveBeenCalledWith('Ingredient name is required.');
    expect(mockIngredientService.createIngredient).not.toHaveBeenCalled();
  });

  it('should call createIngredient when not in edit mode', () => {
    component.formData.name = 'Valid Name';
    component.isEditMode = false;

    component.onSubmit();

    expect(mockIngredientService.createIngredient).toHaveBeenCalled();
    expect(mockToastService.showSuccess).toHaveBeenCalledWith('Created!');
  });
});
