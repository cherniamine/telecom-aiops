import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
} from '@angular/core';
import { CommonModule, NgIf, NgClass } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AppIconComponent } from '../app-icon/app-icon.component';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, NgIf, NgClass, AppIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stat-card" [ngClass]="accentClass">
      <div class="sc-header">
        <span class="sc-label">{{ resolvedLabel }}</span>

        <span class="sc-icon" *ngIf="iconIsSvg; else iconNameTpl" [innerHTML]="safeIcon"></span>
        <ng-template #iconNameTpl>
          <app-icon *ngIf="icon" class="sc-icon sc-icon--glyph" [name]="icon" [size]="16" [strokeWidth]="1.7"></app-icon>
        </ng-template>
      </div>

      <div class="sc-value">
        <span class="sc-number" [ngClass]="valueColorClass">{{ formattedValue }}</span>
        <span class="sc-unit" *ngIf="unit">{{ unit }}</span>
      </div>

      <div class="sc-footer" *ngIf="trend !== null || resolvedSubtitle">
        <span class="sc-subtitle" *ngIf="resolvedSubtitle">{{ resolvedSubtitle }}</span>
        <span class="sc-trend" *ngIf="trend !== null" [ngClass]="trendClass">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path [attr.d]="trendArrow" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ trendLabel }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .stat-card {
      background: var(--bg-card, rgba(15, 23, 42, 0.92));
      border: 1px solid var(--border-subtle, rgba(148, 163, 184, 0.18));
      border-radius: 12px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: box-shadow 200ms ease, transform 200ms ease;
      position: relative;
      overflow: hidden;
      min-height: 132px;
    }

    .stat-card:hover {
      box-shadow: 0 12px 32px rgba(2, 6, 23, 0.22);
      transform: translateY(-1px);
    }

    .stat-card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 12px;
      bottom: 12px;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: var(--accent-bar, transparent);
    }

    .accent-red { --accent-bar: #ef4444; }
    .accent-amber { --accent-bar: #f59e0b; }
    .accent-blue { --accent-bar: #3b82f6; }
    .accent-green { --accent-bar: #22c55e; }
    .accent-violet { --accent-bar: #a78bfa; }
    .accent-cyan { --accent-bar: #06b6d4; }

    .sc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .sc-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--text-muted, #94a3b8);
    }

    .sc-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted, #94a3b8);
      opacity: 0.78;
      flex-shrink: 0;
    }

    .sc-icon--glyph {
      width: 18px;
      height: 18px;
    }

    .sc-value {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .sc-number {
      font-family: var(--font-mono, monospace);
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1;
      color: var(--text-primary, #f8fafc);
    }

    .sc-unit {
      font-size: 13px;
      color: var(--text-muted, #94a3b8);
    }

    .val-red { color: #ef4444 !important; }
    .val-amber { color: #f59e0b !important; }
    .val-green { color: #22c55e !important; }
    .val-blue { color: #3b82f6 !important; }
    .val-violet { color: #a78bfa !important; }
    .val-cyan { color: #06b6d4 !important; }

    .sc-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-top: 2px;
    }

    .sc-subtitle {
      font-size: 11px;
      color: var(--text-muted, #94a3b8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sc-trend {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }

    .trend-up { color: #22c55e; }
    .trend-down { color: #ef4444; }
    .trend-flat { color: var(--text-muted, #94a3b8); }
  `],
})
export class StatCardComponent implements OnChanges {
  @Input() title = '';
  @Input() label = '';
  @Input() value: string | number = '0';
  @Input() unit?: string;
  @Input() subtitle?: string;
  @Input() detail = '';
  @Input() trend?: number | null = null;
  @Input() trendText?: string;
  @Input() icon = '';
  @Input() accent: 'red' | 'amber' | 'blue' | 'green' | 'violet' | 'cyan' | 'none' = 'none';
  @Input() valueColor: 'default' | 'red' | 'amber' | 'green' | 'blue' | 'violet' | 'cyan' = 'default';
  @Input() format: 'number' | 'pct' | 'raw' = 'number';
  @Input() tone = 'neutral';

  formattedValue = '';
  resolvedLabel = '';
  resolvedSubtitle = '';
  accentClass = '';
  valueColorClass = '';
  trendClass = 'trend-flat';
  trendArrow = 'M3 6h6';
  trendLabel = '';
  safeIcon: SafeHtml | null = null;
  iconIsSvg = false;

  constructor(private readonly sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    this.resolvedLabel = this.label || this.title;
    this.resolvedSubtitle = this.subtitle || this.detail;
    this.formattedValue = this.formatValue();
    this.resolveAccent();
    this.resolveTrend();
    this.resolveIcon();
  }

  private formatValue(): string {
    if (this.format === 'raw') return String(this.value);
    if (this.format === 'pct') return `${this.value}%`;

    const n = Number(this.value);
    if (Number.isNaN(n)) return String(this.value);

    return n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
        : String(n);
  }

  private resolveAccent(): void {
    const mappedAccent = this.accent !== 'none'
      ? this.accent
      : this.mapToneToAccent(this.tone);

    this.accentClass = mappedAccent !== 'none' ? `accent-${mappedAccent}` : '';
    this.valueColorClass = this.valueColor !== 'default'
      ? `val-${this.valueColor}`
      : this.mapToneToValueColor(this.tone);
  }

  private resolveTrend(): void {
    if (this.trend === null || this.trend === undefined) {
      this.trendLabel = '';
      return;
    }

    if (this.trend > 0) {
      this.trendClass = 'trend-up';
      this.trendArrow = 'M6 8V4M4 6l2-2 2 2';
      this.trendLabel = this.trendText ?? `+${this.trend}%`;
      return;
    }

    if (this.trend < 0) {
      this.trendClass = 'trend-down';
      this.trendArrow = 'M6 4v4M4 6l2 2 2-2';
      this.trendLabel = this.trendText ?? `${this.trend}%`;
      return;
    }

    this.trendClass = 'trend-flat';
    this.trendArrow = 'M3 6h6';
    this.trendLabel = this.trendText ?? '0%';
  }

  private resolveIcon(): void {
    const raw = (this.icon ?? '').trim();
    this.iconIsSvg = raw.startsWith('<svg');
    this.safeIcon = this.iconIsSvg ? this.sanitizer.bypassSecurityTrustHtml(raw) : null;
  }

  private mapToneToAccent(tone: string): 'red' | 'amber' | 'blue' | 'green' | 'violet' | 'cyan' | 'none' {
    switch ((tone ?? '').toLowerCase()) {
      case 'critical':
        return 'red';
      case 'warning':
        return 'amber';
      case 'info':
        return 'blue';
      case 'success':
        return 'green';
      case 'accent':
        return 'violet';
      default:
        return 'none';
    }
  }

  private mapToneToValueColor(tone: string): string {
    switch ((tone ?? '').toLowerCase()) {
      case 'critical':
        return 'val-red';
      case 'warning':
        return 'val-amber';
      case 'info':
        return 'val-blue';
      case 'success':
        return 'val-green';
      case 'accent':
        return 'val-violet';
      default:
        return '';
    }
  }
}
