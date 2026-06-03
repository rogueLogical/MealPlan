import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  toasts$ = this.toastsSubject.asObservable();
  private counter = 0;

  // Add a toast banner and trigger a 4-second auto-destruct timer
  show(text: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const id = this.counter++;
    const currentToasts = this.toastsSubject.value;

    this.toastsSubject.next([...currentToasts, { id, text, type }]);

    setTimeout(() => {
      this.clear(id);
    }, 4000);
  }

  showSuccess(text: string): void {
    this.show(text, 'success');
  }
  showError(text: string): void {
    this.show(text, 'error');
  }
  showInfo(text: string): void {
    this.show(text, 'info');
  }

  // Remove a toast explicitly by ID when clicked
  clear(id: number): void {
    const updatedToasts = this.toastsSubject.value.filter((t) => t.id !== id);
    this.toastsSubject.next(updatedToasts);
  }
}
