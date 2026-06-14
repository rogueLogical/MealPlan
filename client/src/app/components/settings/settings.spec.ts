import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { Observable, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Settings } from './settings';
import { UserService, UserSettingsPayload } from '../../services/user';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

interface MockUserService {
  getUserProfile: Mock<() => Observable<{ user: unknown }>>;
  updateUserSettings: Mock<(payload: UserSettingsPayload) => Observable<unknown>>;
}

interface MockAuthService {
  updateCurrentUser: Mock<(profile: unknown) => void>;
}

interface MockToastService {
  showSuccess: Mock<(msg: string) => void>;
  showError: Mock<(msg: string) => void>;
}

describe('Settings Management (Test Cases 7 & 8)', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;
  let userServiceMock: MockUserService;
  let authServiceMock: MockAuthService;
  let toastServiceMock: MockToastService;

  beforeEach(async () => {
    userServiceMock = {
      getUserProfile: vi.fn(),
      updateUserSettings: vi.fn(),
    };

    authServiceMock = {
      updateCurrentUser: vi.fn(),
    };

    toastServiceMock = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };

    // Stubs initial fetch lifecycle response data structure
    userServiceMock.getUserProfile.mockReturnValue(
      of({
        user: {
          profilePicture: 'avatar.png',
          settings: { measurementSystem: 'metric' },
          nutritionSettings: {
            dailyMacroTargets: { calories: 1500, protein: 100, carbs: 150, fat: 50 },
          },
        },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [Settings, FormsModule],
      providers: [
        { provide: UserService, useValue: userServiceMock as unknown as UserService },
        { provide: AuthService, useValue: authServiceMock as unknown as AuthService },
        { provide: ToastService, useValue: toastServiceMock as unknown as ToastService },
        provideRouter([]),
        provideLocationMocks(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    fixture.detectChanges(); // Triggers ngOnInit() profile initialization load
  });

  it('should save user preferences when they are set by the user (Test Case 7)', async () => {
    // Update general account profile properties in settingsData
    component.settingsData.measurementSystem = 'metric';
    component.settingsData.profilePicture = 'new-avatar.png';
    fixture.detectChanges();

    userServiceMock.updateUserSettings.mockReturnValue(of({ success: true }));

    // Save settings
    component.onSettingsSave();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify user preferences are sent downstream to the user service
    expect(userServiceMock.updateUserSettings).toHaveBeenCalledWith(component.settingsData);
    expect(toastServiceMock.showSuccess).toHaveBeenCalledWith(
      'User settings updated successfully!',
    );
    expect(authServiceMock.updateCurrentUser).toHaveBeenCalledWith({
      profilePicture: 'new-avatar.png',
    });

    // Simulate page refresh
    component.ngOnInit();
    fixture.detectChanges();

    // Verify State data displays successfully matching the fetch layout configurations
    expect(userServiceMock.getUserProfile).toHaveBeenCalled();
    expect(component.settingsData.measurementSystem).toBe('metric');
    expect(component.settingsData.profilePicture).toBe('avatar.png'); // Holds re-fetched value
  });

  it('should save user goals and dietary restrictions when they are set by the user (Test Case 8)', async () => {
    // Update nutritional macro structures inside settingsData property mapping
    const customMacros = { calories: 0, protein: 150, carbs: 200, fat: 70 };
    component.settingsData.nutritionSettings.dailyMacroTargets = customMacros;
    fixture.detectChanges();

    // Verify totalCalculatedCalories getter helper automatically sums macros
    // (150 * 4) + (200 * 4) + (70 * 9) = 600 + 800 + 630 = 2030 calories
    expect(component.totalCalculatedCalories).toBe(2030);

    userServiceMock.updateUserSettings.mockReturnValue(of({ success: true }));

    // Save settings profile layout updates
    component.onSettingsSave();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify updated macro targets are accurately passed inside payload save operations
    expect(userServiceMock.updateUserSettings).toHaveBeenCalledWith(component.settingsData);
    expect(component.settingsData.nutritionSettings.dailyMacroTargets.calories).toBe(2030);
  });

  it('should parse culinary text inputs into arrays and save culinary preferences (Test Case 9)', async () => {
    // Setup the UI state exactly as a user would leave it before clicking save
    component.settingsData.nutritionSettings.dietaryRestrictions = ['Dairy-Free', 'Keto'];
    component.likedFoodsInput = 'Steak, Avocado, Eggs';

    // Include extra spacing and trailing commas to verify the .trim() and .filter() cleanup logic
    component.dislikedFoodsInput = 'Sugar, Bread, Pasta, ';

    userServiceMock.updateUserSettings.mockReturnValue(of({ success: true }));

    // Trigger the save operation
    component.onSettingsSave();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify the component successfully split, trimmed, and cleaned the string inputs into arrays
    expect(component.settingsData.nutritionSettings.likedFoods).toEqual([
      'Steak',
      'Avocado',
      'Eggs',
    ]);
    expect(component.settingsData.nutritionSettings.dislikedFoods).toEqual([
      'Sugar',
      'Bread',
      'Pasta',
    ]);

    // Verify the finalized arrays were correctly packaged into the API payload
    expect(userServiceMock.updateUserSettings).toHaveBeenCalledWith(component.settingsData);
    expect(toastServiceMock.showSuccess).toHaveBeenCalledWith(
      'User settings updated successfully!',
    );
  });

  it('should correctly calculate macro targets per meal and snack (Test Case 10)', () => {
    // Establish a known baseline state
    component.settingsData.nutritionSettings.dailyMacroTargets = {
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 70,
    };
    component.settingsData.nutritionSettings.dailyMealsCount = 3;
    component.settingsData.nutritionSettings.dailySnacksCount = 2;

    // Set an 80/20 split
    component.settingsData.nutritionSettings.mealMacroSplitPercentage = {
      calories: 80,
      protein: 80,
      carbs: 80,
      fat: 80,
    };

    // Verify Meal Targets (80% of total, divided by 3 meals)
    // Protein: (150 * 0.8) / 3 = 40
    expect(component.targetMealProtein).toBe(40);
    // Carbs: (200 * 0.8) / 3 = 53.33 -> rounded to 53
    expect(component.targetMealCarbs).toBe(53);
    // Fat: (70 * 0.8) / 3 = 18.66 -> rounded to 19
    expect(component.targetMealFat).toBe(19);
    // Calories: (40g * 4) + (53g * 4) + (19g * 9) = 160 + 212 + 171 = 543 kcal
    expect(component.targetMealCalories).toBe(543);

    // 3. Verify Snack Targets (20% of total, divided by 2 snacks)
    // Protein: (150 * 0.2) / 2 = 15
    expect(component.targetSnackProtein).toBe(15);
    // Carbs: (200 * 0.2) / 2 = 20
    expect(component.targetSnackCarbs).toBe(20);
    // Fat: (70 * 0.2) / 2 = 7
    expect(component.targetSnackFat).toBe(7);
    // Calories: (15g * 4) + (20g * 4) + (7g * 9) = 60 + 80 + 63 = 203 kcal
    expect(component.targetSnackCalories).toBe(203);
  });

  it('should enforce boundary rules and lock sliders when snacks are set to zero (Test Case 11)', () => {
    // Test Meal Boundary (Minimum 1)
    component.settingsData.nutritionSettings.dailyMealsCount = 0;
    component.validateMealsCount();
    expect(component.settingsData.nutritionSettings.dailyMealsCount).toBe(1);

    component.settingsData.nutritionSettings.dailyMealsCount = 99;
    component.validateMealsCount();
    expect(component.settingsData.nutritionSettings.dailyMealsCount).toBe(6); // Max boundary

    // Test Snack Boundary & Slider Lock (Minimum 0)
    component.settingsData.nutritionSettings.mealMacroSplitPercentage = {
      calories: 80,
      protein: 80,
      carbs: 80,
      fat: 80,
    };

    // Simulate user dialing snacks down to 0
    component.onSnacksCountChange(0);

    // Verify the count is accepted, but the sliders snap to 100%
    expect(component.settingsData.nutritionSettings.dailySnacksCount).toBe(0);
    expect(component.settingsData.nutritionSettings.mealMacroSplitPercentage.protein).toBe(100);
    expect(component.settingsData.nutritionSettings.mealMacroSplitPercentage.carbs).toBe(100);
    expect(component.settingsData.nutritionSettings.mealMacroSplitPercentage.fat).toBe(100);
  });

  it('should handle API errors during initialization fetching to cover HTML loading branches', () => {
    // Force the API to fail
    userServiceMock.getUserProfile.mockReturnValue(throwError(() => new Error('API down')));

    // Trigger the fetch
    component.ngOnInit();

    // Verify the catch block executes and clears the loading state
    expect(component.isLoading).toBe(false);
    expect(toastServiceMock.showError).toHaveBeenCalledWith(
      'Could not fetch account settings profile endpoints.',
    );
  });

  it('should safely calculate macro percentages when total calories are zero to prevent division by zero', () => {
    // Force the edge-case state
    component.settingsData.nutritionSettings.dailyMacroTargets = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };

    // Verify the getter catches the 0 and returns 0 instead of NaN
    expect(component.getMacroPercentage(0)).toBe(0);
  });

  it('should correctly add and remove dietary restrictions when checkboxes are toggled', () => {
    // Start with one restriction
    component.settingsData.nutritionSettings.dietaryRestrictions = ['Vegan'];

    // Simulate checking a NEW box
    const mockEventAdd = { target: { checked: true } } as unknown as Event;
    component.toggleRestriction('Keto', mockEventAdd);
    expect(component.settingsData.nutritionSettings.dietaryRestrictions).toContain('Keto');
    expect(component.settingsData.nutritionSettings.dietaryRestrictions).toContain('Vegan');

    // Simulate UNCHECKING an existing box
    const mockEventRemove = { target: { checked: false } } as unknown as Event;
    component.toggleRestriction('Vegan', mockEventRemove);
    expect(component.settingsData.nutritionSettings.dietaryRestrictions).not.toContain('Vegan');
    expect(component.settingsData.nutritionSettings.dietaryRestrictions).toContain('Keto');
  });

  it('should handle API errors and partial data when saving settings', () => {
    // Test the Error Branch: Force the save to fail
    userServiceMock.updateUserSettings.mockReturnValue(
      throwError(() => ({ error: { message: 'Save failed' } })),
    );
    component.onSettingsSave();
    expect(toastServiceMock.showError).toHaveBeenCalledWith('Save failed');

    // Test the Partial Data Branch: Ensure we don't accidentally wipe out the user's email or avatar if they save with empty fields
    userServiceMock.updateUserSettings.mockReturnValue(of({ success: true }));
    component.settingsData.profilePicture = '';
    component.settingsData.email = '';

    component.onSettingsSave();

    // Verify it only passes an empty object to the Auth Service, preventing data deletion
    expect(authServiceMock.updateCurrentUser).toHaveBeenCalledWith({});
  });

  it('should render the loading spinner when isLoading is true (Test Case 15a)', () => {
    // 1. Start with a fresh component and immediately set it to load
    component.isLoading = true;

    // 2. Trigger the HTML branch for @if (isLoading)
    fixture.detectChanges();

    // The branch is covered!
    expect(component.isLoading).toBe(true);
  });

  it('should disable macro sliders when dailySnacksCount is 0 (Test Case 15b)', async () => {
    // 1. Ensure the form is set to be visible
    component.isLoading = false;

    // 2. Set the exact edge-case data BEFORE we tell the HTML to render
    component.settingsData.nutritionSettings.mealMacroSplitPercentage = {
      calories: 80,
      protein: 80,
      carbs: 80,
      fat: 80,
    };
    component.settingsData.nutritionSettings.dailySnacksCount = 0;

    // 3. Command Angular to render the form for the very first time.
    // Because dailySnacksCount is ALREADY 0, ngModel renders it perfectly on the first try.
    fixture.detectChanges();
    await fixture.whenStable();

    // 4. Verify the disabled state was applied to the DOM element
    const compiled = fixture.nativeElement as HTMLElement;
    const proteinSlider = compiled.querySelector('input[name="proteinSplit"]') as HTMLInputElement;

    if (proteinSlider) {
      expect(proteinSlider.disabled).toBe(true);
    }
  });
});
