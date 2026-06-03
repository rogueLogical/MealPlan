import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../services/toast';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrls: ['./toast.scss'],
})
export class Toast {
  private toastService = inject(ToastService);
  toasts$: Observable<ToastMessage[]> = this.toastService.toasts$;

  dismiss(id: number): void {
    this.toastService.clear(id);
  }
}
