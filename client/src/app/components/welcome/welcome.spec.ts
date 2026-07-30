import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Welcome } from './welcome';

describe('Welcome Component Test Suite', () => {
  let component: Welcome;
  let fixture: ComponentFixture<Welcome>;

  beforeEach(async () => {
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
      imports: [Welcome],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Welcome);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create the Welcome component', () => {
    expect(component).toBeTruthy();
  });

  it('should render core value proposition feature cards', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.feature-card');
    expect(cards.length).toBe(6);
    expect(compiled.textContent).toContain('Precision Macro Balancing');
    expect(compiled.textContent).toContain('Portion Storage Tracker');
  });

  it('should render Get Started and Log In CTA buttons', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = compiled.querySelectorAll('a');

    const hrefs = Array.from(links).map(
      (link) => link.getAttribute('href') || link.getAttribute('ng-reflect-router-link'),
    );
    expect(hrefs.some((h) => h?.includes('register'))).toBe(true);
    expect(hrefs.some((h) => h?.includes('login'))).toBe(true);
  });

  it('should toggle theme when toggleTheme is called', () => {
    component.toggleTheme();
    expect(component.isDarkMode).toBe(true);
    expect(document.documentElement.classList.contains('dark-mode')).toBe(true);

    component.toggleTheme();
    expect(component.isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains('dark-mode')).toBe(false);
  });
});
