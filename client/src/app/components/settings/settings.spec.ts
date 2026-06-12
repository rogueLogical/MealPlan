import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { Observable, of } from 'rxjs';
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
});
