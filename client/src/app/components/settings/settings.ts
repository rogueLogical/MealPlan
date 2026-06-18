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
      dailyMacroTargets: { calories: 2000, protein: 150, netCarbs: 200, fat: 70 },
      dietaryRestrictions: [],
      likedFoods: [],
      dislikedFoods: [],
      dailyMealsCount: 3,
      dailySnacksCount: 2,
      mealMacroSplitPercentage: { calories: 80, protein: 80, netCarbs: 80, fat: 80 },
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
              dailyMealsCount: response.user.nutritionSettings?.dailyMealsCount ?? 3,
              dailySnacksCount: response.user.nutritionSettings?.dailySnacksCount ?? 2,
              mealMacroSplitPercentage: response.user.nutritionSettings
                ?.mealMacroSplitPercentage || { calories: 80, protein: 80, netCarbs: 80, fat: 80 },
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

  get netCarbsCalories(): number {
    return (this.settingsData.nutritionSettings.dailyMacroTargets.netCarbs || 0) * 4;
  }

  get fatCalories(): number {
    return (this.settingsData.nutritionSettings.dailyMacroTargets.fat || 0) * 9;
  }

  get totalCalculatedCalories(): number {
    const total = this.proteinCalories + this.netCarbsCalories + this.fatCalories;
    this.settingsData.nutritionSettings.dailyMacroTargets.calories = total;
    return total;
  }

  get targetMealCalories(): number {
    return this.targetMealProtein * 4 + this.targetMealCarbs * 4 + this.targetMealFat * 9;
  }

  get targetMealProtein(): number {
    const split = this.settingsData.nutritionSettings.mealMacroSplitPercentage?.protein || 80;
    const count = this.settingsData.nutritionSettings.dailyMealsCount || 1;
    return Math.round(
      ((this.settingsData.nutritionSettings.dailyMacroTargets.protein || 0) * (split / 100)) /
        count,
    );
  }

  get targetMealCarbs(): number {
    const split = this.settingsData.nutritionSettings.mealMacroSplitPercentage?.netCarbs || 80;
    const count = this.settingsData.nutritionSettings.dailyMealsCount || 1;
    return Math.round(
      ((this.settingsData.nutritionSettings.dailyMacroTargets.netCarbs || 0) * (split / 100)) /
        count,
    );
  }

  get targetMealFat(): number {
    const split = this.settingsData.nutritionSettings.mealMacroSplitPercentage?.fat || 80;
    const count = this.settingsData.nutritionSettings.dailyMealsCount || 1;
    return Math.round(
      ((this.settingsData.nutritionSettings.dailyMacroTargets.fat || 0) * (split / 100)) / count,
    );
  }

  get targetSnackCalories(): number {
    if (this.settingsData.nutritionSettings.dailySnacksCount === 0) return 0;
    return this.targetSnackProtein * 4 + this.targetSnackCarbs * 4 + this.targetSnackFat * 9;
  }

  get targetSnackProtein(): number {
    const split = this.settingsData.nutritionSettings.mealMacroSplitPercentage?.protein || 80;
    const count = this.settingsData.nutritionSettings.dailySnacksCount || 1;
    if (count === 0) return 0;
    return Math.round(
      ((this.settingsData.nutritionSettings.dailyMacroTargets.protein || 0) *
        ((100 - split) / 100)) /
        count,
    );
  }

  get targetSnackCarbs(): number {
    const split = this.settingsData.nutritionSettings.mealMacroSplitPercentage?.netCarbs || 80;
    const count = this.settingsData.nutritionSettings.dailySnacksCount || 1;
    if (count === 0) return 0;
    return Math.round(
      ((this.settingsData.nutritionSettings.dailyMacroTargets.netCarbs || 0) *
        ((100 - split) / 100)) /
        count,
    );
  }

  get targetSnackFat(): number {
    const split = this.settingsData.nutritionSettings.mealMacroSplitPercentage?.fat || 80;
    const count = this.settingsData.nutritionSettings.dailySnacksCount || 1;
    if (count === 0) return 0;
    return Math.round(
      ((this.settingsData.nutritionSettings.dailyMacroTargets.fat || 0) * ((100 - split) / 100)) /
        count,
    );
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

  validateMealsCount(): void {
    const count = this.settingsData.nutritionSettings.dailyMealsCount;
    // If the user clears the input entirely, or types 0, securely reset to 1
    if (count === undefined || count === null || count < 1) {
      this.settingsData.nutritionSettings.dailyMealsCount = 1;
    } else if (count > 6) {
      this.settingsData.nutritionSettings.dailyMealsCount = 6;
    }
  }

  onSnacksCountChange(newValue: number): void {
    let count = newValue;

    // Ensure bounds are respected (0 to 6 snacks)
    if (count === undefined || count === null || count < 0) {
      count = 0;
    } else if (count > 6) {
      count = 6;
    }

    this.settingsData.nutritionSettings.dailySnacksCount = count;

    // Lock Snap sliders to 100% Meals if Snacks are 0
    if (this.settingsData.nutritionSettings.dailySnacksCount === 0) {
      this.settingsData.nutritionSettings.mealMacroSplitPercentage = {
        calories: 100, // Kept in sync for backend payload consistency
        protein: 100,
        netCarbs: 100,
        fat: 100,
      };
    }
  }

  onSettingsSave(): void {
    // Re-verify calculations are accurate in the payload string before making the API request
    this.settingsData.nutritionSettings.dailyMacroTargets.calories = this.totalCalculatedCalories;

    // Catch edge cases where the user hits 'Enter' before the input (blur) events can fire
    this.validateMealsCount();
    this.onSnacksCountChange(this.settingsData.nutritionSettings.dailySnacksCount || 0);

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
