import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router, provideRouter, ActivatedRoute } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { Observable, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ForgotPassword } from './forgot-password';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

interface MockAuthService {
  forgotPassword: Mock<(email: string) => Observable<{ message: string }>>;
  resetPassword: Mock<(token: string, newPassword: string) => Observable<{ message: string }>>;
}

interface MockToastService {
  showSuccess: Mock<(msg: string) => void>;
  showError: Mock<(msg: string) => void>;
}

describe('ForgotPassword Component Workflow Suites', () => {
  let component: ForgotPassword;
  let fixture: ComponentFixture<ForgotPassword>;
  let authServiceMock: MockAuthService;
  let toastServiceMock: MockToastService;
  let router: Router;

  beforeEach(() => {
    authServiceMock = {
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
    };

    toastServiceMock = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };
  });

  // Structural Helper function enabling parameterized mock configurations over ActivatedRoute tokens
  async function configureAndCreateComponent(queryParams: Record<string, string>) {
    await TestBed.configureTestingModule({
      imports: [ForgotPassword, FormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceMock as unknown as AuthService },
        { provide: ToastService, useValue: toastServiceMock as unknown as ToastService },
        provideRouter([]),
        provideLocationMocks(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => queryParams[key] || null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ForgotPassword);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // SUB-SUITE A: FORGOT PASSWORD (REQUEST LINK MODE)
  describe('Forgot Password (Request Mode)', () => {
    beforeEach(async () => {
      // Simulate navigating directly to /forgot-password without any query tokens
      await configureAndCreateComponent({});
    });

    it('should initialize in request link mode when no token parameter is detected', () => {
      expect(component.isResetMode).toBeFalsy();
      expect(component.token).toBeNull();
    });

    it('should dispatch an authentication link request successfully on valid form submission', async () => {
      const mockSuccessResponse = {
        message: 'If that email address exists, a recovery link has been dispatched.',
      };
      authServiceMock.forgotPassword.mockReturnValue(of(mockSuccessResponse));

      component.email = 'user@example.com';
      fixture.detectChanges();

      component.requestLink();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(authServiceMock.forgotPassword).toHaveBeenCalledWith('user@example.com');
      expect(toastServiceMock.showSuccess).toHaveBeenCalledWith(mockSuccessResponse.message);
    });
  });

  // SUB-SUITE B: RESET PASSWORD (EXEUCTION MODE WITH TOKEN)
  describe('Reset Password (Execution Mode)', () => {
    beforeEach(async () => {
      // Simulate clicking an email link providing a valid secure reset token parameter
      await configureAndCreateComponent({ token: 'secure_crypto_hex_token_12345' });
    });

    it('should initialize in reset mode when an active token parameter is verified', () => {
      expect(component.isResetMode).toBeTruthy();
      expect(component.token).toBe('secure_crypto_hex_token_12345');
    });

    it('should execute password updates completely and redirect user to log in screen on success', async () => {
      const mockSuccessResponse = { message: 'Your password has been successfully reset.' };
      authServiceMock.resetPassword.mockReturnValue(of(mockSuccessResponse));
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.newPassword = 'MyBrandNewSecurePassword2026!';
      component.confirmPassword = 'MyBrandNewSecurePassword2026!';
      fixture.detectChanges();

      component.executeReset();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(authServiceMock.resetPassword).toHaveBeenCalledWith(
        'secure_crypto_hex_token_12345',
        'MyBrandNewSecurePassword2026!',
      );
      expect(toastServiceMock.showSuccess).toHaveBeenCalledWith(mockSuccessResponse.message);
      expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    });
  });
});
