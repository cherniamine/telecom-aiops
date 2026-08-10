// ═══════════════════════════════════════════════════════════════════════════════
// engineer/ml-metrics/ml-metrics.component.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatCardComponent } from '@app/shared/components/stat-card/stat-card.component';
import { LoadingSpinnerComponent } from '@app/shared/components/loading-spinner/loading-spinner.component';
import { SeverityBadgeComponent } from '@app/shared/components/severity-badge/severity-badge.component';
import { EngineerMlMetrics, EngineerService } from '@app/services/engineer.service';
import { FeedbackService, RetrainResult } from '@app/services/feedback.service';
import { ToastService } from '@app/shared/shared.index';
import { FormsModule } from '@angular/forms';

@Component({
  selector:   'app-ml-metrics',
  standalone: true,
  imports: [CommonModule, FormsModule, StatCardComponent, LoadingSpinnerComponent, SeverityBadgeComponent],
  template: `
    <div class="ml-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">ML Métriques</h1>
          <p class="page-sub">Modèles · Embeddings · Drift · Feedback</p>
        </div>
      </div>
 
      <app-loading-spinner *ngIf="loading" minHeight="300px"/>
 
      <ng-container *ngIf="!loading && data">
 
        <!-- Dataset row -->
        <h2 class="section-title">Dataset</h2>
        <div class="kpi-grid-4">
          <app-stat-card label="Logs historiques"
            [value]="data.dataset.historical_logs" format="number" accent="cyan"/>
          <app-stat-card label="Logs realtime"
            [value]="data.dataset.realtime_logs" format="number" accent="blue"/>
          <app-stat-card label="Anomalies"
            [value]="data.dataset.total_anomalies" format="number"
            accent="amber" valueColor="amber"/>
          <app-stat-card label="Taux anomalies"
            [value]="data.dataset.anomaly_rate_pct" unit="%" format="raw"
            accent="violet" subtitle="scope historique"/>
        </div>
 
        <!-- Models -->
        <h2 class="section-title">Modèles chargés</h2>
        <div class="models-grid">
          <div class="model-card" *ngFor="let m of modelList"
               [class.mc-ok]="m.available" [class.mc-fail]="!m.available">
            <div class="mc-top">
              <span class="mc-name">{{ m.name }}</span>
              <span class="mc-status" [ngClass]="m.available ? 'mcs-ok' : 'mcs-fail'">
                <span class="status-icon" [class.icon-check]="m.available" [class.icon-x]="!m.available"></span>
                {{ m.available ? 'Disponible' : 'Manquant' }}
              </span>
            </div>
            <p class="mc-path">{{ m.path }}</p>
            <p class="mc-desc">{{ m.description }}</p>
          </div>
        </div>
 
        <!-- Embeddings -->
        <h2 class="section-title">Embeddings</h2>
        <div class="embed-card card">
          <div class="card-body embed-body">
            <div class="embed-stat">
              <span class="es-val">{{ data.dataset.total_anomalies | number }}</span>
              <span class="es-lbl">Vecteurs anomalies</span>
            </div>
            <div class="embed-sep"></div>
            <div class="embed-stat">
              <span class="es-val">{{ data.dataset.embedding_dim }}</span>
              <span class="es-lbl">Dimensions</span>
            </div>
            <div class="embed-sep"></div>
            <div class="embed-stat">
              <span class="es-val">all-MiniLM-L6-v2</span>
              <span class="es-lbl">Modèle sentence-transformers</span>
            </div>
            <div class="embed-sep"></div>
            <div class="embed-stat">
              <span class="es-val">466.9 MB</span>
              <span class="es-lbl">Index FAISS (IVFPQ)</span>
            </div>
          </div>
        </div>
 
        <!-- Drift -->
        <h2 class="section-title">Model Drift</h2>
        <div class="drift-card card" [ngClass]="'drift-' + data.drift.severity.toLowerCase()">
          <div class="card-body drift-body">
            <div class="drift-left">
              <app-severity-badge [severity]="data.drift.severity || 'UNKNOWN'" size="md"/>
              <p class="drift-verdict" *ngIf="data.drift.severity === 'UNKNOWN'">
                Aucune analyse lancée — référence disponible
              </p>
              <p class="drift-verdict" *ngIf="data.drift.severity !== 'UNKNOWN'">
                {{ data.drift.drifted_tests.length }} tests en drift :
                {{ data.drift.drifted_tests.join(', ') || '—' }}
              </p>
            </div>
            <div class="drift-right">
              <span class="drift-retrain" *ngIf="data.drift.retrain_needed">
                <span class="drift-icon icon-alert"></span>
                Ré-entraînement requis
              </span>
              <span class="drift-ok" *ngIf="!data.drift.retrain_needed">
                <span class="drift-icon icon-check-circle"></span>
                Modèles à jour
              </span>
            </div>
          </div>
        </div>
 
        <!-- Feedback -->
        <h2 class="section-title">Feedback Loop</h2>
        <div class="kpi-grid-4">
          <app-stat-card label="Total feedbacks"
            [value]="data.feedback.total" format="number" accent="blue"/>
          <app-stat-card label="Précision"
            [value]="data.feedback.precision_pct" format="raw"
            [accent]="data.feedback.precision_pct === '0.0%' ? 'red' : 'green'"
            [valueColor]="data.feedback.precision_pct === '0.0%' ? 'red' : 'green'"/>
          <app-stat-card label="Faux positifs"
            [value]="data.feedback.false_positives" format="number"
            accent="amber" valueColor="amber"/>
          <app-stat-card label="Prêt ré-entraîn."
            [value]="data.feedback.retrain_ready ? 'OUI' : 'NON'" format="raw"
            [accent]="data.feedback.retrain_ready ? 'green' : 'blue'"
            [valueColor]="data.feedback.retrain_ready ? 'green' : 'default'"/>
        </div>

        <!-- Retraining -->
        <h2 class="section-title">Reentrainement du modele</h2>
        <div class="retrain-card card"
             [class.retrain-ready]="canRetrain()"
             [class.retrain-waiting]="!canRetrain()">
          <div class="card-body retrain-body">
            <div class="retrain-info">
              <div class="retrain-title-row">
                <span class="retrain-icon">ML</span>
                <div>
                  <h3>Cycle de reentrainement supervise</h3>
                  <p>
                    Le modele est reentraine a partir des feedbacks TP/FP valides
                    par les operateurs et par l'ingenieur.
                  </p>
                </div>
              </div>

              <div class="retrain-progress">
                <div class="progress-head">
                  <span>{{ data.feedback.unused_for_training || 0 }} / {{ retrainThreshold }} feedbacks exploitables</span>
                  <strong>{{ retrainProgressPct() }}%</strong>
                </div>
                <div class="progress-track">
                  <span class="progress-fill" [style.width.%]="retrainProgressPct()"></span>
                </div>
              </div>

              <div class="retrain-status-row">
                <span class="status-pill" [ngClass]="data.feedback.retrain_ready ? 'pill-ok' : 'pill-wait'">
                  {{ data.feedback.retrain_ready ? 'Seuil atteint' : 'Seuil non atteint' }}
                </span>
                <span class="status-pill" [ngClass]="data.drift.retrain_needed ? 'pill-risk' : 'pill-ok'">
                  {{ data.drift.retrain_needed ? 'Drift a corriger' : 'Drift stable' }}
                </span>
                <span class="status-pill pill-info" *ngIf="lastRetrainResult">
                  Dernier statut : {{ lastRetrainResult.status }}
                </span>
              </div>
            </div>

            <div class="retrain-action">
              <button class="retrain-btn"
                      type="button"
                      [disabled]="retraining || !canRetrain()"
                      (click)="triggerRetrain()">
                <span class="btn-spinner" *ngIf="retraining"></span>
                <span *ngIf="!retraining">Lancer le reentrainement</span>
                <span *ngIf="retraining">Reentrainement en cours...</span>
              </button>
              <p class="retrain-note" *ngIf="!canRetrain()">
                Le bouton sera active lorsque le seuil de feedbacks sera atteint
                ou lorsqu'un drift exigera une mise a jour.
              </p>
              <p class="retrain-note success-note" *ngIf="lastRetrainResult?.status === 'SUCCESS'">
                {{ lastRetrainResult?.samples_used || 0 }} feedbacks integres,
                contamination ajustee a {{ lastRetrainResult?.new_contamination }}.
              </p>
            </div>
          </div>
        </div>
 
      </ng-container>
    </div>
  `,
  styles: [`
    .ml-page { display:flex; flex-direction:column; gap:16px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; }
    
    /* Style dashboard pro avec barre décorative */
    .page-title { 
      margin: 0; 
      font-size: 24px; 
      font-weight: 600; 
      background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 12px;  
    }
    
    .page-title::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 24px;
      background: linear-gradient(180deg, var(--accent, #0ea5e9), #8b5cf6);
      border-radius: 4px;
    }
    
    .page-sub { margin:4px 0 0; font-size:12px; color:var(--text-muted); }
    .section-title { margin:4px 0 0; font-size:13px; font-weight:600; color:var(--text-muted);
      letter-spacing:.04em; text-transform:uppercase; }
    .kpi-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    @media(max-width:900px){ .kpi-grid-4 { grid-template-columns:repeat(2,1fr); } }
    .card { background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:12px; }
    .card-body { padding:16px 20px; }
 
    .models-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    @media(max-width:768px){ .models-grid { grid-template-columns:1fr; } }
    .model-card { background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:6px; }
    .mc-ok   { border-color:rgba(34,197,94,.25); }
    .mc-fail { border-color:rgba(239,68,68,.25); }
    .mc-top  { display:flex; justify-content:space-between; align-items:center; }
    .mc-name { font-weight:600; font-size:13px; color:var(--text-primary); }
    .mc-status { font-size:11px; font-weight:600; display: flex; align-items: center; gap: 6px; }
    .mcs-ok { color:#22c55e; } 
    .mcs-fail { color:#ef4444; }
    .mc-path { margin:0; font-family:var(--font-mono); font-size:10px; color:var(--text-faint); }
    .mc-desc { margin:0; font-size:11px; color:var(--text-muted); }
 
    .embed-body { display:flex; gap:0; flex-wrap:wrap; }
    .embed-stat { flex:1; min-width:140px; display:flex; flex-direction:column; gap:4px; padding:8px 12px; }
    .embed-sep  { width:1px; background:var(--border-subtle); }
    .es-val     { font-family:var(--font-mono); font-size:16px; font-weight:700; color:var(--accent); }
    .es-lbl     { font-size:11px; color:var(--text-muted); }
 
    .drift-card .card-body { padding:14px 18px; }
    .drift-body { display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .drift-left { display:flex; align-items:center; gap:12px; }
    .drift-verdict { margin:0; font-size:12px; color:var(--text-muted); }
    
    /* Styles modernes pour les icônes */
    .status-icon, .drift-icon {
      display: inline-block;
      width: 14px;
      height: 14px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
    }
    
    /* Icône check (cercle vert avec check) */
    .icon-check {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2322c55e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6L9 17l-5-5'/%3E%3C/svg%3E");
    }
    
    /* Icône x (cercle rouge avec croix) */
    .icon-x {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 6L6 18'/%3E%3Cpath d='M6 6l12 12'/%3E%3C/svg%3E");
    }
    
    /* Icône alerte (triangle warning) */
    .icon-alert {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 8v4m0 4h.01'/%3E%3Cpath d='M12 2L2 20h20L12 2z'/%3E%3C/svg%3E");
    }
    
    /* Icône check cercle (pour drift ok) */
    .icon-check-circle {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2322c55e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22 4 12 14.01 9 11.01'/%3E%3C/svg%3E");
    }
    
    .drift-retrain, .drift-ok {
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .drift-retrain { color: #ef4444; }
    .drift-ok { color: #22c55e; }
    
    .drift-critical { border-color:rgba(239,68,68,.3); background:rgba(239,68,68,.03); }
    .drift-high     { border-color:rgba(245,158,11,.3); }
    .drift-unknown  { border-color:rgba(148,163,184,.2); }

    .retrain-card { border-color:rgba(14,165,233,.18); overflow:hidden; }
    .retrain-ready { background:linear-gradient(135deg, rgba(34,197,94,.08), var(--bg-card) 58%); }
    .retrain-waiting { background:linear-gradient(135deg, rgba(14,165,233,.06), var(--bg-card) 58%); }
    .retrain-body {
      display:grid;
      grid-template-columns:minmax(0,1fr) 260px;
      gap:18px;
      align-items:center;
    }
    @media(max-width:900px){ .retrain-body { grid-template-columns:1fr; } }
    .retrain-info { display:flex; flex-direction:column; gap:14px; min-width:0; }
    .retrain-title-row { display:flex; gap:12px; align-items:flex-start; }
    .retrain-icon {
      width:34px;
      height:34px;
      border-radius:10px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:rgba(14,165,233,.12);
      color:var(--accent);
      font-weight:700;
      flex:0 0 auto;
    }
    .retrain-title-row h3 {
      margin:0 0 4px;
      font-size:15px;
      font-weight:700;
      color:var(--text-primary);
    }
    .retrain-title-row p {
      margin:0;
      font-size:12px;
      line-height:1.5;
      color:var(--text-muted);
    }
    .retrain-progress { display:flex; flex-direction:column; gap:7px; }
    .progress-head {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      font-size:12px;
      color:var(--text-muted);
    }
    .progress-head strong { color:var(--text-primary); font-family:var(--font-mono); }
    .progress-track {
      height:8px;
      border-radius:999px;
      overflow:hidden;
      background:var(--bg-hover);
      border:1px solid var(--border-subtle);
    }
    .progress-fill {
      display:block;
      height:100%;
      min-width:4px;
      border-radius:999px;
      background:linear-gradient(90deg, #0ea5e9, #22c55e);
      transition:width 180ms ease;
    }
    .retrain-status-row { display:flex; flex-wrap:wrap; gap:8px; }
    .status-pill {
      display:inline-flex;
      align-items:center;
      border-radius:7px;
      padding:5px 9px;
      font-size:11px;
      font-weight:700;
      border:1px solid transparent;
    }
    .pill-ok { color:#16a34a; background:rgba(34,197,94,.12); border-color:rgba(34,197,94,.2); }
    .pill-wait { color:#f59e0b; background:rgba(245,158,11,.12); border-color:rgba(245,158,11,.2); }
    .pill-risk { color:#ef4444; background:rgba(239,68,68,.12); border-color:rgba(239,68,68,.2); }
    .pill-info { color:var(--accent); background:rgba(14,165,233,.1); border-color:rgba(14,165,233,.18); }
    .retrain-action {
      display:flex;
      flex-direction:column;
      gap:9px;
      align-items:stretch;
    }
    .retrain-btn {
      min-height:42px;
      border:0;
      border-radius:10px;
      padding:0 16px;
      background:var(--accent);
      color:white;
      font-weight:700;
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      box-shadow:0 8px 20px rgba(14,165,233,.22);
      transition:transform 140ms ease, opacity 140ms ease;
    }
    .retrain-btn:hover:not(:disabled) { transform:translateY(-1px); }
    .retrain-btn:disabled {
      cursor:not-allowed;
      opacity:.55;
      box-shadow:none;
      background:var(--bg-hover);
      color:var(--text-muted);
      border:1px solid var(--border-subtle);
    }
    .btn-spinner {
      width:14px;
      height:14px;
      border:2px solid rgba(255,255,255,.35);
      border-top-color:white;
      border-radius:50%;
      animation:spin .75s linear infinite;
    }
    .retrain-note {
      margin:0;
      font-size:11px;
      color:var(--text-muted);
      line-height:1.45;
      text-align:center;
    }
    .success-note { color:#16a34a; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `],
})
export class MlMetricsComponent implements OnInit {
  loading = true;
  retraining = false;
  data: EngineerMlMetrics | null = null;
  lastRetrainResult: RetrainResult | null = null;
  readonly retrainThreshold = 50;
 
  readonly modelList = [
    { name: 'Isolation Forest', path: 'ml/models/isolation_forest.pkl',
      description: 'Détection d\'anomalies non supervisée, contamination 5%',
      available: false },
    { name: 'LOF (novelty)',    path: 'ml/models/lof.pkl',
      description: 'Local Outlier Factor en mode novelty=True',
      available: false },
    { name: 'TF-IDF Vectorizer',path: 'ml/models/tfidf.pkl',
      description: '5000 features, ngram (1,2), composante NLP du modèle hybride',
      available: false },
  ];
 
  constructor(
    private engineer: EngineerService,
    private feedback: FeedbackService,
    private toast: ToastService,
  ) {}
 
  ngOnInit(): void {
    this.loadMetrics();
  }

  loadMetrics(): void {
    this.loading = true;
    this.engineer.getMlMetrics().subscribe({
      next: d => {
        this.data = d;
        this.modelList[0].available = d.models.isolation_forest.available;
        this.modelList[1].available = d.models.lof.available;
        this.modelList[2].available = d.models.tfidf.available;
        this.loading = false;
      },
      error: () => this.loading = false,
    });
  }

  canRetrain(): boolean {
    if (!this.data) {
      return false;
    }

    return this.data.feedback.retrain_ready || this.data.drift.retrain_needed;
  }

  retrainProgressPct(): number {
    if (!this.data) {
      return 0;
    }

    const current = this.data.feedback.unused_for_training || 0;
    return Math.min(100, Math.round((current / this.retrainThreshold) * 100));
  }

  triggerRetrain(): void {
    if (!this.canRetrain() || this.retraining) {
      return;
    }

    this.retraining = true;
    this.feedback.retrain().subscribe({
      next: result => {
        this.retraining = false;
        this.lastRetrainResult = result;

        if (result.status === 'SUCCESS') {
          this.toast.success(
            'Reentrainement termine',
            `${result.samples_used ?? 0} feedbacks integres au modele.`,
          );
          this.loadMetrics();
          return;
        }

        if (result.status === 'SKIPPED') {
          this.toast.warning(
            'Reentrainement non lance',
            `Feedbacks disponibles : ${result.current ?? 0}/${this.retrainThreshold}.`,
          );
          return;
        }

        this.toast.info('Reentrainement', `Statut : ${result.status}`);
      },
      error: () => {
        this.retraining = false;
        this.toast.error('Erreur lors du reentrainement');
      },
    });
  }
}
