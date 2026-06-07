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

  private titleService = inject(Title);
  private router = inject(Router);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  ngOnInit(): void {
    this.titleService.setTitle('Create Account | MealPlan Dashboard');
  }

  onRegisterSubmit(): void {
    const { username, email, password, confirmPassword } = this.userData;

    // Basic validation rules checks
    if (!username || !email || !password || !confirmPassword) {
      return;
    }

    if (username.length < 6) {
      return;
    }

    if (password !== confirmPassword) {
      return;
    }

    // Fire the network registration request payload
    this.authService.register({ username, email, password }).subscribe({
      next: () => {
        this.toastService.showSuccess('Account created successfully! Please log in.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('Registration Failure:', err);
        this.toastService.showError(err.error?.message || 'Failed to create user account.');
      },
    });
  }
}
