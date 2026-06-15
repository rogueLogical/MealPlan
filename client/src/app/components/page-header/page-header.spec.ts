import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  Router,
  provideRouter,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { BehaviorSubject, Observable } from 'rxjs';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AuthService, UserProfile } from '../../services/auth';
import { authGuard } from '../../guards/auth-guard';
import { PageHeader } from './page-header';

// mock local storage so AuthService can store tokens
let mockStorage: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      mockStorage = {};
    },
  },
  writable: true,
});

interface MockAuthService {
  logout: Mock<() => void>;
  isLoggedIn: Mock<() => boolean>;
  currentUser$: Observable<UserProfile | null>;
}

describe('User Account Logout', () => {
  let component: PageHeader;
  let fixture: ComponentFixture<PageHeader>;
  let authServiceMock: MockAuthService;
  let router: Router;
  let currentUserSubject: BehaviorSubject<UserProfile | null>;

  beforeEach(async () => {
    // Reset mock storage container before every test
    mockStorage = {};

    // Seed initial authentication tokens matching your real service prerequisites
    mockStorage['token'] = 'mock-valid-jwt-token';
    currentUserSubject = new BehaviorSubject<UserProfile | null>({
      id: '123',
      username: 'testuser',
      email: 'test@example.com',
      profilePicture: '',
    });

    // mock AuthService
    authServiceMock = {
      logout: vi.fn(() => {
        delete mockStorage['token'];
        delete mockStorage['user_profile'];
        currentUserSubject.next(null);
        router.navigate(['/login']);
      }),
      isLoggedIn: vi.fn(() => mockStorage['token'] !== undefined && mockStorage['token'] !== null),
      currentUser$: currentUserSubject.asObservable(),
    };

    await TestBed.configureTestingModule({
      imports: [PageHeader],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        provideRouter([]),
        provideLocationMocks(),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(PageHeader);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.currentUser).toEqual({
      id: '123',
      username: 'testuser',
      email: 'test@example.com',
      profilePicture: '',
    });
  });

  it('should remove authentication for a user who logs out of a currently logged in account (UT-6)', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.logout();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(authServiceMock.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    expect(component.currentUser).toBeNull();
    expect(mockStorage['token']).toBeUndefined();
  });

  it('should redirect user to login screen when attempting to navigate to /home after logout (UT-7)', async () => {
    // simulate a logged-out environment state
    delete mockStorage['token'];
    currentUserSubject.next(null);
    const navigateSpy = vi.spyOn(router, 'navigate');

    // Execute the authGuard
    const mockRoute = {} as unknown as ActivatedRouteSnapshot;
    const mockState = {} as unknown as RouterStateSnapshot;

    const guardResult = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    // Results Validation
    expect(guardResult).toBeFalsy();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
