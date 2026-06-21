import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IngredientForm } from './ingredient-form';
import { IngredientService } from '../../services/ingredient';
import { ToastService } from '../../services/toast';
import { AuthService } from '../../services/auth';
import { of } from 'rxjs';

describe('IngredientForm', () => {
  let component: IngredientForm;
  let fixture: ComponentFixture<IngredientForm>;

  beforeEach(async () => {
    const mockAuthService = {
      currentUser$: of({ id: 'mock-user-id' }),
      isLoggedIn: vi.fn().mockReturnValue(true),
    };

    const mockIngredientService = {
      createIngredient: vi.fn().mockReturnValue(of({ success: true })),
      updateIngredient: vi.fn().mockReturnValue(of({ success: true })),
      getIngredientById: vi.fn().mockReturnValue(
        of({
          data: {
            name: '',
            servingSize: 100,
            nutritionPerServing: { protein: 0, fat: 0, totalCarbs: 0, fiber: 0, sugarAlcohols: 0 },
          },
        }),
      ),
    };

    const mockToastService = {
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

    // 3. Trigger initial data binding
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
