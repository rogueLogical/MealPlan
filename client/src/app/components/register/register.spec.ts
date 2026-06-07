import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { Observable, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Register } from './register';
import { AuthService } from '../../services/auth';

interface MockAuthService {
  register: Mock<
    (userData: { username: string; email: string; password: string }) => Observable<unknown>
  >;
}

describe('Test Case 4: User Account Creation', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let authServiceMock: MockAuthService;
  let router: Router;

  beforeEach(async () => {
    authServiceMock = {
      register: vi.fn(),
    };

    await TestBed.configureTestingModule({
      // Move standalone component from 'declarations' into 'imports'
      imports: [Register, FormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceMock as unknown as AuthService },
        provideRouter([]),
        provideLocationMocks(),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create a new user account upon new account form submission', () => {
    const mockRegistrationPayload = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };
    authServiceMock.register.mockReturnValue(
      of({ success: true, message: 'Verification email sent.' }),
    );
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.userData = mockRegistrationPayload;
    fixture.detectChanges();

    component.onRegisterSubmit();

    expect(authServiceMock.register).toHaveBeenCalledWith({
      username: mockRegistrationPayload.username,
      email: mockRegistrationPayload.email,
      password: mockRegistrationPayload.password,
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
