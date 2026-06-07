import { Component, OnInit, inject, HostListener } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  isDarkMode = false;
  credentials = {
    username: '',
    password: '',
  };

  private titleService = inject(Title);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  ngOnInit(): void {
    // Sync Angular state flag with the root HTML element class state
    if (document.documentElement.classList.contains('dark-mode')) {
      this.isDarkMode = true;
    }
    this.titleService.setTitle('Login | MealPlan');
  }

  // handle dark mode changes
  @HostListener('window:storage', ['$event'])
  onStorageChange(event: StorageEvent): void {
    if (event.key === 'theme') {
      if (event.newValue === 'dark') {
        this.isDarkMode = true;
        document.documentElement.classList.add('dark-mode');
      } else {
        this.isDarkMode = false;
        document.documentElement.classList.remove('dark-mode');
      }
    }
  }

  // handle login submit
  onLoginSubmit(): void {
    if (!this.credentials.username || !this.credentials.password) {
      this.toastService.showError('Please fill out all credential fields.');
      return;
    }

    this.authService.login(this.credentials).subscribe({
      next: () => {
        this.toastService.showSuccess(`Welcome back, ${this.credentials.username}!`);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        console.error('Login Failure:', err);
        this.toastService.showError(err.error?.message || 'Invalid username or password.');
      },
    });
  }
}
