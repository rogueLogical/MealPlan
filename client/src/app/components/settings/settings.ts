import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-settings',
  imports: [],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private toastService = inject(ToastService);

  triggerDemo(): void {
    // TEMP demo for testing toast notifications
    this.toastService.showSuccess('System configurations compiled and saved successfully!');
  }
}
