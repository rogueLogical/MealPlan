import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  profilePicture: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: UserProfile;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private apiUrl = `${environment.apiUrl}/auth`;

  // Create a reactive state stream to broadcast user profiles across the UI shell layers
  private currentUserSubject = new BehaviorSubject<UserProfile | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // On application boot up, check if a session payload cache already exists locally
    const savedUser = localStorage.getItem('user_profile');
    if (savedUser) {
      this.currentUserSubject.next(JSON.parse(savedUser));
    }
  }

  // Active validation checker used by the Route Guard system
  isLoggedIn(): boolean {
    return localStorage.getItem('token') !== null;
  }

  login(credentials: { username: string; password: Math | string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response) => {
        // Intercept a successful transaction to store credentials securely
        localStorage.setItem('token', response.token);
        localStorage.setItem('user_profile', JSON.stringify(response.user));
        this.currentUserSubject.next(response.user);
      }),
    );
  }

  register(userData: RegisterPayload): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/register`, userData);
  }

  logout(): void {
    this.clearSessionCache();
  }

  updateCurrentUser(updatedProfile: Partial<UserProfile>): void {
    const currentProfile = this.currentUserSubject.value;
    if (currentProfile) {
      const newProfile = { ...currentProfile, ...updatedProfile };

      // Overwrite both local storage and the active state broadcast stream
      localStorage.setItem('user_profile', JSON.stringify(newProfile));
      this.currentUserSubject.next(newProfile);
    }
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reset-password`, {
      token,
      newPassword,
    });
  }

  private clearSessionCache(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user_profile');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }
}
