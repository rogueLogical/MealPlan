import { TestBed } from '@angular/core/testing';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { authGuard } from './auth-guard';
import { AuthService } from '../services/auth';

describe('authGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => authGuard(...guardParameters));

  let authServiceMock: { isLoggedIn: () => boolean };
  let router: Router;

  beforeEach(() => {
    authServiceMock = {
      isLoggedIn: () => false,
    };

    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authServiceMock }, provideRouter([])],
    });

    router = TestBed.inject(Router);
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });

  it('should redirect unauthenticated user to /welcome', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = {} as RouterStateSnapshot;

    const result = executeGuard(mockRoute, mockState);

    expect(result).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/welcome']);
  });
});
