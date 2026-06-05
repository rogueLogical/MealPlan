import { Component, OnInit, inject, HostListener } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
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

    // Temporary mock authorization logic for testing (allows any entry)
    console.log('Authenticating login inputs:', this.credentials);
    this.toastService.showSuccess(`Welcome back, ${this.credentials.username}!`);

    // Direct user to the home page
    this.router.navigate(['/home']);
  }
}
