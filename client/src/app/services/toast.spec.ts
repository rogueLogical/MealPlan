import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ToastService, ToastMessage } from './toast';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add a success toast', () => {
    service.showSuccess('Works!');
    let toasts: ToastMessage[] = [];
    service.toasts$.subscribe((t) => (toasts = t));

    expect(toasts.length).toBe(1);
    expect(toasts[0].text).toBe('Works!');
    expect(toasts[0].type).toBe('success');
  });

  it('should add an error toast', () => {
    service.showError('Fails!');
    let toasts: ToastMessage[] = [];
    service.toasts$.subscribe((t) => (toasts = t));

    expect(toasts.length).toBe(1);
    expect(toasts[0].type).toBe('error');
  });

  it('should add an info toast using the default parameter branch', () => {
    service.showInfo('Info!');
    let toasts: ToastMessage[] = [];
    service.toasts$.subscribe((t) => (toasts = t));

    expect(toasts.length).toBe(1);
    expect(toasts[0].type).toBe('info');
  });

  it('should auto-clear toasts after 4 seconds', () => {
    vi.useFakeTimers();

    service.show('Disappear soon', 'info');

    vi.advanceTimersByTime(4001);

    let toasts: ToastMessage[] = [];
    service.toasts$.subscribe((t) => (toasts = t));
    expect(toasts.length).toBe(0);
  });

  it('should allow manual clearing of active toasts', () => {
    service.show('Clear me manually', 'info');

    let toasts: ToastMessage[] = [];
    service.toasts$.subscribe((t) => (toasts = t));
    expect(toasts.length).toBe(1);

    const activeId = toasts[0].id;

    service.clear(activeId);

    service.toasts$.subscribe((t) => (toasts = t));
    expect(toasts.length).toBe(0);
  });
});
