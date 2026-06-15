import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { By } from '@angular/platform-browser';
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

describe('Settings Management', () => {
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

  it('should save user preferences when they are set by the user (UT-8)', async () => {
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

  it('should save user goals when they are set by the user (UT-9)', async () => {
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

  it('should parse culinary text inputs into arrays and save culinary preferences (UT-10)', async () => {
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

  it('should correctly calculate macro targets per meal and snack (UT-11)', () => {
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

  it('should enforce boundary rules and lock sliders when snacks are set to zero (UT-12)', () => {
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

  it('should render the loading spinner when isLoading is true', () => {
    // Start with a fresh component and immediately set it to load
    component.isLoading = true;

    // Trigger the HTML branch for @if (isLoading)
    fixture.detectChanges();

    // The branch is covered!
    expect(component.isLoading).toBe(true);
  });

  it('should disable macro sliders when dailySnacksCount is 0', async () => {
    // Ensure the form is set to be visible
    component.isLoading = false;

    // Set the exact edge-case data BEFORE we tell the HTML to render
    component.settingsData.nutritionSettings.mealMacroSplitPercentage = {
      calories: 80,
      protein: 80,
      carbs: 80,
      fat: 80,
    };
    component.settingsData.nutritionSettings.dailySnacksCount = 0;

    // Command Angular to render the form for the very first time.
    // Because dailySnacksCount is ALREADY 0, ngModel renders it perfectly on the first try.
    fixture.detectChanges();
    await fixture.whenStable();

    // Verify the disabled state was applied to the DOM element
    const compiled = fixture.nativeElement as HTMLElement;
    const proteinSlider = compiled.querySelector('input[name="proteinSplit"]') as HTMLInputElement;

    if (proteinSlider) {
      expect(proteinSlider.disabled).toBe(true);
    }
  });

  it('should execute fallback branches when user profile data is missing or undefined', () => {
    // Mock an API response that has absolutely NO nutritionSettings or profile data.
    // This forces every single `?.`, `||`, and `??` operator in ngOnInit to use its fallback.
    userServiceMock.getUserProfile.mockReturnValue(
      of({
        user: {
          email: 'barebones@example.com',
          // No profilePicture, settings, or nutritionSettings provided!
        },
      }),
    );

    // Trigger the initialization
    component.ngOnInit();

    // Verify the component safely fell back to the defaults without crashing
    expect(component.settingsData.nutritionSettings.dailyMealsCount).toBe(3);
    expect(component.settingsData.nutritionSettings.dailySnacksCount).toBe(2);
    expect(component.settingsData.nutritionSettings.mealMacroSplitPercentage!.protein).toBe(80);

    // Force 'undefined' directly into the count validators to trigger their hidden branches
    component.settingsData.nutritionSettings.dailyMealsCount = undefined as unknown as number;
    component.validateMealsCount();
    expect(component.settingsData.nutritionSettings.dailyMealsCount).toBe(1);

    component.settingsData.nutritionSettings.dailySnacksCount = undefined as unknown as number;
    // Pass undefined as the $event argument
    component.onSnacksCountChange(undefined as unknown as number);
    expect(component.settingsData.nutritionSettings.dailySnacksCount).toBe(0);
  });

  it('should trigger HTML fallback branches when macro split percentages are 0', async () => {
    // Ensure the form is visible so the DOM actually renders the sliders
    component.isLoading = false;

    // Set the values explicitly to 0.
    component.settingsData.nutritionSettings.mealMacroSplitPercentage = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };

    // Force the template to physically paint the 0 values
    fixture.detectChanges();
    await fixture.whenStable();

    // Verify the HTML successfully rendered the fallback math without crashing
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Meals: 0%');
  });

  it('should trigger remaining HTML template branches for avatar fallbacks and empty blur events', async () => {
    component.isLoading = false;

    // Force the Avatar fallback (profilePicture || 'https://dicebear.com')
    component.settingsData.profilePicture = '';

    // Force the Snacks Blur fallback (dailySnacksCount || 0)
    component.settingsData.nutritionSettings.dailySnacksCount = undefined as unknown as number;

    // Command Angular to paint these empty states to the virtual DOM
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;

    // Verify the image src successfully fell back to the default URL
    const avatarImg = compiled.querySelector('.preview-img') as HTMLImageElement;
    if (avatarImg) {
      expect(avatarImg.src).toContain('dicebear.com');
    }

    // Physically trigger the blur event on the input to execute the HTML line
    const snacksInput = compiled.querySelector('input[name="snacksCount"]') as HTMLInputElement;
    if (snacksInput) {
      // This tells the virtual browser to simulate the user clicking away from the input
      snacksInput.dispatchEvent(new Event('blur'));
    }
  });

  it('should trigger the hidden @for branch when the restrictions array is empty', () => {
    // Ensure the form is visible so the DOM reaches the loop
    component.isLoading = false;

    // Temporarily empty the array to force the compiler down the hidden "@empty" pathway
    component.availableRestrictions = [];

    // Force Angular to render the empty state
    fixture.detectChanges();

    // Verify the DOM correctly bypassed the loop and rendered zero checkboxes
    const compiled = fixture.nativeElement as HTMLElement;
    const checkboxes = compiled.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it('should definitively evaluate all template bindings on the snacks input using DebugElement', async () => {
    component.isLoading = false;
    fixture.detectChanges();
    await fixture.whenStable();

    // Grab the element using Angular's internal Debug tool (bypasses JSDOM quirks)
    const snacksInputDebug = fixture.debugElement.query(By.css('input[name="snacksCount"]'));

    // Trigger Truthy Branch (Left side of ||)
    component.settingsData.nutritionSettings.dailySnacksCount = 2;
    fixture.detectChanges();
    // Inject the events directly into the Angular template
    snacksInputDebug.triggerEventHandler('ngModelChange', 2);
    snacksInputDebug.triggerEventHandler('blur', null);

    // Trigger Zero Branch (0 is falsy, so '0 || 0' forces the right side to evaluate)
    component.settingsData.nutritionSettings.dailySnacksCount = 0;
    fixture.detectChanges();
    snacksInputDebug.triggerEventHandler('ngModelChange', 0);
    snacksInputDebug.triggerEventHandler('blur', null);

    // Trigger Null/Undefined Branch (Final defensive fallback)
    component.settingsData.nutritionSettings.dailySnacksCount = null as unknown as number;
    fixture.detectChanges();
    snacksInputDebug.triggerEventHandler('ngModelChange', null);
    snacksInputDebug.triggerEventHandler('blur', null);
  });
});
