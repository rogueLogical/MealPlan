import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  email = '';
  newPassword = '';
  confirmPassword = '';
  token: string | null = null;
  isResetMode = false;

  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  constructor() {
    // Determine context: check if the user clicked an email link with a token query string parameter
    this.token = this.route.snapshot.queryParamMap.get('token');
    this.isResetMode = !!this.token;
  }

  requestLink(): void {
    this.authService.forgotPassword(this.email).subscribe({
      next: (res) => this.toastService.showSuccess(res.message),
      error: (err) => this.toastService.showError(err.error?.message || 'Request failed.'),
    });
  }

  executeReset(): void {
    if (!this.token) return;
    if (this.newPassword !== this.confirmPassword) return;
    this.authService.resetPassword(this.token, this.newPassword).subscribe({
      next: (res) => {
        this.toastService.showSuccess(res.message);
        void this.router.navigate(['/login']);
      },
      error: (err) => this.toastService.showError(err.error?.message || 'Reset failed.'),
    });
  }
}
