import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { translateDashboardText } from '../../../core/utils/dashboard-i18n';

export type SeverityLevel =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'UNKNOWN';

interface SeverityConfig {
  bg: string;
  text: string;
  dot: string;
  label: string;
  pulse: boolean;
}

@Component({
  selector: 'app-severity-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [ngClass]="cfg.bg" [class.badge-sm]="resolvedSize === 'sm'" [class.badge-lg]="resolvedSize === 'lg'">
      <span class="dot" [ngClass]="cfg.dot" [class.pulse]="cfg.pulse"></span>
      <span [ngClass]="cfg.text">{{ displayLabel }}</span>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.07em;
      font-family: var(--font-mono, monospace);
      text-transform: uppercase;
      white-space: nowrap;
      transition: opacity 150ms ease;
    }

    .badge-sm { padding: 2px 6px; font-size: 10px; gap: 4px; }
    .badge-lg { padding: 5px 11px; font-size: 13px; }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .badge-lg .dot {
      width: 7px;
      height: 7px;
    }

    .pulse { animation: blink 1.2s ease-in-out infinite; }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.25; }
    }

    .bg-critical { background: rgba(239, 68, 68, 0.13); }
    .bg-high { background: rgba(245, 158, 11, 0.13); }
    .bg-medium { background: rgba(6, 182, 212, 0.14); }
    .bg-low { background: rgba(34, 197, 94, 0.12); }
    .bg-unknown { background: rgba(148, 163, 184, 0.1); }

    .text-critical { color: #ef4444; }
    .text-high { color: #f59e0b; }
    .text-medium { color: #06b6d4; }
    .text-low { color: #22c55e; }
    .text-unknown { color: #94a3b8; }

    .dot-critical { background: #ef4444; }
    .dot-high { background: #f59e0b; }
    .dot-medium { background: #06b6d4; }
    .dot-low { background: #22c55e; }
    .dot-unknown { background: #94a3b8; }
  `],
})
export class SeverityBadgeComponent implements OnChanges {
  @Input() severity = 'UNKNOWN';
  @Input() label = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large' = 'md';

  cfg: SeverityConfig = this.resolve('UNKNOWN');
  resolvedSize: 'sm' | 'md' | 'lg' = 'md';
  displayLabel = 'UNKNOWN';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['severity'] || changes['label'] || changes['size']) {
      const normalizedSeverity = this.normalizeSeverity(this.severity);
      this.cfg = this.resolve(normalizedSeverity);
      this.resolvedSize = this.normalizeSize(this.size);
      this.displayLabel = this.label
        ? translateDashboardText(this.label, this.label)
        : this.cfg.label;
    }
  }

  private normalizeSeverity(value: string): string {
    const normalized = (value ?? '').toUpperCase();

    if (normalized === 'MAJOR') return 'HIGH';
    if (normalized === 'MINOR') return 'LOW';
    if (normalized === 'OPEN' || normalized === 'NEW' || normalized === 'WAITING_HUMAN_VALIDATION') {
      return 'MEDIUM';
    }
    if (normalized === 'INCONNU') return 'UNKNOWN';

    return normalized || 'UNKNOWN';
  }

  private normalizeSize(value: string): 'sm' | 'md' | 'lg' {
    if (value === 'sm' || value === 'small') return 'sm';
    if (value === 'lg' || value === 'large') return 'lg';
    return 'md';
  }

  private resolve(severity: string): SeverityConfig {
    const map: Record<string, SeverityConfig> = {
      CRITICAL: { bg: 'bg-critical', text: 'text-critical', dot: 'dot-critical', label: 'CRITICAL', pulse: true },
      HIGH: { bg: 'bg-high', text: 'text-high', dot: 'dot-high', label: 'HIGH', pulse: true },
      MEDIUM: { bg: 'bg-medium', text: 'text-medium', dot: 'dot-medium', label: 'MEDIUM', pulse: false },
      LOW: { bg: 'bg-low', text: 'text-low', dot: 'dot-low', label: 'LOW', pulse: false },
    };

    return map[severity] ?? {
      bg: 'bg-unknown',
      text: 'text-unknown',
      dot: 'dot-unknown',
      label: severity || 'UNKNOWN',
      pulse: false,
    };
  }
}
