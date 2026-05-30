import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../services/toast';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrls: ['./toast.scss']
})
export class Toast implements OnInit {
  toasts$: Observable<ToastMessage[]>;

  constructor(private toastService: ToastService) {
    this.toasts$ = this.toastService.toasts$;
  }

  ngOnInit(): void {}

  dismiss(id: number): void {
    this.toastService.clear(id);
  }
}
