import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.scss'],
})
export class Register implements OnInit {
  userData = {
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  };
  isLoading = false;
  isRegisteredSuccess = false;

  private titleService = inject(Title);
  private router = inject(Router);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  ngOnInit(): void {
    this.titleService.setTitle('Create Account | MealPlan Dashboard');
  }

  onRegisterSubmit(): void {
    const { username, email, password, confirmPassword } = this.userData;

    if (!username || !email || !password || !confirmPassword) {
      return;
    }

    if (username.length < 6) {
      return;
    }

    if (password !== confirmPassword) {
      return;
    }

    this.isLoading = true;
    this.authService.register({ username, email, password }).subscribe({
      next: () => {
        this.isLoading = false;
        this.isRegisteredSuccess = true;
        this.toastService.showSuccess('Account created! Please check your email to verify.');
      },
      error: (err) => {
        console.error('Registration Failure:', err);
        this.isLoading = false;
        this.toastService.showError(err.error?.message || 'Failed to create user account.');
      },
    });
  }

  onResendVerification(): void {
    if (!this.userData.email) return;

    this.authService.resendVerification(this.userData.email).subscribe({
      next: (res) => this.toastService.showSuccess(res.message),
      error: (err) => this.toastService.showError(err.error?.message || 'Failed to resend email.'),
    });
  }
}
