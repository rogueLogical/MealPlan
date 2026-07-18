import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MealPrepService, PortionStorageItem } from '../../services/meal-prep';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-portion-storage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portion-storage.html',
  styleUrls: ['./portion-storage.scss'],
})
export class PortionStorage implements OnInit {
  private prepService = inject(MealPrepService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  storageList: PortionStorageItem[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.loadStorage();
  }

  loadStorage(silent = false): void {
    if (!silent) {
      this.isLoading = true;
    }
    this.prepService.getPortionStorage().subscribe({
      next: (res) => {
        this.storageList = res.storage.filter((item) => item.portionsInStorage > 0);
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Storage Fetch Error', err);
        this.toastService.showError('Failed to load portion storage.');
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  recordConsumption(item: PortionStorageItem): void {
    this.prepService.adjustPortionStorage(item.recipeId, item.recipeTitle, -1).subscribe({
      next: () => {
        this.toastService.showSuccess(`Portion of "${item.recipeTitle}" recorded as eaten.`);
        this.loadStorage(true);
      },
      error: (err) => {
        console.error('Adjust Storage Error', err);
        this.toastService.showError('Failed to record consumption.');
      },
    });
  }
}
