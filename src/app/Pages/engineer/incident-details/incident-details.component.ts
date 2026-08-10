// ═══════════════════════════════════════════════════════════════════════════════
// incident-details.component.ts  (Engineer view)
// Route : /engineer/details/:id
// Affiche : RCA complet + top anomalies + ML metrics par incident
// ═══════════════════════════════════════════════════════════════════════════════
import { Component, OnInit }        from '@angular/core';
import { CommonModule }             from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EngineerService }          from '../../../services/engineer.service';
import { SeverityBadgeComponent }   from '../../../shared/components/severity-badge/severity-badge.component';
import { PlatformTagComponent }     from '../../../shared/components/platform-tag/platform-tag.component';
import { LoadingSpinnerComponent }  from '../../../shared/components/loading-spinner/loading-spinner.component';
import { RcaPanelComponent }        from '../../../features/rca-panel/rca-panel.component';
import { CascadeTimelineComponent } from '../../../features/cascade-timeline/cascade-timeline.component';
import { TimeAgoPipe }              from '../../../shared/pipes/time-ago.pipe';
import { FormsModule } from '@angular/forms';

@Component({
  selector:   'app-incident-details',
  standalone: true,
  imports: [
    CommonModule, RouterLink, TimeAgoPipe,FormsModule ,
    SeverityBadgeComponent, PlatformTagComponent, LoadingSpinnerComponent,
    RcaPanelComponent, CascadeTimelineComponent,
  ],
  template: `
    <div class="eng-details">

      <!-- Breadcrumb -->
      <nav class="breadcrumb">
        <a routerLink="/engineer/ml-metrics" class="bc-link">ML Métriques</a>
        <span class="bc-sep">›</span>
        <span class="bc-current">Détails incident</span>
      </nav>

      <app-loading-spinner *ngIf="loading" label="Chargement des détails..." minHeight="400px"/>

      <ng-container *ngIf="!loading && data">

        <!-- Header -->
        <div class="detail-header">
          <div class="dh-left">
            <app-severity-badge [severity]="data.incident?.severity?.label ?? ''" size="lg"/>
            <div>
              <h1 class="dh-title">
                Incident #{{ (data.incident?._id ?? '').slice(-8).toUpperCase() }}
                <span class="dh-role-badge">Vue Ingénieur</span>
              </h1>
              <p class="dh-sub">Analyse technique complète · ML + RCA + Drift</p>
            </div>
          </div>
        </div>

        <!-- ML metrics mini row -->
        <div class="ml-mini-row">
          <div class="mlm-item">
            <span class="mlm-label">Précision modèle</span>
            <span class="mlm-val"
                  [class.mv-ok]="data.ml_metrics?.model_precision !== '0.0%'"
                  [class.mv-warn]="data.ml_metrics?.model_precision === '0.0%'">
              {{ data.ml_metrics?.model_precision ?? '—' }}
            </span>
          </div>
          <div class="mlm-item">
            <span class="mlm-label">Taux faux positifs</span>
            <span class="mlm-val">{{ data.ml_metrics?.false_positive_rate ?? '—' }}</span>
          </div>
          <div class="mlm-item">
            <span class="mlm-label">Feedbacks</span>
            <span class="mlm-val">{{ data.ml_metrics?.total_feedbacks ?? 0 | number }}</span>
          </div>
          <div class="mlm-item">
            <span class="mlm-label">Drift status</span>
            <span class="mlm-val"
                  [ngClass]="driftSeverityClass">
              {{ data.drift_status?.severity ?? 'UNKNOWN' }}
            </span>
          </div>
        </div>

        <!-- Cascade timeline -->
        <div class="section-block" *ngIf="cascadeSteps.length">
          <h2 class="section-title">Cascade de propagation</h2>
          <div class="card">
            <div class="card-body">
              <app-cascade-timeline
                [steps]="cascadeSteps"
                [activeIndex]="cascadeActive"
                [coherenceScore]="coherenceScore"
                [summary]="cascadeSummary"/>
            </div>
          </div>
        </div>

        <!-- 2-col: RCA + Anomalies -->
        <div class="two-col">

          <!-- RCA -->
          <div class="section-block">
            <h2 class="section-title">Causes racines (top 8)</h2>
            <div class="card">
              <div class="card-body">
                <app-rca-panel
                  [rootCauses]="data.incident?.root_cause?.root_causes ?? []"
                  [rootPlatform]="data.incident?.root_cause?.root_platform_analysis?.root_platform"
                  [rootPlatformAnalysis]="data.incident?.root_cause?.root_platform_analysis"
                  [cascadeValidation]="data.incident?.root_cause?.cascade_validation"/>
              </div>
            </div>
          </div>

          <!-- Top anomalies -->
          <div class="section-block">
            <h2 class="section-title">Top anomalies</h2>
            <div class="anomaly-list">
              <div class="anomaly-card" *ngFor="let a of data.top_anomalies; let i = index"
                   [style.animation-delay]="(i * 60) + 'ms'">
                <div class="ac-left">
                  <div class="ac-score" [ngClass]="getScoreClass(a.anomaly_score)">
                    <span class="acs-val">{{ (a.anomaly_score * 100).toFixed(0) }}</span>
                    <span class="acs-pct">%</span>
                  </div>
                  <div class="ac-meta">
                    <app-platform-tag [platform]="a.platform" size="sm"/>
                    <span class="ac-thresh" *ngIf="a.threshold_type">
                      {{ a.threshold_type }}
                    </span>
                  </div>
                </div>
                <div class="ac-body">
                  <p class="ac-msg">
                    {{ a.message | slice:0:120 }}{{ (a.message?.length ?? 0) > 120 ? '…' : '' }}
                  </p>
                  <div class="ac-footer">
                    <span class="ac-time">{{ a.timestamp | timeAgo }}</span>
                    <span class="ac-model" *ngIf="a.model?.model">{{ a.model?.model }}</span>
                  </div>
                </div>
              </div>
              <div class="empty-anomalies" *ngIf="!data.top_anomalies?.length">
                Aucune anomalie dans les données
              </div>
            </div>
          </div>

        </div>

        <!-- Drift & Retrain block -->
        <div class="drift-block">
          <h2 class="section-title">Drift & Ré-entraînement</h2>
          <div class="drift-detail card">
            <div class="card-body drift-body">
              <div class="dd-left">
                <div class="dd-severity" [ngClass]="driftSeverityClass">
                  {{ data.drift_status?.severity ?? 'UNKNOWN' }}
                </div>
                <div class="dd-info">
                  <span class="dd-last">
                    Dernière analyse :
                    {{ data.drift_status?.last_check ?? 'Aucune' }}
                  </span>
                  <span class="dd-retrain" *ngIf="data.drift_status?.retrain_needed">
                    🔴 Ré-entraînement requis
                  </span>
                  <span class="dd-ok" *ngIf="!data.drift_status?.retrain_needed">
                    ✅ Modèle stable
                  </span>
                </div>
              </div>
              <div class="dd-right" *ngIf="data.ml_metrics?.retrain_ready">
                <div class="retrain-ready-badge">
                  <span>🔄 {{ data.ml_metrics?.total_feedbacks }} feedbacks disponibles</span>
                  <span class="rrb-sub">Modèle prêt pour ré-entraînement</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </ng-container>

      <div class="error-state" *ngIf="!loading && !data">
        <p>Impossible de charger les détails de l'incident.</p>
        <a routerLink="/engineer/ml-metrics" class="back-btn">← Retour aux métriques</a>
      </div>

    </div>
  `,
  styles: [`
    :host { display:block; }
    .eng-details { display:flex; flex-direction:column; gap:18px; }

    .breadcrumb { display:flex; align-items:center; gap:6px; font-size:13px; }
    .bc-link    { color:var(--accent); text-decoration:none; &:hover { text-decoration:underline; } }
    .bc-sep     { color:var(--text-faint); }
    .bc-current { color:var(--text-muted); }

    .detail-header { display:flex; align-items:flex-start; gap:14px; }
    .dh-left  { display:flex; align-items:center; gap:14px; }
    .dh-title { margin:0; font-size:20px; font-weight:700; color:var(--text-primary);
      display:flex; align-items:center; gap:10px; font-family:var(--font-mono); }
    .dh-role-badge { font-size:10px; padding:2px 8px; border-radius:4px;
      background:rgba(99,102,241,.12); color:#4f46e5; font-family:var(--font-sans);
      font-weight:700; letter-spacing:.05em; }
    .dh-sub { margin:4px 0 0; font-size:12px; color:var(--text-muted); }

    .ml-mini-row { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
    @media(max-width:768px) { .ml-mini-row { grid-template-columns:repeat(2,1fr); } }
    .mlm-item { background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:10px; padding:10px 12px;
      display:flex; flex-direction:column; gap:4px; }
    .mlm-label { font-size:10px; font-weight:600; letter-spacing:.07em;
      text-transform:uppercase; color:var(--text-muted); }
    .mlm-val   { font-family:var(--font-mono); font-size:16px; font-weight:700; color:var(--text-primary); }
    .mv-ok   { color:#22c55e; }
    .mv-warn { color:#ef4444; }

    .section-block { display:flex; flex-direction:column; gap:8px; }
    .section-title { margin:0; font-size:13px; font-weight:600; color:var(--text-muted);
      letter-spacing:.04em; text-transform:uppercase; }
    .card { background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:12px; overflow:hidden; }
    .card-body { padding:14px 16px; }

    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    @media(max-width:900px) { .two-col { grid-template-columns:1fr; } }

    .anomaly-list { display:flex; flex-direction:column; gap:6px; }
    .anomaly-card {
      display:flex; align-items:flex-start; gap:10px;
      padding:10px 12px; border-radius:9px;
      border:1px solid var(--border-subtle); background:var(--bg-card);
      animation:slide-in 300ms ease-out both;
      transition:all 150ms;
    }
    .anomaly-card:hover { box-shadow:0 2px 10px rgba(0,0,0,.06); }
    @keyframes slide-in { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:none; } }
    .ac-left  { display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; }
    .ac-score { width:40px; height:40px; border-radius:50%;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      border:2px solid var(--border-subtle); }
    .score-critical { border-color:#ef4444; background:rgba(239,68,68,.08); }
    .score-high     { border-color:#f59e0b; background:rgba(245,158,11,.08); }
    .score-medium   { border-color:#3b82f6; background:rgba(59,130,246,.08); }
    .acs-val { font-family:var(--font-mono); font-size:12px; font-weight:700; color:var(--text-primary); line-height:1; }
    .acs-pct { font-size:8px; color:var(--text-muted); }
    .ac-meta { display:flex; flex-direction:column; gap:2px; align-items:center; }
    .ac-thresh { font-size:9px; color:var(--text-faint); }
    .ac-body  { flex:1; min-width:0; }
    .ac-msg   { margin:0 0 4px; font-size:12px; color:var(--text-secondary); line-height:1.45; }
    .ac-footer { display:flex; gap:8px; font-size:10px; color:var(--text-faint); }
    .ac-model { font-family:var(--font-mono); padding:0 5px; border-radius:3px;
      background:rgba(14,165,233,.08); color:var(--accent); }
    .empty-anomalies { text-align:center; padding:24px; font-size:12px; color:var(--text-faint); }

    .drift-block { display:flex; flex-direction:column; gap:8px; }
    .drift-detail .card-body { }
    .drift-body  { display:flex; align-items:center; justify-content:space-between; gap:14px; }
    .dd-left     { display:flex; align-items:center; gap:12px; }
    .dd-severity { padding:4px 12px; border-radius:7px; font-size:13px; font-weight:700;
      font-family:var(--font-mono); letter-spacing:.05em; }
    .drift-none,.drift-low    { background:rgba(34,197,94,.1);  color:#22c55e; }
    .drift-medium             { background:rgba(245,158,11,.1); color:#f59e0b; }
    .drift-high,.drift-critical { background:rgba(239,68,68,.1); color:#ef4444; }
    .drift-unknown,.drift-baseline_only { background:rgba(148,163,184,.1); color:#64748b; }
    .dd-info   { display:flex; flex-direction:column; gap:3px; }
    .dd-last   { font-size:11px; color:var(--text-muted); }
    .dd-retrain { font-size:12px; font-weight:600; color:#ef4444; }
    .dd-ok      { font-size:12px; font-weight:600; color:#22c55e; }
    .retrain-ready-badge { display:flex; flex-direction:column; gap:2px; padding:8px 12px;
      border-radius:8px; background:rgba(14,165,233,.08); border:1px solid rgba(14,165,233,.2); }
    .rrb-sub { font-size:10px; color:var(--text-muted); }

    .error-state { text-align:center; padding:48px 24px; font-size:13px; color:var(--text-muted); }
    .back-btn { color:var(--accent); text-decoration:none; font-weight:600; }
  `],
})
export class IncidentDetailsComponent implements OnInit {
  loading = true;
  data:    any = null;

  cascadeSteps:  string[] = [];
  cascadeActive  = -1;
  coherenceScore: number | null = null;
  cascadeSummary = '';

  constructor(
    private route:    ActivatedRoute,
    private engineer: EngineerService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? 'latest';
    this.engineer.getIncidentDetails(id).subscribe({
      next: d => {
        this.data = d;
        this.buildCascade(d.incident);
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  private buildCascade(inc: any): void {
    if (!inc) return;
    this.cascadeSteps  = inc.timeline?.timeline ?? inc.platforms ?? [];
    this.cascadeActive = inc.status === 'open' ? 0 : -1;
    this.coherenceScore = inc.root_cause?.cascade_validation?.coherence_score ?? null;
    this.cascadeSummary = inc.timeline?.summary ?? '';
  }

  getScoreClass(score: number): string {
    return score > 0.85 ? 'score-critical' : score > 0.70 ? 'score-high' : 'score-medium';
  }

  get driftSeverityClass(): string {
    const s = (this.data?.drift_status?.severity ?? 'unknown').toLowerCase();
    return `drift-${s}`;
  }
}