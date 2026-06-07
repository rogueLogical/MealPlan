import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Get JWT authorization token string out of browser memory
  const token = localStorage.getItem('token');

  // If a token exists, clone the request and inject the Authorization bearer header
  if (token) {
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    // Pass the upgraded, secure request forward
    return next(clonedRequest);
  }

  // If no token is stored, pass the original request through unchanged
  return next(req);
};
