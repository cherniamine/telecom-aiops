// ═══════════════════════════════════════════════════════════════════════════════
// AI COPILOT
// ═══════════════════════════════════════════════════════════════════════════════
 
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { CopilotService, ExplainResponse, CopilotAskResponse }
  from '../../services/copilot.service';
import { CommonModule } from '@angular/common';

// ── explain-panel.component.ts ────────────────────────────────────────────────
@Component({
  selector:   'app-explain-panel',
  standalone: true,
  imports:    [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="explain-panel">
      <div class="ep-header">
        <div class="ep-title-row">
          <span class="ep-ai-badge">AI</span>
          <span class="ep-title">Explication de l'incident</span>
          <span class="ep-source" *ngIf="response">
            {{ response.source }} · {{ response.model }}
            <span class="ep-fallback" *ngIf="response.used_fallback">fallback</span>
          </span>
        </div>
        <button class="ep-refresh" (click)="load()" [disabled]="loading" title="Actualiser">
          <svg [class.spin]="loading" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12 7A5 5 0 112 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <path d="M2 2v3h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
 
      <div class="ep-skeleton" *ngIf="loading">
        <div class="sk-line sk-w80"></div>
        <div class="sk-line sk-w60"></div>
        <div class="sk-line sk-w90"></div>
      </div>
 
      <div class="ep-body" *ngIf="!loading && response">
        <div class="ep-section ep-manager">
          <span class="eps-label">📊 Résumé Manager</span>
          <p class="eps-text">{{ response.manager_summary }}</p>
        </div>
        <div class="ep-section ep-technical">
          <span class="eps-label">🔧 Explication Technique</span>
          <p class="eps-text">{{ response.technical_explanation }}</p>
        </div>
        <div class="ep-section ep-action">
          <span class="eps-label">⚡ Action recommandée</span>
          <p class="eps-text eps-action">{{ response.recommended_action }}</p>
        </div>
      </div>
 
      <div class="ep-error" *ngIf="error">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="#ef4444" stroke-width="1.3"/>
          <path d="M7 4v3.5M7 9v.5" stroke="#ef4444" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        {{ error }}
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .explain-panel { background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:12px; overflow:hidden; }
    .ep-header { display:flex; align-items:center; justify-content:space-between;
      padding:10px 14px; border-bottom:1px solid var(--border-subtle); gap:8px; }
    .ep-title-row { display:flex; align-items:center; gap:7px; flex:1; min-width:0; }
    .ep-ai-badge { padding:2px 6px; border-radius:5px; font-size:9px; font-weight:800;
      letter-spacing:.1em; background:linear-gradient(135deg,#a78bfa,#6366f1);
      color:#fff; flex-shrink:0; }
    .ep-title  { font-size:13px; font-weight:600; color:var(--text-primary); }
    .ep-source { font-size:10px; color:var(--text-faint); margin-left:auto; white-space:nowrap; }
    .ep-fallback { padding:1px 4px; border-radius:3px; background:rgba(245,158,11,.1);
      color:#f59e0b; margin-left:4px; }
    .ep-refresh { background:none; border:none; cursor:pointer; color:var(--text-muted);
      padding:4px; border-radius:6px; transition:all 150ms;
      &:hover { background:var(--bg-hover); color:var(--text-primary); }
      &:disabled { opacity:.4; cursor:wait; }
    }
    .spin { animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
 
    .ep-skeleton { padding:14px 16px; display:flex; flex-direction:column; gap:8px; }
    .sk-line { height:10px; border-radius:5px; background:var(--border-subtle);
      animation:shimmer 1.5s ease-in-out infinite; }
    .sk-w80 { width:80%; } .sk-w60 { width:60%; } .sk-w90 { width:90%; }
    @keyframes shimmer { 0%,100%{opacity:.4} 50%{opacity:.8} }
 
    .ep-body { padding:14px 16px; display:flex; flex-direction:column; gap:10px; }
    .ep-section { display:flex; flex-direction:column; gap:5px; padding:10px 12px;
      border-radius:8px; border:1px solid transparent; }
    .ep-manager   { background:rgba(59,130,246,.05); border-color:rgba(59,130,246,.15); }
    .ep-technical { background:rgba(99,102,241,.05); border-color:rgba(99,102,241,.15); }
    .ep-action    { background:rgba(34,197,94,.05);  border-color:rgba(34,197,94,.15); }
    .eps-label { font-size:11px; font-weight:600; color:var(--text-muted); }
    .eps-text  { margin:0; font-size:13px; color:var(--text-secondary); line-height:1.6; }
    .eps-action { font-weight:500; color:var(--text-primary); }
    .ep-error { display:flex; align-items:center; gap:6px; padding:10px 14px;
      font-size:12px; color:#ef4444; }
  `],
})
export class ExplainPanelComponent implements OnInit {
  @Input() incidentId?: string;
  loading   = false;
  response: ExplainResponse | null = null;
  error     = '';
 
  constructor(private copilot: CopilotService, private cdr: ChangeDetectorRef) {}
 
  ngOnInit(): void { this.load(); }
 
  load(): void {
    this.loading = true;
    this.error   = '';
    this.copilot.explain(this.incidentId).subscribe({
      next:  r => { this.response = r; this.loading = false; this.cdr.markForCheck(); },
      error: e => { this.error = e.message; this.loading = false; this.cdr.markForCheck(); },
    });
  }
}