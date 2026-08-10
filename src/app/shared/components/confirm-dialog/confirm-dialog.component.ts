import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
} from '@angular/core';
import { AsyncPipe, CommonModule, NgIf } from '@angular/common';
import { Subject } from 'rxjs';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly configSubject = new Subject<(ConfirmDialogConfig & { resolve: (value: boolean) => void }) | null>();
  readonly config$ = this.configSubject.asObservable();

  confirm(config: ConfirmDialogConfig): Promise<boolean> {
    return new Promise((resolve) => {
      this.configSubject.next({ ...config, resolve });
    });
  }

  close(result: boolean, resolve: (value: boolean) => void): void {
    resolve(result);
    this.configSubject.next(null);
  }
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="dialogService.config$ | async as cfg">
      <div class="backdrop" (click)="dialogService.close(false, cfg.resolve)"></div>

      <div class="dialog" role="dialog" [attr.aria-label]="cfg.title">
        <div class="dialog-header">
          <h3 class="dialog-title">{{ cfg.title }}</h3>
        </div>
        <div class="dialog-body">
          <p class="dialog-message">{{ cfg.message }}</p>
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" type="button" (click)="dialogService.close(false, cfg.resolve)">
            {{ cfg.cancelText ?? 'Annuler' }}
          </button>
          <button class="btn-confirm" type="button" [ngClass]="{ 'btn-danger': cfg.danger }"
                  (click)="dialogService.close(true, cfg.resolve)">
            {{ cfg.confirmText ?? 'Confirmer' }}
          </button>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
      :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none; /* 🔥 Important : ne bloque pas les clics quand caché */
    }

    :host:has(.backdrop) {
      pointer-events: auto; /* Réactive quand le dialogue est visible */
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(2px);
      pointer-events: auto;
    }

    .dialog {
      position: relative;
      z-index: 1;
      background: var(--bg-card, #fff);
      border: 1px solid var(--border-subtle, #e2e8f0);
      border-radius: 14px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: pop-in 180ms ease-out;
    }

    @keyframes pop-in {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .dialog-header { padding: 20px 20px 0; }

    .dialog-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary, #0f172a);
    }

    .dialog-body { padding: 12px 20px; }

    .dialog-message {
      margin: 0;
      font-size: 14px;
      color: var(--text-secondary, #334155);
      line-height: 1.6;
    }

    .dialog-footer {
      padding: 14px 20px 20px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    button {
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: opacity 150ms ease;
    }

    button:hover { opacity: 0.85; }

    .btn-cancel {
      background: var(--bg-hover, rgba(0, 0, 0, 0.05));
      color: var(--text-secondary, #334155);
      border: 1px solid var(--border-subtle, #e2e8f0);
    }

    .btn-confirm {
      background: var(--accent, #0ea5e9);
      color: #fff;
    }

    .btn-danger { background: #ef4444; }
  `],
})
export class ConfirmDialogComponent {
  constructor(public readonly dialogService: ConfirmDialogService) {}
}
