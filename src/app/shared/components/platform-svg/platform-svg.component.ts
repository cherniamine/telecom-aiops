import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input, OnChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: 'app-platform-svg',
  standalone: true,
  imports: [CommonModule,FormsModule ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none"
         [attr.aria-label]="platform + ' icon'" role="img">
 
      <!-- ── MMG — Mobile Messaging Gateway ───────────────────── -->
      <ng-container *ngIf="p === 'MMG'">
        <rect x="2" y="8" width="16" height="10" rx="2.5"
              [attr.stroke]="color" stroke-width="1.5" [attr.fill]="fill"/>
        <rect x="2" y="11" width="2.5" height="4" rx="1" [attr.fill]="color" opacity="0.5"/>
        <circle cx="6"  cy="13" r="1.2" [attr.fill]="color"/>
        <circle cx="9.5"  cy="13" r="1.2" [attr.fill]="color" opacity="0.55"/>
        <circle cx="13" cy="13" r="1.2" [attr.fill]="color" opacity="0.28"/>
        <rect x="14.5" y="11.5" width="3" height="3" rx="0.5"
              [attr.stroke]="color" stroke-width="1" fill="none"/>
        <line x1="19" y1="3" x2="19" y2="17" [attr.stroke]="color"
              stroke-width="1.5" stroke-linecap="round"/>
        <path d="M19 4L21.5 2" [attr.stroke]="color" stroke-width="1.4"
              stroke-linecap="round"/>
        <path d="M19 8L22 6" [attr.stroke]="color" stroke-width="1.4"
              stroke-linecap="round"/>
        <path d="M19 12L22 10" [attr.stroke]="color" stroke-width="1.3"
              stroke-linecap="round" opacity="0.6"/>
      </ng-container>
 
      <!-- ── SMSC — Short Message Service Center ──────────────── -->
      <ng-container *ngIf="p === 'SMSC'">
        <rect x="3" y="2" width="15" height="18" rx="2.5"
              [attr.stroke]="color" stroke-width="1.5" [attr.fill]="fill"/>
        <rect x="5.5" y="5"    width="10" height="2.5" rx="1"
              [attr.stroke]="color" stroke-width="1" fill="none"/>
        <rect x="5.5" y="9"    width="10" height="2.5" rx="1"
              [attr.stroke]="color" stroke-width="1" fill="none"/>
        <rect x="5.5" y="13"   width="10" height="2.5" rx="1"
              [attr.stroke]="color" stroke-width="1" fill="none"/>
        <circle cx="14.5" cy="6.25"  r="0.9" [attr.fill]="color"/>
        <circle cx="14.5" cy="10.25" r="0.9" [attr.fill]="color" opacity="0.5"/>
        <circle cx="14.5" cy="14.25" r="0.9" fill="#22c55e"/>
        <rect x="5.5" y="17" width="4" height="1.5" rx="0.5"
              [attr.fill]="color" opacity="0.3"/>
      </ng-container>
 
      <!-- ── SMPPS — SMPP Server (entrants) ───────────────────── -->
      <ng-container *ngIf="p === 'SMPPS'">
        <rect x="8" y="4" width="10" height="16" rx="2.5"
              [attr.stroke]="color" stroke-width="1.5" [attr.fill]="fill"/>
        <line x1="10" y1="8"  x2="16" y2="8"  [attr.stroke]="color"
              stroke-width="1.1" stroke-linecap="round"/>
        <line x1="10" y1="11" x2="16" y2="11" [attr.stroke]="color"
              stroke-width="1.1" stroke-linecap="round" opacity="0.6"/>
        <line x1="10" y1="14" x2="14" y2="14" [attr.stroke]="color"
              stroke-width="1.1" stroke-linecap="round" opacity="0.4"/>
        <circle cx="15.5" cy="17.5" r="1.2" [attr.fill]="color"/>
        <!-- Flèches entrantes -->
        <path d="M2 8h5M2 12h5M2 16h5" [attr.stroke]="color"
              stroke-width="1.3" stroke-linecap="round"/>
        <path d="M5.5 6.5l2.5 1.5-2.5 1.5" [attr.stroke]="color"
              stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5.5 10.5l2.5 1.5-2.5 1.5" [attr.stroke]="color"
              stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5.5 14.5l2.5 1.5-2.5 1.5" [attr.stroke]="color"
              stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </ng-container>
 
      <!-- ── SMPPC — SMPP Client (sortants) ───────────────────── -->
      <ng-container *ngIf="p === 'SMPPC'">
        <rect x="6" y="4" width="10" height="16" rx="2.5"
              [attr.stroke]="color" stroke-width="1.5" [attr.fill]="fill"/>
        <line x1="8"  y1="8"  x2="14" y2="8"  [attr.stroke]="color"
              stroke-width="1.1" stroke-linecap="round"/>
        <line x1="8"  y1="11" x2="14" y2="11" [attr.stroke]="color"
              stroke-width="1.1" stroke-linecap="round" opacity="0.6"/>
        <line x1="8"  y1="14" x2="12" y2="14" [attr.stroke]="color"
              stroke-width="1.1" stroke-linecap="round" opacity="0.4"/>
        <circle cx="13.5" cy="17.5" r="1.2" [attr.fill]="color"/>
        <!-- Flèches sortantes -->
        <path d="M17 8h5M17 12h5M17 16h5" [attr.stroke]="color"
              stroke-width="1.3" stroke-linecap="round"/>
        <path d="M18.5 6.5l2.5 1.5-2.5 1.5" [attr.stroke]="color"
              stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18.5 10.5l2.5 1.5-2.5 1.5" [attr.stroke]="color"
              stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18.5 14.5l2.5 1.5-2.5 1.5" [attr.stroke]="color"
              stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </ng-container>
 
      <!-- ── DMC — Digital Messaging Core ─────────────────────── -->
      <ng-container *ngIf="p === 'DMC'">
        <!-- Orbite externe pointillée -->
        <circle cx="12" cy="12" r="10" [attr.stroke]="color"
                stroke-width="1" stroke-dasharray="2.5 2" fill="none" opacity="0.35"/>
        <!-- Anneau intermédiaire -->
        <circle cx="12" cy="12" r="6.5" [attr.stroke]="color"
                stroke-width="1.5" [attr.fill]="fill"/>
        <!-- Nœud central plein -->
        <circle cx="12" cy="12" r="3" [attr.fill]="color" opacity="0.85"/>
        <circle cx="12" cy="12" r="1.4" fill="white" opacity="0.95"/>
        <!-- Rayons cardinaux -->
        <line x1="12" y1="5.5" x2="12" y2="9.5"
              [attr.stroke]="color" stroke-width="1.3" stroke-linecap="round"/>
        <line x1="12" y1="14.5" x2="12" y2="18.5"
              [attr.stroke]="color" stroke-width="1.3" stroke-linecap="round"/>
        <line x1="5.5"  y1="12" x2="9.5"  y2="12"
              [attr.stroke]="color" stroke-width="1.3" stroke-linecap="round"/>
        <line x1="14.5" y1="12" x2="18.5" y2="12"
              [attr.stroke]="color" stroke-width="1.3" stroke-linecap="round"/>
        <!-- Diagonales -->
        <line x1="7.9" y1="7.9" x2="9.9" y2="9.9"
              [attr.stroke]="color" stroke-width="1" stroke-linecap="round" opacity="0.45"/>
        <line x1="14.1" y1="14.1" x2="16.1" y2="16.1"
              [attr.stroke]="color" stroke-width="1" stroke-linecap="round" opacity="0.45"/>
        <line x1="16.1" y1="7.9" x2="14.1" y2="9.9"
              [attr.stroke]="color" stroke-width="1" stroke-linecap="round" opacity="0.45"/>
        <line x1="9.9" y1="14.1" x2="7.9" y2="16.1"
              [attr.stroke]="color" stroke-width="1" stroke-linecap="round" opacity="0.45"/>
      </ng-container>
 
    </svg>
  `,
  styles: [`:host { display:inline-flex; align-items:center; justify-content:center; }`],
})
export class PlatformSvgComponent implements OnChanges {
  @Input() platform!: string;
  @Input() size = 24;
 
  p     = '';
  color = '#64748b';
  fill  = 'rgba(148,163,184,.08)';
 
  private readonly META: Record<string, { color: string; fill: string }> = {
    MMG:   { color: '#d97706', fill: 'rgba(245,158,11,.08)' },
    SMSC:  { color: '#dc2626', fill: 'rgba(239,68,68,.08)'  },
    SMPPS: { color: '#2563eb', fill: 'rgba(59,130,246,.08)' },
    SMPPC: { color: '#4f46e5', fill: 'rgba(99,102,241,.08)' },
    DMC:   { color: '#16a34a', fill: 'rgba(34,197,94,.06)'  },
  };
 
  ngOnChanges(): void {
    this.p     = (this.platform ?? '').toUpperCase();
    const m    = this.META[this.p];
    this.color = m?.color ?? '#64748b';
    this.fill  = m?.fill  ?? 'rgba(148,163,184,.08)';
  }
}