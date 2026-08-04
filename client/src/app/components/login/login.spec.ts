import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { Observable, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Login } from './login';
import { AuthService, AuthResponse } from '../../services/auth';

interface MockAuthService {
  login: Mock<(credentials: { username: string; password: string }) => Observable<AuthResponse>>;
  resendVerification: Mock<(email: string) => Observable<{ message: string }>>;
}

const mockStorage: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, v: string) => {
      mockStorage[key] = v;
    },
  },
  writable: true,
});

describe('User Account Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authServiceMock: MockAuthService;
  let router: Router;

  beforeEach(async () => {
    authServiceMock = {
      login: vi.fn(),
      resendVerification: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Login, FormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceMock as unknown as AuthService },
        provideRouter([]),
        provideLocationMocks(),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should authenticate a user who logs into an existing account (UT-5)', () => {
    const mockResponse: AuthResponse = {
      message: 'Success',
      token: 'mock-jwt',
      user: { id: '1', username: 'testuser', email: 't@e.com', profilePicture: '' },
    };
    authServiceMock.login.mockReturnValue(of(mockResponse));
    const navigateSpy = vi.spyOn(router, 'navigate');
    const mockCredentials = {
      username: 'testuser',
      password: 'Password123!',
    };
    component.credentials = mockCredentials;
    fixture.detectChanges();

    component.onLoginSubmit();

    expect(authServiceMock.login).toHaveBeenCalledWith(mockCredentials);
    expect(navigateSpy).toHaveBeenCalledWith(['/home']);
  });

  it('should display resend verification option when login is rejected due to unverified email', () => {
    authServiceMock.login.mockReturnValue(
      throwError(() => ({
        status: 403,
        error: {
          message: 'Please verify email',
          isEmailVerified: false,
          email: 'unverified@test.com',
        },
      })),
    );

    component.credentials = { username: 'unverifieduser', password: 'Password123!' };
    component.onLoginSubmit();

    expect(component.showResendVerification).toBe(true);
    expect(component.unverifiedEmail).toBe('unverified@test.com');
  });

  it('should call resendVerification when resend button is clicked', () => {
    authServiceMock.resendVerification.mockReturnValue(
      of({ message: 'Verification link resent.' }),
    );

    component.unverifiedEmail = 'unverified@test.com';
    component.onResendVerification();

    expect(authServiceMock.resendVerification).toHaveBeenCalledWith('unverified@test.com');
  });
});
