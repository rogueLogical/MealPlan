import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  if (authService.isLoggedIn()) {
    return true; // Grant passage to the dashboard route
  } else {
    // Block passage and redirect to the public login screen
    router.navigate(['/login']);
    return false;
  }
};
