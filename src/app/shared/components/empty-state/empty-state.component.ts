import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" [style.min-height]="minHeight">
      <div class="empty-icon" *ngIf="safeIcon; else defaultIcon" [innerHTML]="safeIcon"></div>

      <ng-template #defaultIcon>
        <div class="empty-icon default-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="17" stroke="var(--border-default, #cbd5e1)" stroke-width="1.5" stroke-dasharray="4 3"/>
            <path d="M14 20h12M20 14v12" stroke="var(--border-default, #cbd5e1)" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
      </ng-template>

      <p class="empty-title">{{ title }}</p>
      <p class="empty-desc" *ngIf="description">{{ description }}</p>
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 40px 24px;
      text-align: center;
    }

    .empty-icon {
      color: var(--text-faint, #94a3b8);
      opacity: 0.8;
    }

    .empty-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-secondary, #334155);
      margin: 0;
    }

    .empty-desc {
      font-size: 12px;
      color: var(--text-muted, #64748b);
      max-width: 280px;
      line-height: 1.6;
      margin: 0;
    }
  `],
})
export class EmptyStateComponent {
  @Input() title = 'Aucune donnée';
  @Input() description = '';
  @Input() minHeight = '180px';

  safeIcon: SafeHtml | null = null;

  constructor(private readonly sanitizer: DomSanitizer) {}

  @Input() set icon(value: string | undefined) {
    this.safeIcon = value
      ? this.sanitizer.bypassSecurityTrustHtml(value)
      : null;
  }
}
