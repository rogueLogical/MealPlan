import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Home } from './home';
import { provideRouter } from '@angular/router';

describe('Home Component Test Suite', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    // Create a mock localStorage container for the virtual testing sandbox
    let store: Record<string, string> = {};

    const mockLocalStorage = {
      getItem: (key: string): string | null => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = `${value}`;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      length: 0,
      key: () => null,
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create the Home component', () => {
    expect(component).toBeTruthy();
  });

  it('should default theme to light theme (UT-2)', () => {
    expect(component.isDarkMode).toBeFalsy();
  });

  it('should update dark-mode parameter when toggleTheme is called (UT-3)', () => {
    component.toggleTheme();
    expect(component.isDarkMode).toBeTruthy();
    expect(document.documentElement.classList.contains('dark-mode')).toBeTruthy();

    // Toggle back down to clean up browser DOM window impacts
    component.toggleTheme();
    expect(component.isDarkMode).toBeFalsy();
  });
});
