import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  private readonly toastsSignal = signal<Toast[]>([]);
  readonly toasts = this.toastsSignal.asReadonly();

  show(type: ToastType, title: string, message?: string, duration = 4000): void {
    const id = ++this.counter;
    this.toastsSignal.update((items) => [...items, { id, type, title, message }]);
    window.setTimeout(() => this.remove(id), duration);
  }

  success(title: string, message?: string): void { this.show('success', title, message); }
  error(title: string, message?: string): void { this.show('error', title, message, 6000); }
  warning(title: string, message?: string): void { this.show('warning', title, message); }
  info(title: string, message?: string): void { this.show('info', title, message); }

  remove(id: number): void {
    this.toastsSignal.update((items) => items.filter((item) => item.id !== id));
  }
}

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container" aria-live="polite">
      <div class="toast" *ngFor="let t of toastService.toasts(); trackBy: trackById"
           [ngClass]="'toast-' + t.type"
           (click)="toastService.remove(t.id)">
        <span class="toast-icon" [innerHTML]="icons[t.type]"></span>
        <div class="toast-body">
          <p class="toast-title">{{ t.title }}</p>
          <p class="toast-msg" *ngIf="t.message">{{ t.message }}</p>
        </div>
        <button class="toast-close" type="button" aria-label="Fermer" (click)="toastService.remove(t.id); $event.stopPropagation()">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 10px;
      min-width: 280px;
      max-width: 380px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      cursor: pointer;
      pointer-events: all;
      animation: slide-in 220ms ease-out;
      border: 1px solid transparent;
      backdrop-filter: blur(10px);
    }

    @keyframes slide-in {
      from { transform: translateX(20px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .toast-success { background: rgba(15, 45, 26, 0.95); border-color: rgba(34, 197, 94, 0.3); }
    .toast-error { background: rgba(45, 15, 15, 0.95); border-color: rgba(239, 68, 68, 0.3); }
    .toast-warning { background: rgba(45, 32, 15, 0.95); border-color: rgba(245, 158, 11, 0.3); }
    .toast-info { background: rgba(15, 30, 45, 0.95); border-color: rgba(59, 130, 246, 0.3); }

    .toast-icon { flex-shrink: 0; margin-top: 1px; }
    .toast-success .toast-icon { color: #22c55e; }
    .toast-error .toast-icon { color: #ef4444; }
    .toast-warning .toast-icon { color: #f59e0b; }
    .toast-info .toast-icon { color: #3b82f6; }

    .toast-body { flex: 1; min-width: 0; }

    .toast-title {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: #f1f5f9;
    }

    .toast-msg {
      margin: 2px 0 0;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }

    .toast-close {
      flex-shrink: 0;
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: color 150ms ease;
      margin-top: 1px;
    }

    .toast-close:hover { color: #f1f5f9; }
  `],
})
export class ToastContainerComponent {
  constructor(public readonly toastService: ToastService) {}

  trackById = (_: number, item: Toast) => item.id;

  readonly icons: Record<ToastType, string> = {
    success: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 9l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="currentColor" stroke-width="1.4"/><path d="M6 6l6 6M12 6l-6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L16 14H2L9 2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 7v4M9 12.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    info: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="currentColor" stroke-width="1.4"/><path d="M9 8v5M9 6v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  };
}
