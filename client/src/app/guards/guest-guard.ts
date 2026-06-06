import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If the user already has a token in localStorage, block guest only route access
  if (authService.isLoggedIn()) {
    // Redirect to empty string, which defaults to /home
    router.navigate(['/']);
    return false; // Block access to the guest only components
  }

  return true; // Allow unauthenticated users to access the guest only pages
};
