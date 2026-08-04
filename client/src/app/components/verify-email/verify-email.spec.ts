import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VerifyEmail } from './verify-email';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';

describe('VerifyEmail Component', () => {
  let component: VerifyEmail;
  let fixture: ComponentFixture<VerifyEmail>;
  let mockAuthService: Partial<AuthService>;
  let mockToastService: Partial<ToastService>;

  beforeEach(async () => {
    mockAuthService = {
      verifyEmail: vi
        .fn()
        .mockReturnValue(of({ message: 'Verified', user: { email: 'v@test.com' } })),
      resendVerification: vi.fn().mockReturnValue(of({ message: 'Resent' })),
      updateCurrentUser: vi.fn(),
    };

    mockToastService = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [VerifyEmail],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ToastService, useValue: mockToastService },
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => (key === 'token' ? 'valid_token' : null),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VerifyEmail);
    component = fixture.componentInstance;
  });

  it('should verify email automatically on init if token parameter is present', () => {
    fixture.detectChanges();

    expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('valid_token');
    expect(component.isSuccess).toBe(true);
    expect(component.isLoading).toBe(false);
  });

  it('should handle verification errors gracefully', () => {
    mockAuthService.verifyEmail = vi
      .fn()
      .mockReturnValue(throwError(() => ({ error: { message: 'Expired' } })));
    fixture.detectChanges();

    expect(component.isSuccess).toBe(false);
    expect(component.errorMessage).toBe('Expired');
  });
});
