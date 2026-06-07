import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, UserSettingsPayload } from '../../services/user';
import { AuthService } from '../../services/auth';
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
  // Setup a default initial local form state
  settingsData: UserSettingsPayload = {
    measurementSystem: 'imperial',
    nutritionSettings: {
      dailyMacroTargets: { calories: 2000, protein: 150, carbs: 200, fat: 70 },
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
            measurementSystem: response.user.settings?.measurementSystem || 'imperial',
            profilePicture: response.user.profilePicture || '',
            nutritionSettings: {
              dailyMacroTargets: {
                ...this.settingsData.nutritionSettings.dailyMacroTargets,
                ...response.user.nutritionSettings?.dailyMacroTargets,
              },
            },
          };
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

  getMacroPercentage(macroCalories: number): number {
    const total = this.totalCalculatedCalories;
    if (total === 0) return 0;
    return (macroCalories / total) * 100;
  }

  onSettingsSave(): void {
    // Re-verify calculations are accurate in the payload string before making the API request
    this.settingsData.nutritionSettings.dailyMacroTargets.calories = this.totalCalculatedCalories;

    this.userService.updateUserSettings(this.settingsData).subscribe({
      next: () => {
        this.toastService.showSuccess('User settings updated successfully!');
        if (this.settingsData.profilePicture) {
          this.authService.updateCurrentUser({ profilePicture: this.settingsData.profilePicture });
        }
      },
      error: (err) => {
        console.error('Failed to update configurations profile:', err);
        this.toastService.showError(err.error?.message || 'Failed to save account settings.');
      },
    });
  }
}
