import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CompareResponse } from "@app/services/whatif.service";

// ── what-if-compare.component.ts ──────────────────────────────────────────────
@Component({
  selector:   'app-what-if-compare',
  standalone: true,
  imports:    [CommonModule,FormsModule ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wif-compare" *ngIf="comparison">
      <!-- Best action highlight -->
      <div class="wc-best" *ngIf="comparison.best_action">
        <span class="best-crown">🏆</span>
        <div class="best-info">
          <span class="best-label">{{ formatActionLabel(comparison.best_action) }}</span>
          <span class="best-sub">
            MTTR : {{ comparison.best_action.mttr_after }}min
            (−{{ comparison.best_action.mttr_reduction_pct }}%)
          </span>
        </div>
        <span class="best-conf"
              [ngClass]="comparison.best_action.confidence_label === 'HIGH' || comparison.best_action.confidence_label === 'HAUTE'
                         ? 'conf-high' : 'conf-med'">
          {{ comparison.best_action.confidence_label }}
        </span>
      </div>

      <div class="combined-plan"
           *ngIf="comparison.best_action?.action_id === 'combined_recovery'">
        <div class="cp-header">
          <span class="cp-title">Plan de récupération combiné</span>
          <span class="cp-gain">Gain estimé : {{ comparison.best_action?.mttr_reduction_pct }}%</span>
        </div>
        <div class="cp-steps">
          <div class="cp-step">
            <span class="cp-step-no">1</span>
            <div>
              <strong>Augmenter la capacité SMSC</strong>
              <p>Absorber le pic de trafic et réduire le risque de file pleine.</p>
            </div>
          </div>
          <div class="cp-step">
            <span class="cp-step-no">2</span>
            <div>
              <strong>Redémarrer les sessions SMPP instables</strong>
              <p>Rétablir les connexions SMPPS/SMPPC touchées par les timeouts.</p>
            </div>
          </div>
          <div class="cp-step">
            <span class="cp-step-no">3</span>
            <div>
              <strong>Ajuster retry et timeout</strong>
              <p>Limiter la tempête de retry et stabiliser la chaîne DMC - MMG.</p>
            </div>
          </div>
        </div>
        <div class="cp-recommendation" *ngIf="comparison.best_action?.recommendation">
          {{ comparison.best_action?.recommendation }}
        </div>
      </div>
 
      <!-- Baseline -->
      <div class="wc-baseline">
        Baseline MTTR : <strong>{{ comparison.incident_mttr_baseline }}min</strong>
        · {{ comparison.actions_compared }} actions comparées
      </div>
 
      <!-- Table -->
      <div class="wc-table">
        <div class="wct-header">
          <span>Action</span>
          <span>MTTR après</span>
          <span>Réduction</span>
          <span>Confiance</span>
          <span>Risque</span>
        </div>
        <div class="wct-row" *ngFor="let row of comparison.comparison_table; let i = index"
             [class.wct-best]="i === 0">
          <span class="wct-label">
            <span *ngIf="i === 0" class="row-crown">🏆</span>
            {{ formatActionLabel(row) }}
          </span>
          <span class="wct-mttr">{{ row.mttr_after }}<em>min</em></span>
          <div class="wct-bar-wrap">
            <div class="wct-bar">
              <div class="wct-fill"
                   [style.width.%]="row.mttr_reduction_pct"
                   [style.background]="row.mttr_reduction_pct > 50 ? '#22c55e'
                                     : row.mttr_reduction_pct > 30 ? '#3b82f6' : '#f59e0b'">
              </div>
            </div>
            <span class="wct-pct">{{ row.mttr_reduction_pct }}%</span>
          </div>
          <span class="wct-conf"
                [ngClass]="row.confidence_label === 'HIGH' || row.confidence_label === 'HAUTE'
                           ? 'conf-high' : 'conf-med'">
            {{ row.confidence_label }}
          </span>
          <span class="wct-risk" [ngClass]="'risk-' + row.risk_level.toLowerCase()">
            {{ row.risk_level }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .wif-compare { display:flex; flex-direction:column; gap:10px; animation:fade-up 300ms ease-out; }
    @keyframes fade-up { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
    .wc-best { display:flex; align-items:center; gap:10px; padding:10px 14px;
      border-radius:10px; background:rgba(34,197,94,.08); border:1px solid rgba(34,197,94,.2); }
    .best-crown { font-size:18px; flex-shrink:0; }
    .best-info  { flex:1; display:flex; flex-direction:column; }
    .best-label { font-size:13px; font-weight:600; color:var(--text-primary); }
    .best-sub   { font-size:11px; color:#22c55e; font-family:var(--font-mono); }
    .best-conf  { padding:3px 8px; border-radius:5px; font-size:11px; font-weight:700; flex-shrink:0; }
    .combined-plan { padding:12px 14px; border-radius:10px;
      background:rgba(14,165,233,.06); border:1px solid rgba(14,165,233,.18);
      display:flex; flex-direction:column; gap:10px; }
    .cp-header { display:flex; justify-content:space-between; align-items:center; gap:10px; }
    .cp-title { font-size:12px; font-weight:700; color:var(--text-primary); }
    .cp-gain { font-size:11px; font-family:var(--font-mono); color:#22c55e; font-weight:700; }
    .cp-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .cp-step { display:flex; gap:8px; padding:9px; border-radius:8px;
      background:var(--bg-card); border:1px solid var(--border-subtle); }
    .cp-step-no { width:20px; height:20px; border-radius:50%;
      background:rgba(14,165,233,.12); color:var(--accent,#0ea5e9);
      display:flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:700; flex-shrink:0; }
    .cp-step strong { display:block; font-size:11px; color:var(--text-primary); margin-bottom:3px; }
    .cp-step p { margin:0; font-size:10px; line-height:1.45; color:var(--text-muted); }
    .cp-recommendation { padding:8px 10px; border-radius:8px;
      background:rgba(34,197,94,.08); color:#16a34a; font-size:11px; line-height:1.45; }
    @media(max-width:900px) {
      .cp-steps { grid-template-columns:1fr; }
      .cp-header { align-items:flex-start; flex-direction:column; }
    }
    .conf-high  { background:rgba(34,197,94,.12); color:#22c55e; }
    .conf-med   { background:rgba(245,158,11,.12); color:#f59e0b; }
    .wc-baseline { font-size:12px; color:var(--text-muted); strong { color:var(--text-primary); } }
    .wc-table { border-radius:10px; overflow:hidden; border:1px solid var(--border-subtle); }
    .wct-header { display:grid; grid-template-columns:2fr 80px 1fr 90px 80px;
      gap:8px; padding:8px 12px; background:var(--bg-hover);
      font-size:10px; font-weight:700; letter-spacing:.07em; text-transform:uppercase;
      color:var(--text-muted); }
    .wct-row { display:grid; grid-template-columns:2fr 80px 1fr 90px 80px;
      gap:8px; padding:9px 12px; align-items:center;
      border-top:1px solid var(--border-subtle); transition:background 150ms; }
    .wct-row:hover  { background:var(--bg-hover); }
    .wct-best       { background:rgba(34,197,94,.04); }
    .wct-label { font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:5px; }
    .row-crown { font-size:13px; }
    .wct-mttr  { font-family:var(--font-mono); font-size:14px; font-weight:700;
      color:var(--text-primary); em { font-style:normal; font-size:11px; color:var(--text-muted); } }
    .wct-bar-wrap { display:flex; align-items:center; gap:6px; }
    .wct-bar  { flex:1; height:6px; background:var(--border-subtle); border-radius:3px; overflow:hidden; }
    .wct-fill { height:100%; border-radius:3px; transition:width .5s; }
    .wct-pct  { font-size:11px; font-family:var(--font-mono); color:var(--text-muted); min-width:32px; }
    .wct-conf  { padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; text-align:center; }
    .wct-risk  { padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; text-align:center; }
    .risk-low    { background:rgba(34,197,94,.1);  color:#22c55e; }
    .risk-medium { background:rgba(245,158,11,.1); color:#f59e0b; }
    .risk-high   { background:rgba(239,68,68,.1);  color:#ef4444; }
  `],
})
export class WhatIfCompareComponent {
  @Input() comparison: CompareResponse | null = null;

  formatActionLabel(row: { action_id: string; action_label: string }): string {
    if (row.action_id === 'combined_recovery') {
      return 'Plan de récupération combiné';
    }
    return row.action_label;
  }
}
 
