import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="spinner-wrap" [ngClass]="'mode-' + mode" [style.min-height]="minHeight">
      <div class="spinner" [ngClass]="'sz-' + size">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="var(--border-subtle, #e2e8f0)" stroke-width="2.5"/>
          <path d="M12 3a9 9 0 0 1 9 9" stroke="var(--accent, #0ea5e9)" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
      <span class="spinner-label" *ngIf="label">{{ label }}</span>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .spinner-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .mode-overlay {
      position: absolute;
      inset: 0;
      background: rgba(var(--bg-page-rgb, 10, 15, 26), 0.8);
      z-index: 50;
      border-radius: inherit;
    }

    .mode-inline { padding: 24px 0; }

    .spinner svg {
      animation: spin 0.75s linear infinite;
      display: block;
    }

    .sz-sm svg { width: 20px; height: 20px; }
    .sz-md svg { width: 28px; height: 28px; }
    .sz-lg svg { width: 40px; height: 40px; }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .spinner-label {
      font-size: 12px;
      color: var(--text-muted, #64748b);
      letter-spacing: 0.02em;
    }
  `],
})
export class LoadingSpinnerComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() mode: 'inline' | 'overlay' = 'inline';
  @Input() label = 'Chargement...';
  @Input() minHeight = '';
}
