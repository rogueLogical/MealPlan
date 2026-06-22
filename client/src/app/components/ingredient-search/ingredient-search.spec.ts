import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IngredientSearch } from './ingredient-search';
import { IngredientService } from '../../services/ingredient';
import { ToastService } from '../../services/toast';
import { UserService } from '../../services/user';
import { of } from 'rxjs';

describe('IngredientSearch', () => {
  let component: IngredientSearch;
  let fixture: ComponentFixture<IngredientSearch>;

  let mockIngredientService: {
    searchIngredients: ReturnType<typeof vi.fn>;
  };

  let mockUserService: {
    getUserProfile: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockIngredientService = {
      searchIngredients: vi.fn().mockReturnValue(
        of({
          data: [{ _id: '1', name: 'Almonds' }],
          meta: { totalPages: 1, totalItems: 1 },
        }),
      ),
    };

    mockUserService = {
      // Mock a user who has 'Dairy-Free' saved in their preferences
      getUserProfile: vi.fn().mockReturnValue(
        of({
          user: { nutritionSettings: { dietaryRestrictions: ['Dairy-Free'] } },
        }),
      ),
    };

    const mockToastService = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [IngredientSearch],
      providers: [
        { provide: IngredientService, useValue: mockIngredientService },
        { provide: UserService, useValue: mockUserService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IngredientSearch);
    component = fixture.componentInstance;
    fixture.detectChanges(); // Triggers ngOnInit
  });

  it('should populate selectedTags with user preferences on init', () => {
    // Should have auto-loaded 'Dairy-Free' from the mocked UserService
    expect(component.selectedTags).toContain('Dairy-Free');

    // Should have automatically executed a search with that tag
    expect(mockIngredientService.searchIngredients).toHaveBeenCalledWith('', ['Dairy-Free'], 1, 10);
  });

  it('should add and remove tags when toggled, and reset page to 1', () => {
    // Initially contains 'Dairy-Free'

    // Toggle a new tag
    component.toggleFilterTag('Keto');
    expect(component.selectedTags).toContain('Keto');
    expect(mockIngredientService.searchIngredients).toHaveBeenCalledWith(
      '',
      ['Dairy-Free', 'Keto'],
      1,
      10,
    );

    // Toggle 'Keto' again to remove it
    component.toggleFilterTag('Keto');
    expect(component.selectedTags).not.toContain('Keto');
  });

  it('should reset search to page 1 when search query changes', () => {
    component.currentPage = 3;
    component.searchQuery = 'Beef';

    component.onSearchChange();

    expect(component.currentPage).toBe(1);
    expect(mockIngredientService.searchIngredients).toHaveBeenCalledWith(
      'Beef',
      ['Dairy-Free'],
      1,
      10,
    );
  });
});
