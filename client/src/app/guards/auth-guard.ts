import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  // TEMPORARY MOCK AUTHENTICATION CHECK: Change this to true/false to test the gate lock
  const isAuthenticated = true;

  if (isAuthenticated) {
    return true; // Grant passage to the dashboard route
  } else {
    // Block passage and redirect to the public login screen
    router.navigate(['/login']);
    return false;
  }
};
