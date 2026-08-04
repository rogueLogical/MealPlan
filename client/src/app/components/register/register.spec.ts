import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { Observable, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Register } from './register';
import { AuthService } from '../../services/auth';

interface MockAuthService {
  register: Mock<
    (userData: { username: string; email: string; password: string }) => Observable<unknown>
  >;
  resendVerification: Mock<(email: string) => Observable<unknown>>;
}

describe('User Account Creation', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let authServiceMock: MockAuthService;

  beforeEach(async () => {
    authServiceMock = {
      register: vi.fn(),
      resendVerification: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Register, FormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceMock as unknown as AuthService },
        provideRouter([]),
        provideLocationMocks(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display verification reminder card upon successful registration', () => {
    const mockRegistrationPayload = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };
    authServiceMock.register.mockReturnValue(of({ message: 'Verification email sent.' }));

    component.userData = mockRegistrationPayload;
    fixture.detectChanges();

    component.onRegisterSubmit();

    expect(authServiceMock.register).toHaveBeenCalledWith({
      username: mockRegistrationPayload.username,
      email: mockRegistrationPayload.email,
      password: mockRegistrationPayload.password,
    });
    expect(component.isRegisteredSuccess).toBe(true);
  });
});
