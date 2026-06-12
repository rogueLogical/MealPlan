import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, UserSettingsPayload } from '../../services/user';
import { AuthService, UserProfile } from '../../services/auth';
import { ToastService } from '../../services/toast';
import { NumbersOnlyDirective } from '../../directives/numbers-only';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, NumbersOnlyDirective],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
})
export class Settings implements OnInit {
  availableRestrictions = [
    'Vegetarian',
    'Vegan',
    'Pescatarian',
    'Keto',
    'Paleo',
    'Gluten-Free',
    'Dairy-Free',
    'Nut Allergy',
    'Shellfish Allergy',
    'Soy Allergy',
    'Kosher',
    'Halal',
  ];

  // Temporary string holders for the comma-separated text inputs
  likedFoodsInput = '';
  dislikedFoodsInput = '';

  // Setup default form state
  settingsData: UserSettingsPayload = {
    email: '',
    measurementSystem: 'imperial',
    nutritionSettings: {
      dailyMacroTargets: { calories: 2000, protein: 150, carbs: 200, fat: 70 },
      dietaryRestrictions: [],
      likedFoods: [],
      dislikedFoods: [],
    },
    profilePicture: '',
  };

  isLoading = true;

  private userService = inject(UserService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.userService.getUserProfile().subscribe({
      next: (response) => {
        if (response.user) {
          this.settingsData = {
            email: response.user.email || '',
            measurementSystem: response.user.settings?.measurementSystem || 'imperial',
            profilePicture: response.user.profilePicture || '',
            nutritionSettings: {
              dailyMacroTargets: {
                ...this.settingsData.nutritionSettings.dailyMacroTargets,
                ...response.user.nutritionSettings?.dailyMacroTargets,
              },
              dietaryRestrictions: response.user.nutritionSettings?.dietaryRestrictions || [],
              likedFoods: response.user.nutritionSettings?.likedFoods || [],
              dislikedFoods: response.user.nutritionSettings?.dislikedFoods || [],
            },
          };
          this.likedFoodsInput = this.settingsData.nutritionSettings.likedFoods?.join(', ') || '';
          this.dislikedFoodsInput =
            this.settingsData.nutritionSettings.dislikedFoods?.join(', ') || '';
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load profile data settings:', err);
        this.toastService.showError('Could not fetch account settings profile endpoints.');
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  get proteinCalories(): number {
    return (this.settingsData.nutritionSettings.dailyMacroTargets.protein || 0) * 4;
  }

  get carbsCalories(): number {
    return (this.settingsData.nutritionSettings.dailyMacroTargets.carbs || 0) * 4;
  }

  get fatCalories(): number {
    return (this.settingsData.nutritionSettings.dailyMacroTargets.fat || 0) * 9;
  }

  get totalCalculatedCalories(): number {
    const total = this.proteinCalories + this.carbsCalories + this.fatCalories;
    this.settingsData.nutritionSettings.dailyMacroTargets.calories = total;
    return total;
  }

  hasRestriction(restriction: string): boolean {
    return this.settingsData.nutritionSettings.dietaryRestrictions?.includes(restriction) || false;
  }

  toggleRestriction(restriction: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    let currentList = this.settingsData.nutritionSettings.dietaryRestrictions || [];

    if (isChecked) {
      currentList.push(restriction);
    } else {
      currentList = currentList.filter((item) => item !== restriction);
    }

    this.settingsData.nutritionSettings.dietaryRestrictions = currentList;
  }
  getMacroPercentage(macroCalories: number): number {
    const total = this.totalCalculatedCalories;
    if (total === 0) return 0;
    return (macroCalories / total) * 100;
  }

  onSettingsSave(): void {
    // Re-verify calculations are accurate in the payload string before making the API request
    this.settingsData.nutritionSettings.dailyMacroTargets.calories = this.totalCalculatedCalories;
    // change comma separated lists to arrays
    this.settingsData.nutritionSettings.likedFoods = this.likedFoodsInput
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    this.settingsData.nutritionSettings.dislikedFoods = this.dislikedFoodsInput
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    this.userService.updateUserSettings(this.settingsData).subscribe({
      next: () => {
        this.toastService.showSuccess('User settings updated successfully!');
        // update client side user data when settings are saved
        const updatedProfile: Partial<UserProfile> = {};
        if (this.settingsData.profilePicture) {
          updatedProfile.profilePicture = this.settingsData.profilePicture;
        }
        if (this.settingsData.email) {
          updatedProfile.email = this.settingsData.email;
        }
        this.authService.updateCurrentUser(updatedProfile);
      },
      error: (err) => {
        console.error('Failed to update configurations profile:', err);
        this.toastService.showError(err.error?.message || 'Failed to save account settings.');
      },
    });
  }
}
