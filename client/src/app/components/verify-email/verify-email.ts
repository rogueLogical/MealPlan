import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './verify-email.html',
  styleUrls: ['./verify-email.scss'],
})
export class VerifyEmail implements OnInit {
  token: string | null = null;
  isLoading = true;
  isSuccess = false;
  errorMessage = '';

  resendEmail = '';
  isResending = false;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private titleService = inject(Title);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.titleService.setTitle('Verify Email | MealPlan');
    this.token = this.route.snapshot.queryParamMap.get('token');

    if (this.token) {
      this.executeVerification(this.token);
    } else {
      this.isLoading = false;
      this.isSuccess = false;
      this.errorMessage = 'No verification token was provided in the link.';
      this.cdr.markForCheck();
    }
  }

  executeVerification(token: string): void {
    this.isLoading = true;
    this.authService.verifyEmail(token).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.isSuccess = true;
        this.toastService.showSuccess('Email address verified successfully!');

        // If user is currently logged in, update local auth state immediately
        if (res.user && res.user.email) {
          this.authService.updateCurrentUser({ email: res.user.email });
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.isSuccess = false;
        this.errorMessage =
          err.error?.message ||
          'Verification failed. Your verification link may be invalid or expired.';
        this.toastService.showError(this.errorMessage);
        this.cdr.markForCheck();
      },
    });
  }

  onResendSubmit(): void {
    if (!this.resendEmail.trim()) return;

    this.isResending = true;
    this.authService.resendVerification(this.resendEmail).subscribe({
      next: (res) => {
        this.isResending = false;
        this.toastService.showSuccess(res.message);
        this.resendEmail = '';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isResending = false;
        this.toastService.showError(err.error?.message || 'Failed to resend verification email.');
        this.cdr.markForCheck();
      },
    });
  }
}
