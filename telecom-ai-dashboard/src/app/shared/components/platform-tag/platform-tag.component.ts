import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

type TagSize = 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large';

@Component({
  selector: 'app-platform-tag',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="tag" [ngClass]="[colorClass, sizeClass]" [title]="description">
      {{ label }}
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }

    .tag {
      display: inline-flex;
      align-items: center;
      padding: 2px 7px;
      border-radius: 4px;
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.07em;
      white-space: nowrap;
      cursor: default;
    }

    .tag-sm { padding: 1px 5px; font-size: 10px; }
    .tag-lg { padding: 3px 9px; font-size: 13px; }

    .tag-mmg { background: rgba(245, 158, 11, 0.14); color: #d97706; }
    .tag-smsc { background: rgba(239, 68, 68, 0.14); color: #dc2626; }
    .tag-smpps { background: rgba(59, 130, 246, 0.14); color: #2563eb; }
    .tag-smppc { background: rgba(99, 102, 241, 0.14); color: #4f46e5; }
    .tag-dmc { background: rgba(34, 197, 94, 0.14); color: #16a34a; }
    .tag-other { background: rgba(148, 163, 184, 0.12); color: #64748b; }
  `],
})
export class PlatformTagComponent implements OnChanges {
  @Input() platform = '';
  @Input() size: TagSize = 'md';

  label = '';
  colorClass = 'tag-other';
  sizeClass = '';
  description = '';

  private readonly platformMeta: Record<string, { label: string; desc: string; cls: string }> = {
    mmg: { label: 'MMG', desc: 'Mobile Messaging Gateway', cls: 'tag-mmg' },
    smsc: { label: 'SMSC', desc: 'Short Message Service Center', cls: 'tag-smsc' },
    smpps: { label: 'SMPPS', desc: 'SMPP Server', cls: 'tag-smpps' },
    smppc: { label: 'SMPPC', desc: 'SMPP Client', cls: 'tag-smppc' },
    dmc: { label: 'DMC', desc: 'Digital Messaging Core', cls: 'tag-dmc' },
  };

  ngOnChanges(): void {
    const key = (this.platform ?? '').toLowerCase();
    const meta = this.platformMeta[key];

    this.label = meta?.label ?? (this.platform ? this.platform.toUpperCase() : '?');
    this.colorClass = meta?.cls ?? 'tag-other';
    this.description = meta?.desc ?? '';
    this.sizeClass = this.size === 'sm' || this.size === 'small'
      ? 'tag-sm'
      : this.size === 'lg' || this.size === 'large'
        ? 'tag-lg'
        : '';
  }
}
