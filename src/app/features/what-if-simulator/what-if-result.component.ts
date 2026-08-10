import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SimulationResult } from "@app/services/whatif.service";

// ── what-if-result.component.ts ───────────────────────────────────────────────
@Component({
  selector:   'app-what-if-result',
  standalone: true,
  imports:    [CommonModule,FormsModule ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wif-result" *ngIf="result">
      <div class="wr-action-label">{{ result.action_label }}</div>
 
      <!-- Before / After -->
      <div class="wr-comparison">
        <div class="wr-before">
          <span class="wrc-label">AVANT</span>
          <span class="wrc-mttr">{{ result.before.mttr_minutes }}<em>min</em></span>
          <span class="wrc-sev sev-critical">{{ result.before.severity }}</span>
        </div>
        <div class="wr-arrow">
          <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
            <path d="M0 10h32M26 4l6 6-6 6" stroke="var(--accent)" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="wr-pct" [ngClass]="result.after.mttr_reduction_pct > 40 ? 'pct-great' : 'pct-ok'">
            −{{ result.after.mttr_reduction_pct }}%
          </span>
        </div>
        <div class="wr-after">
          <span class="wrc-label">APRÈS</span>
          <span class="wrc-mttr after-mttr">{{ result.after.mttr_minutes }}<em>min</em></span>
          <span class="wrc-sev" [ngClass]="'sev-' + result.after.expected_severity.toLowerCase()">
            {{ result.after.expected_severity }}
          </span>
        </div>
      </div>
 
      <!-- MTTR reduction bar -->
      <div class="wr-bar-wrap">
        <span class="wrb-label">Réduction MTTR</span>
        <div class="wrb-track">
          <div class="wrb-fill"
               [style.width.%]="result.after.mttr_reduction_pct"
               [style.background]="result.after.mttr_reduction_pct > 50 ? '#22c55e'
                                 : result.after.mttr_reduction_pct > 30 ? '#3b82f6' : '#f59e0b'">
          </div>
        </div>
        <span class="wrb-saved">−{{ result.after.mttr_reduction }} min économisées</span>
      </div>
 
      <!-- Stats row -->
      <div class="wr-stats">
        <div class="wrs-item">
          <span class="wrsi-val">{{ result.after.anomaly_reduction_pct.toFixed(0) }}%</span>
          <span class="wrsi-lbl">réduction anomalies</span>
        </div>
        <div class="wrs-item">
          <span class="wrsi-val">+{{ result.after.sms_recovery_pct.toFixed(0) }}%</span>
          <span class="wrsi-lbl">récupération SMS</span>
        </div>
        <div class="wrs-item">
          <span class="wrsi-val conf-badge"
                [ngClass]="result.confidence_label === 'HIGH' || result.confidence_label === 'HAUTE'
                           ? 'conf-high' : 'conf-med'">
            {{ result.confidence_label }}
          </span>
          <span class="wrsi-lbl">confiance</span>
        </div>
        <div class="wrs-item">
          <span class="wrsi-val risk-badge"
                [ngClass]="'risk-' + result.risk_level.toLowerCase()">
            {{ result.risk_level }}
          </span>
          <span class="wrsi-lbl">risque</span>
        </div>
      </div>
 
      <!-- Recommendation -->
      <div class="wr-recommendation" [ngClass]="'rec-' + result.risk_level.toLowerCase()">
        {{ result.recommendation }}
      </div>
 
      <!-- Risks -->
      <div class="wr-risks" *ngIf="result.risks.length">
        <div class="wr-risk" *ngFor="let r of result.risks">
          <span class="risk-level" [ngClass]="'rl-' + r.level.toLowerCase()">{{ r.level }}</span>
          <span class="risk-desc">{{ r.description }}</span>
          <span class="risk-mitigation">→ {{ r.mitigation }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .wif-result { display:flex; flex-direction:column; gap:12px; animation:fade-up 300ms ease-out; }
    @keyframes fade-up { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
    .wr-action-label { font-size:14px; font-weight:600; color:var(--text-primary); }
    .wr-comparison { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .wr-before,.wr-after { display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; }
    .wrc-label { font-size:10px; font-weight:700; letter-spacing:.1em; color:var(--text-muted); }
    .wrc-mttr  { font-family:var(--font-mono); font-size:28px; font-weight:700;
      color:var(--text-primary); em { font-style:normal; font-size:14px; color:var(--text-muted); } }
    .after-mttr { color:#22c55e; }
    .wrc-sev { padding:2px 7px; border-radius:4px; font-size:11px; font-weight:700; }
    .sev-critical { background:rgba(239,68,68,.1);  color:#dc2626; }
    .sev-high     { background:rgba(245,158,11,.1); color:#d97706; }
    .sev-medium   { background:rgba(59,130,246,.1); color:#2563eb; }
    .wr-arrow { display:flex; flex-direction:column; align-items:center; gap:3px; flex-shrink:0; }
    .wr-pct   { font-family:var(--font-mono); font-size:13px; font-weight:700; }
    .pct-great { color:#22c55e; }
    .pct-ok    { color:#3b82f6; }
    .wr-bar-wrap { display:flex; align-items:center; gap:8px; }
    .wrb-label { font-size:11px; color:var(--text-muted); min-width:110px; }
    .wrb-track { flex:1; height:8px; background:var(--border-subtle); border-radius:4px; overflow:hidden; }
    .wrb-fill  { height:100%; border-radius:4px; transition:width .7s ease; }
    .wrb-saved { font-size:11px; color:#22c55e; font-weight:600; white-space:nowrap; }
    .wr-stats  { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
    .wrs-item  { display:flex; flex-direction:column; align-items:center; gap:3px;
      padding:8px; border-radius:8px; background:var(--bg-hover); }
    .wrsi-val  { font-family:var(--font-mono); font-size:14px; font-weight:700; color:var(--text-primary); }
    .wrsi-lbl  { font-size:10px; color:var(--text-faint); text-align:center; }
    .conf-badge,.risk-badge { padding:2px 6px; border-radius:4px; font-size:11px; }
    .conf-high { background:rgba(34,197,94,.1);  color:#22c55e; }
    .conf-med  { background:rgba(245,158,11,.1); color:#f59e0b; }
    .risk-low    { background:rgba(34,197,94,.1);  color:#22c55e; }
    .risk-medium { background:rgba(245,158,11,.1); color:#f59e0b; }
    .risk-high   { background:rgba(239,68,68,.1);  color:#ef4444; }
    .wr-recommendation { padding:8px 12px; border-radius:8px; font-size:12px; color:var(--text-secondary);
      border:1px solid transparent; }
    .rec-low    { background:rgba(34,197,94,.06);  border-color:rgba(34,197,94,.2); }
    .rec-medium { background:rgba(245,158,11,.06); border-color:rgba(245,158,11,.2); }
    .rec-high   { background:rgba(239,68,68,.06);  border-color:rgba(239,68,68,.2); }
    .wr-risks   { display:flex; flex-direction:column; gap:5px; }
    .wr-risk    { display:flex; align-items:center; gap:8px; font-size:11px; flex-wrap:wrap; }
    .risk-level { padding:1px 5px; border-radius:3px; font-size:10px; font-weight:700; }
    .rl-low    { background:rgba(34,197,94,.1);  color:#22c55e; }
    .rl-medium { background:rgba(245,158,11,.1); color:#f59e0b; }
    .rl-high   { background:rgba(239,68,68,.1);  color:#ef4444; }
    .risk-desc { color:var(--text-secondary); flex:1; }
    .risk-mitigation { color:var(--text-muted); font-style:italic; }
  `],
})
export class WhatIfResultComponent {
  @Input() result: SimulationResult | null = null;
}