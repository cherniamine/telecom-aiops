// ═══════════════════════════════════════════════════════════════════════════════
// SIMILARITY SEARCH
// ═══════════════════════════════════════════════════════════════════════════════
 
import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { SimilarLog } from '../../services/faiss.service';
import { CommonModule } from '@angular/common';
 
// ── similar-log-card.component.ts ────────────────────────────────────────────
@Component({
  selector:   'app-similar-log-card',
  standalone: true,
  imports:    [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="slc" [class.slc-anomaly]="log.is_anomaly">
      <div class="slc-top">
        <span class="slc-platform" [ngClass]="platformClass">{{ log.platform }}</span>
        <div class="slc-score">
          <div class="score-arc" [style.--pct]="scorePct + '%'">
            <span class="sa-num">{{ (log.similarity_score * 100).toFixed(0) }}%</span>
          </div>
        </div>
        <span class="slc-level" [ngClass]="'level-' + log.level.toLowerCase()">
          {{ log.level }}
        </span>
      </div>
      <p class="slc-message">{{ log.message | slice:0:140 }}{{ log.message.length > 140 ? '…' : '' }}</p>
      <div class="slc-footer">
        <span class="slc-time">{{ log.timestamp | date:'dd/MM HH:mm:ss' }}</span>
        <span class="slc-src">{{ log.source_collection }}</span>
        <span class="slc-dist">dist {{ log.distance }}</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .slc { background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:6px;
      transition:all 150ms; }
    .slc:hover { box-shadow:0 2px 10px rgba(0,0,0,.07); border-color:var(--border-default); }
    .slc-anomaly { border-left:3px solid #f59e0b; }
    .slc-top { display:flex; align-items:center; gap:8px; }
    .slc-platform { font-family:var(--font-mono); font-size:10px; font-weight:700;
      padding:2px 6px; border-radius:3px; }
    .p-smpps { background:rgba(59,130,246,.12); color:#2563eb; }
    .p-smsc  { background:rgba(239,68,68,.12);  color:#dc2626; }
    .p-mmg   { background:rgba(245,158,11,.12); color:#d97706; }
    .p-dmc   { background:rgba(34,197,94,.12);  color:#16a34a; }
    .p-smppc { background:rgba(99,102,241,.12); color:#4f46e5; }
    .p-na    { background:rgba(148,163,184,.1); color:#64748b; }
    .slc-score { margin-left:auto; }
    .score-arc { width:32px; height:32px; border-radius:50%;
      background:conic-gradient(var(--accent) calc(var(--pct)), var(--border-subtle) 0);
      display:flex; align-items:center; justify-content:center;
      position:relative; }
    .score-arc::before { content:''; position:absolute; inset:4px; border-radius:50%;
      background:var(--bg-card); }
    .sa-num { position:relative; z-index:1; font-size:9px; font-weight:700;
      color:var(--text-primary); font-family:var(--font-mono); }
    .slc-level { font-size:10px; font-weight:600; padding:1px 5px; border-radius:3px; }
    .level-error { background:rgba(239,68,68,.1);  color:#dc2626; }
    .level-warn  { background:rgba(245,158,11,.1); color:#d97706; }
    .level-info  { background:rgba(148,163,184,.1);color:#64748b; }
    .level-alert { background:rgba(99,102,241,.1); color:#4f46e5; }
    .slc-message { margin:0; font-size:11px; color:var(--text-secondary); line-height:1.45; }
    .slc-footer { display:flex; gap:10px; font-size:10px; color:var(--text-faint); }
    .slc-dist { margin-left:auto; font-family:var(--font-mono); }
  `],
})
export class SimilarLogCardComponent implements OnChanges {
  @Input() log!: SimilarLog;
  platformClass = 'p-na';
  scorePct      = 0;
  ngOnChanges(): void {
    this.platformClass = 'p-' + (this.log?.platform ?? 'na').toLowerCase();
    this.scorePct      = Math.round((this.log?.similarity_score ?? 0) * 100);
  }
}
