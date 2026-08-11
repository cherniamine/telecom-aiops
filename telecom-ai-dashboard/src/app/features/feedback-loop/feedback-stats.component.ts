import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { FeedbackService, FeedbackStats } from "@app/services/feedback.service";

// ── feedback-stats.component.ts ──────────────────────────────────────────────
@Component({
  selector:   'app-feedback-stats',
  standalone: true,
  imports:    [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fs-card" *ngIf="stats">
      <div class="fs-top">
        <span class="fs-title">Qualité du modèle</span>
        <span class="fs-total">{{ stats.total_feedbacks }} feedbacks</span>
      </div>
 
      <!-- Precision gauge -->
      <div class="fs-gauge-wrap">
        <span class="fg-label">Précision</span>
        <div class="fg-track">
          <div class="fg-fill"
               [style.width]="stats.precision_pct"
               [style.background]="precisionColor">
          </div>
        </div>
        <span class="fg-val" [style.color]="precisionColor">{{ stats.precision_pct }}</span>
      </div>
 
      <!-- TP/FP breakdown -->
      <div class="fs-breakdown">
        <div class="fsb-item tp">
          <span class="fsbi-count">{{ stats.true_positives }}</span>
          <span class="fsbi-label">✅ Vrais positifs</span>
        </div>
        <div class="fsb-item fp">
          <span class="fsbi-count">{{ stats.false_positives }}</span>
          <span class="fsbi-label">❌ Faux positifs</span>
        </div>
        <div class="fsb-item un">
          <span class="fsbi-count">{{ stats.uncertain }}</span>
          <span class="fsbi-label">❓ Incertains</span>
        </div>
      </div>
 
      <!-- Retrain progress -->
      <div class="fs-retrain">
        <div class="fsr-bar-wrap">
          <div class="fsr-bar">
            <div class="fsr-fill"
                 [style.width.%]="retrainPct"
                 [class.fsr-ready]="stats.retrain_ready">
            </div>
          </div>
          <span class="fsr-count">{{ stats.unused_for_training }} / {{ stats.retrain_threshold }}</span>
        </div>
        <span class="fsr-label"
              [ngClass]="stats.retrain_ready ? 'fsr-rdy' : 'fsr-wait'">
          {{ stats.retrain_ready ? '🔄 Prêt pour ré-entraînement' : 'En attente de feedbacks' }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .fs-card { display:flex; flex-direction:column; gap:10px;
      background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:10px; padding:12px 14px; }
    .fs-top { display:flex; justify-content:space-between; align-items:center; }
    .fs-title { font-size:12px; font-weight:600; color:var(--text-primary); }
    .fs-total { font-size:11px; color:var(--text-muted); font-family:var(--font-mono); }
    .fs-gauge-wrap { display:flex; align-items:center; gap:8px; }
    .fg-label { font-size:11px; color:var(--text-muted); min-width:55px; }
    .fg-track { flex:1; height:7px; background:var(--border-subtle); border-radius:4px; overflow:hidden; }
    .fg-fill  { height:100%; border-radius:4px; transition:width .6s; }
    .fg-val   { font-family:var(--font-mono); font-size:13px; font-weight:700; min-width:44px; text-align:right; }
    .fs-breakdown { display:flex; gap:6px; }
    .fsb-item { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;
      padding:7px 4px; border-radius:7px; border:1px solid transparent; }
    .tp { background:rgba(34,197,94,.06);  border-color:rgba(34,197,94,.15); }
    .fp { background:rgba(239,68,68,.06);  border-color:rgba(239,68,68,.15); }
    .un { background:rgba(245,158,11,.06); border-color:rgba(245,158,11,.15); }
    .fsbi-count { font-family:var(--font-mono); font-size:16px; font-weight:700; color:var(--text-primary); }
    .tp .fsbi-count { color:#22c55e; }
    .fp .fsbi-count { color:#ef4444; }
    .un .fsbi-count { color:#f59e0b; }
    .fsbi-label { font-size:10px; color:var(--text-muted); }
    .fs-retrain { display:flex; flex-direction:column; gap:4px; }
    .fsr-bar-wrap { display:flex; align-items:center; gap:6px; }
    .fsr-bar  { flex:1; height:5px; background:var(--border-subtle); border-radius:3px; overflow:hidden; }
    .fsr-fill { height:100%; border-radius:3px; background:var(--accent); transition:width .5s;
      &.fsr-ready { background:#22c55e; animation:pulse-bar 1.5s ease-in-out infinite; } }
    @keyframes pulse-bar { 0%,100%{opacity:1} 50%{opacity:.6} }
    .fsr-count { font-size:11px; color:var(--text-muted); font-family:var(--font-mono); white-space:nowrap; }
    .fsr-label { font-size:11px; }
    .fsr-rdy   { color:#22c55e; font-weight:600; }
    .fsr-wait  { color:var(--text-muted); }
  `],
})
export class FeedbackStatsComponent implements OnInit {
  stats: FeedbackStats | null = null;
  retrainPct  = 0;
  precisionColor = '#94a3b8';
 
  constructor(private feedback: FeedbackService, private cdr: ChangeDetectorRef) {}
 
  ngOnInit(): void {
    this.feedback.getStats().subscribe(s => {
      this.stats      = s;
      this.retrainPct = Math.min(100, (s.unused_for_training / s.retrain_threshold) * 100);
      const p = parseFloat(s.precision_pct);
      this.precisionColor = p >= 80 ? '#22c55e' : p >= 50 ? '#f59e0b' : '#ef4444';
      this.cdr.markForCheck();
    });
  }
}