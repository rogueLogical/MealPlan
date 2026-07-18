import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PortionStorage } from './portion-storage';
import { MealPrepService, PortionStorageItem } from '../../services/meal-prep';
import { ToastService } from '../../services/toast';

describe('PortionStorage Component In-Depth Coverage', () => {
  let component: PortionStorage;
  let fixture: ComponentFixture<PortionStorage>;

  // Declared as Partial<T> to strictly avoid using any any-type warnings
  let mockPrepService: Partial<MealPrepService>;
  let mockToastService: Partial<ToastService>;

  const mockStorageList: PortionStorageItem[] = [
    { recipeId: 'rec1', recipeTitle: 'Avocado Toast', portionsInStorage: 4 },
    { recipeId: 'rec2', recipeTitle: 'Greek Salad', portionsInStorage: 0 }, // Should be filtered out on init
  ];

  beforeEach(async () => {
    mockPrepService = {
      getPortionStorage: vi.fn().mockReturnValue(of({ storage: mockStorageList })),
      adjustPortionStorage: vi.fn().mockReturnValue(of({ message: 'Success' })),
    };

    mockToastService = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PortionStorage],
      providers: [
        { provide: MealPrepService, useValue: mockPrepService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PortionStorage);
    component = fixture.componentInstance;
  });

  it('should initialize and load stored portions (filtering out <= 0 counts)', () => {
    fixture.detectChanges(); // First change detection run (triggers ngOnInit)

    expect(component.isLoading).toBe(false);
    // Greek Salad (0 portions) should be filtered out
    expect(component.storageList).toHaveLength(1);
    expect(component.storageList[0].recipeTitle).toBe('Avocado Toast');
    expect(mockPrepService.getPortionStorage).toHaveBeenCalled();
  });

  it('should handle fetch storage failures gracefully with error toast', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
    mockPrepService.getPortionStorage = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('DB Error')));

    fixture.detectChanges();

    expect(component.isLoading).toBe(false);
    expect(mockToastService.showError).toHaveBeenCalledWith('Failed to load portion storage.');
  });

  it('should successfully record eating a portion, trigger a silent reload, and show success toast', () => {
    fixture.detectChanges();

    const targetItem: PortionStorageItem = {
      recipeId: 'rec1',
      recipeTitle: 'Avocado Toast',
      portionsInStorage: 4,
    };

    component.recordConsumption(targetItem);

    expect(mockPrepService.adjustPortionStorage).toHaveBeenCalledWith('rec1', 'Avocado Toast', -1);
    expect(mockToastService.showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('recorded as eaten'),
    );
  });

  it('should handle record eating errors gracefully', () => {
    fixture.detectChanges();
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
    mockPrepService.adjustPortionStorage = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('API down')));

    const targetItem: PortionStorageItem = {
      recipeId: 'rec1',
      recipeTitle: 'Avocado Toast',
      portionsInStorage: 4,
    };

    component.recordConsumption(targetItem);

    expect(mockToastService.showError).toHaveBeenCalledWith('Failed to record consumption.');
  });

  // HTML Render / DOM Testing
  it('should display loading text when isLoading is true', () => {
    // Spy on loadStorage to prevent ngOnInit from resetting isLoading to false
    vi.spyOn(component, 'loadStorage').mockImplementation(() => {
      /* noop */
    });
    component.isLoading = true;

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.loading-state')).toBeTruthy();
    expect(compiled.textContent).toContain('Loading stored portions');
  });

  it('should display empty state when storage list has no active items', () => {
    // Stub to load empty array
    mockPrepService.getPortionStorage = vi.fn().mockReturnValue(of({ storage: [] }));

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state')).toBeTruthy();
    expect(compiled.textContent).toContain('Your storage is empty');
  });

  it('should display storage cards when active portions are present', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.storage-grid')).toBeTruthy();
    expect(compiled.querySelector('.storage-card')).toBeTruthy();
    expect(compiled.textContent).toContain('Avocado Toast');
    expect(compiled.textContent).toContain('4');
  });
});
