import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';

@Component({
  selector: 'app-timeline-step',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="timeline" [class.vertical]="direction === 'vertical'">
      <ng-container *ngFor="let step of steps; let i = index; let last = last">
        <div class="step" [ngClass]="'step-' + getStepStatus(i)" [title]="step">
          <div class="step-dot">
            <svg *ngIf="getStepStatus(i) === 'done'" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span *ngIf="getStepStatus(i) === 'active'" class="pulse-dot"></span>
          </div>
          <span class="step-label" [ngClass]="'platform-' + step.toLowerCase()">{{ step }}</span>
          <span class="step-idx" *ngIf="showIndex">{{ i + 1 }}</span>
        </div>

        <div class="connector" *ngIf="!last" [ngClass]="'conn-' + getConnectorStatus(i)">
          <div class="conn-line"></div>
          <svg class="conn-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path [attr.d]="direction === 'vertical' ? 'M5 2v6M3 6l2 2 2-2' : 'M2 5h6M6 3l2 2-2 2'"
                  stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .timeline {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0;
    }

    .timeline.vertical {
      flex-direction: column;
      align-items: flex-start;
    }

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      position: relative;
      cursor: default;
    }

    .timeline.vertical .step {
      flex-direction: row;
      gap: 10px;
    }

    .step-dot {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid var(--border-subtle, #e2e8f0);
      background: var(--bg-card, #fff);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      transition: all 200ms ease;
      position: relative;
    }

    .step-done .step-dot {
      background: rgba(34, 197, 94, 0.15);
      border-color: #22c55e;
      color: #22c55e;
    }

    .step-active .step-dot {
      background: rgba(239, 68, 68, 0.12);
      border-color: #ef4444;
      box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.1);
    }

    .step-pending .step-dot { opacity: 0.5; }

    .step-warning .step-dot {
      background: rgba(245, 158, 11, 0.12);
      border-color: #f59e0b;
      color: #f59e0b;
    }

    .step-label {
      font-size: 11px;
      font-weight: 600;
      font-family: var(--font-mono, monospace);
      letter-spacing: 0.05em;
    }

    .platform-mmg { color: #d97706; }
    .platform-smsc { color: #dc2626; }
    .platform-smpps { color: #2563eb; }
    .platform-smppc { color: #4f46e5; }
    .platform-dmc { color: #16a34a; }

    .step-idx {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--accent, #0ea5e9);
      color: #fff;
      font-size: 8px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      animation: pulse-step 1.5s ease-in-out infinite;
    }

    @keyframes pulse-step {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.4); opacity: 0.6; }
    }

    .connector {
      display: flex;
      align-items: center;
      padding: 0 4px;
      color: var(--border-default, #cbd5e1);
      position: relative;
    }

    .timeline.vertical .connector {
      flex-direction: column;
      padding: 4px 0 4px 14px;
    }

    .conn-line {
      flex: 1;
      height: 1.5px;
      background: currentColor;
      min-width: 20px;
    }

    .timeline.vertical .conn-line {
      width: 1.5px;
      min-width: 0;
      height: 20px;
      min-height: 20px;
      flex: none;
    }

    .conn-arrow { flex-shrink: 0; }

    .conn-active { color: #ef4444; }
    .conn-done { color: #22c55e; }
    .conn-pending { color: var(--border-subtle, #e2e8f0); }
  `],
})
export class TimelineStepComponent {
  @Input() steps: string[] = [];
  @Input() activeIndex = -1;
  @Input() direction: 'horizontal' | 'vertical' = 'horizontal';
  @Input() showIndex = false;

  getStepStatus(index: number): 'done' | 'active' | 'warning' | 'pending' {
    if (this.activeIndex < 0) return 'done';
    if (index < this.activeIndex) return 'done';
    if (index === this.activeIndex) return 'active';
    return 'pending';
  }

  getConnectorStatus(index: number): 'done' | 'active' | 'pending' {
    if (this.activeIndex < 0) return 'done';
    if (index < this.activeIndex) return 'done';
    if (index === this.activeIndex) return 'active';
    return 'pending';
  }
}
