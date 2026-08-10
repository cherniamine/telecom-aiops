// ═══════════════════════════════════════════════════════════════════════════════
// DRIFT MONITOR COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
 
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { DriftService, DriftOverview } from '../../services/drift.service';
import { CommonModule } from '@angular/common';
 
// ── drift-overview.component.ts ──────────────────────────────────────────────
@Component({
  selector:   'app-drift-overview',
  standalone: true,
  imports:    [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="drift-card" [ngClass]="'drift-' + severity.toLowerCase()">
      <div class="dc-top">
        <div class="dc-badge-wrap">
          <span class="dc-badge" [ngClass]="badgeClass">{{ severity }}</span>
          <span class="dc-pulse" *ngIf="severity === 'CRITICAL' || severity === 'HIGH'"></span>
        </div>
        <span class="dc-title">Drift du modèle</span>
        <button class="dc-refresh" (click)="load()" [disabled]="loading" title="Actualiser">
          <svg [class.spin]="loading" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M11 6.5A4.5 4.5 0 112 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M2 1.5v3h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
 
      <div class="dc-verdict" *ngIf="overview?.latest_report?.verdict">
        {{ overview!.latest_report!.verdict }}
      </div>
      <div class="dc-baseline" *ngIf="severity === 'BASELINE_ONLY' || severity === 'UNKNOWN'">
        Référence disponible · Aucune analyse lancée
      </div>
 
      <!-- Drift score bar -->
      <div class="dc-score-bar" *ngIf="driftScore > 0">
        <span class="dsb-label">Score</span>
        <div class="dsb-track">
          <div class="dsb-fill" [style.width.%]="driftScore * 25"
               [style.background]="driftColor">
          </div>
        </div>
        <span class="dsb-val">{{ driftScore }}/4</span>
      </div>
 
      <!-- Drifted tests -->
      <div class="dc-tests" *ngIf="driftedTests.length">
        <span class="dct-label">Tests en drift :</span>
        <span class="dct-test" *ngFor="let t of driftedTests">{{ t }}</span>
      </div>
 
      <!-- Retrain needed -->
      <div class="dc-retrain" *ngIf="overview?.latest_report?.retrain_required">
        <span class="dcr-icon">🔴</span>
        <span>Ré-entraînement requis</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .drift-card { padding:12px 14px; border-radius:10px;
      border:1px solid var(--border-subtle); background:var(--bg-card);
      display:flex; flex-direction:column; gap:8px; }
    .drift-critical { border-color:rgba(239,68,68,.3); background:rgba(239,68,68,.03); }
    .drift-high     { border-color:rgba(245,158,11,.3); }
    .drift-medium   { border-color:rgba(59,130,246,.2); }
    .drift-none,.drift-low,.drift-baseline_only,.drift-unknown { }
    .dc-top { display:flex; align-items:center; gap:8px; }
    .dc-badge-wrap { display:flex; align-items:center; gap:4px; position:relative; }
    .dc-badge { padding:3px 8px; border-radius:5px; font-size:11px; font-weight:700;
      font-family:var(--font-mono); letter-spacing:.05em; }
    .dc-pulse { width:7px; height:7px; border-radius:50%; background:#ef4444;
      animation:blink .8s ease-in-out infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
    .dc-title { font-size:12px; font-weight:600; color:var(--text-primary); }
    .dc-refresh { margin-left:auto; background:none; border:none; cursor:pointer;
      color:var(--text-muted); padding:3px; border-radius:4px;
      &:hover { background:var(--bg-hover); } &:disabled { opacity:.4; cursor:wait; } }
    .spin { animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .dc-verdict  { font-size:12px; color:var(--text-secondary); }
    .dc-baseline { font-size:11px; color:var(--text-muted); font-style:italic; }
    .dc-score-bar { display:flex; align-items:center; gap:7px; }
    .dsb-label { font-size:10px; color:var(--text-muted); min-width:35px; }
    .dsb-track { flex:1; height:5px; background:var(--border-subtle); border-radius:3px; overflow:hidden; }
    .dsb-fill  { height:100%; border-radius:3px; transition:width .5s; }
    .dsb-val   { font-family:var(--font-mono); font-size:11px; color:var(--text-muted); min-width:24px; }
    .dc-tests  { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
    .dct-label { font-size:10px; color:var(--text-muted); }
    .dct-test  { font-size:10px; padding:1px 6px; border-radius:3px;
      background:rgba(239,68,68,.1); color:#ef4444; font-family:var(--font-mono); }
    .dc-retrain { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:600; color:#ef4444; }
 
    /* Badge color by severity */
    :host ::ng-deep .drift-none     .dc-badge { background:rgba(34,197,94,.1);  color:#22c55e; }
    :host ::ng-deep .drift-low      .dc-badge { background:rgba(59,130,246,.1); color:#3b82f6; }
    :host ::ng-deep .drift-medium   .dc-badge { background:rgba(245,158,11,.1); color:#f59e0b; }
    :host ::ng-deep .drift-high     .dc-badge { background:rgba(239,68,68,.1);  color:#ef4444; }
    :host ::ng-deep .drift-critical .dc-badge { background:rgba(239,68,68,.15); color:#dc2626; }
    :host ::ng-deep .drift-unknown,.drift-baseline_only .dc-badge { background:rgba(148,163,184,.1); color:#64748b; }
  `],
})
export class DriftOverviewComponent implements OnInit {
  overview:     DriftOverview | null = null;
  severity      = 'UNKNOWN';
  driftScore    = 0;
  driftedTests: string[] = [];
  driftColor    = '#94a3b8';
  badgeClass    = '';
  loading       = false;
 
  constructor(private drift: DriftService, private cdr: ChangeDetectorRef) {}
 
  ngOnInit(): void { this.load(); }
 
  load(): void {
    this.loading = true;
    this.drift.getOverview().subscribe({
      next: d => {
        this.overview     = d;
        this.severity     = d.status ?? 'UNKNOWN';
        this.driftScore   = (d.latest_report as any)?.drift_score ?? 0;
        this.driftedTests = (d.latest_report as any)?.drifted_tests ?? [];
        this.driftColor   = this.driftScore >= 3 ? '#ef4444' : this.driftScore >= 2 ? '#f59e0b' : '#22c55e';
        this.loading      = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }
}
 