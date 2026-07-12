import { HttpInterceptorFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap } from 'rxjs/operators';
import { throwError, EMPTY } from 'rxjs';
import { AuthService } from '../services/auth';
import { ToastService } from '../services/toast';

// Module-scoped flag to track if the session expired toast has already been displayed
let isSessionExpiredToastShown = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const toastService = inject(ToastService);

  // Get JWT authorization token string out of browser memory
  const token = localStorage.getItem('token');

  // If a token exists, clone the request and inject the Authorization bearer header
  let requestToForward = req;
  if (token) {
    requestToForward = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  // Pass the request forward and pipe the response to catch network errors
  return next(requestToForward).pipe(
    // Catch refresh tokens when the backend sends them
    tap((event) => {
      if (event instanceof HttpResponse) {
        // Reset the flag upon any successful HTTP response (e.g. login or standard API request)
        isSessionExpiredToastShown = false;

        const refreshedToken = event.headers.get('X-New-Token');
        if (refreshedToken) {
          // Silently overwrite the old token in browser storage
          localStorage.setItem('token', refreshedToken);
        }
      }
    }),
    // global error response response handling
    catchError((error: HttpErrorResponse) => {
      // Determine if this is a public authentication request (login, register, reset, etc.)
      const isAuthRequest = req.url.includes('/auth/');

      // If the backend rejects the token (expired or invalid) and it is NOT an authentication request
      if (error.status === 401 && !isAuthRequest) {
        // Prevent duplicate toast messages from spawning during concurrent requests
        if (!isSessionExpiredToastShown) {
          isSessionExpiredToastShown = true;
          toastService.showInfo('Your session has expired. Please log in again.');
        }

        authService.logout(); // Automatically clears storage and navigates to /login
        // return EMPTY to avoid triggering other component's error messages.
        return EMPTY;
      }

      // Re-throw the error so individual components (like login.ts) can still handle it
      return throwError(() => error);
    }),
  );
};
