// ═══════════════════════════════════════════════════════════════════════════════
// manager/kpis/manager-kpis.component.ts
// ═══════════════════════════════════════════════════════════════════════════════
import { Component, OnInit }  from '@angular/core';
import { CommonModule }       from '@angular/common';
import { RouterLink }         from '@angular/router';
import { ManagerService, ManagerKpis, ManagerSlaReport } from '@app/services/manager.service';
import { LoadingSpinnerComponent } from '@app/shared/components/loading-spinner/loading-spinner.component';
import { StatCardComponent } from '@app/shared/components/stat-card/stat-card.component';  
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
@Component({
  selector:   'app-manager-kpis',
  standalone: true,
  imports: [CommonModule, RouterLink, StatCardComponent, LoadingSpinnerComponent,FormsModule ],
  template: `
    <div class="mgr-kpis">
      <div class="page-header">
        <div>
          <h1 class="page-title">KPIs Manager</h1>
          <p class="page-sub" *ngIf="data">{{ data.period }} · Généré {{ data.generated_at | date:'HH:mm' }}</p>
        </div>
        <div class="nav-pills">
          <a routerLink="../kpis"   class="nav-pill active">KPIs</a>
          <a routerLink="../trends" class="nav-pill">Tendances</a>
          <a routerLink="../sla"    class="nav-pill">Rapport SLA</a>
        </div>
      </div>
 
      <app-loading-spinner *ngIf="loading" label="Chargement des KPIs..." minHeight="300px"/>
 
      <ng-container *ngIf="!loading && data">
 
        <!-- ── Incidents row ──────────────────────── -->
        <h2 class="section-title">Incidents ce mois</h2>
        <div class="kpi-grid-3">
          <app-stat-card label="Total incidents"
            [value]="data.incidents.total" format="number" accent="blue"/>
          <app-stat-card label="Incidents CRITICAL"
            [value]="data.incidents.critical" format="number"
            accent="red" valueColor="red"/>
          <app-stat-card label="Incidents HIGH"
            [value]="data.incidents.high" format="number"
            accent="amber" valueColor="amber"/>
        </div>
 
        <!-- ── Performance row ───────────────────── -->
        <h2 class="section-title">Performance SLA</h2>
        <div class="kpi-grid-3">
          <app-stat-card label="MTTR moyen"
            [value]="data.performance.mttr_avg_minutes" unit="min"
            format="number" accent="violet" valueColor="violet"/>
          <app-stat-card label="Cible MTTR"
            [value]="data.performance.mttr_target_minutes" unit="min"
            format="number" accent="blue"/>
          <div class="sla-card card">
            <div class="card-header">
              <span class="card-title">Conformité SLA</span>
              <span class="sla-status-text"
                    [ngClass]="slaCompliancePct >= 90 ? 'text-green' : 'text-red'">
                {{ slaStatus }}
              </span>
            </div>
            <div class="card-body">
              <div class="sla-bar-wrap">
                <div class="sla-bar">
                  <div class="sla-bar-fill"
                       [style.width.%]="slaCompliancePct"
                       [style.background]="slaCompliancePct >= 90 ? '#22c55e' : '#ef4444'">
                  </div>
                </div>
                <span class="sla-pct"
                      [ngClass]="slaCompliancePct >= 90 ? 'text-green' : 'text-red'">
                  {{ slaCompliancePct | number:'1.1-1' }}%
                </span>
              </div>
            </div>
          </div>
        </div>
 
        <!-- ── Financial row ─────────────────────── -->
        <h2 class="section-title">Impact financier estimé</h2>
        <div class="kpi-grid-2">
          <div class="finance-card card">
            <div class="card-body">
              <p class="finance-label">MTTR baseline (sans IA)</p>
              <p class="finance-val">{{ data.financial.baseline_mttr_minutes }} min</p>
              <p class="finance-desc">Temps moyen de résolution sans supervision intelligente</p>
            </div>
          </div>
          <div class="finance-card card finance-savings">
            <div class="card-body">
              <p class="finance-label">Économies estimées</p>
              <p class="finance-val savings-val">{{ data.financial.estimated_savings_eur | number }} €</p>
              <p class="finance-desc">Basé sur 50€/min d'incident évité ce mois</p>
            </div>
          </div>
        </div>
 
        <!-- ── AI Quality row ────────────────────── -->
        <h2 class="section-title">Qualité IA</h2>
        <div class="kpi-grid-4">
          <app-stat-card label="Précision modèle"
            [value]="data.ai_quality.model_precision_pct" format="raw" accent="green" valueColor="green"/>
          <app-stat-card label="Taux faux positifs"
            [value]="data.ai_quality.false_positive_rate" format="raw"
            [accent]="parseFloat(data.ai_quality.false_positive_rate) > 20 ? 'red' : 'green'"
            [valueColor]="parseFloat(data.ai_quality.false_positive_rate) > 20 ? 'red' : 'green'"/>
          <app-stat-card label="Feedbacks collectés"
            [value]="data.ai_quality.feedbacks_collected" format="number" accent="violet"/>
          <app-stat-card label="Taux détection"
            [value]="data.ai_quality.anomaly_detection_rate" format="raw" accent="cyan" valueColor="cyan"/>
        </div>
 
        <!-- ── Platforms health ───────────────────── -->
        <h2 class="section-title">Santé des plateformes</h2>
        <div class="health-row">
          <div class="health-item health-ok">
            <span class="hi-val">{{ data.platforms_health.healthy }}</span>
            <span class="hi-lbl">Saines</span>
          </div>
          <div class="health-item health-deg">
            <span class="hi-val">{{ data.platforms_health.degraded }}</span>
            <span class="hi-lbl">Dégradées</span>
          </div>
          <div class="health-item health-crit">
            <span class="hi-val">{{ data.platforms_health.critical }}</span>
            <span class="hi-lbl">Critiques</span>
          </div>
        </div>
 
      </ng-container>
    </div>
  `,
  styles: [`
    .mgr-kpis { display:flex; flex-direction:column; gap:16px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
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
    .page-sub    { margin:4px 0 0; font-size:12px; color:var(--text-muted); }
    .nav-pills   { display:flex; gap:4px; flex-shrink:0; }
    .nav-pill {
      padding:6px 14px; border-radius:8px; text-decoration:none;
      font-size:12px; font-weight:500; color:var(--text-muted);
      border:1px solid transparent; transition:all 150ms;
    }
    .nav-pill:hover, .nav-pill.active {
      background:var(--bg-active); color:var(--accent); border-color:rgba(14,165,233,.3);
    }
    .section-title { margin:4px 0 0; font-size:13px; font-weight:600;
      color:var(--text-muted); letter-spacing:.04em; text-transform:uppercase; }
    .kpi-grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .kpi-grid-2 { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
    .kpi-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    @media(max-width:900px) {
      .kpi-grid-3,.kpi-grid-4 { grid-template-columns:repeat(2,1fr); }
    }
    .card {
      background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:12px; overflow:hidden;
    }
    .card-header {
      padding:12px 16px 8px; display:flex; justify-content:space-between; align-items:center;
    }
    .card-title { font-size:11px; font-weight:600; letter-spacing:.08em;
      text-transform:uppercase; color:var(--text-muted); }
    .card-body { padding:8px 16px 14px; }
    .sla-status-text { font-size:12px; font-weight:600; }
    .text-green { color:#22c55e; }
    .text-red   { color:#ef4444; }
    .sla-bar-wrap { display:flex; align-items:center; gap:10px; }
    .sla-bar { flex:1; height:8px; background:var(--border-subtle); border-radius:4px; overflow:hidden; }
    .sla-bar-fill { height:100%; border-radius:4px; transition:width .6s ease; }
    .sla-pct { font-family:var(--font-mono); font-size:16px; font-weight:700;
      min-width:52px; text-align:right; }
    .finance-card .card-body { padding:16px 20px 20px; }
    .finance-label { margin:0 0 4px; font-size:11px; letter-spacing:.08em;
      text-transform:uppercase; color:var(--text-muted); font-weight:600; }
    .finance-val { margin:0 0 6px; font-family:var(--font-mono); font-size:28px;
      font-weight:700; color:var(--text-primary); letter-spacing:-.02em; }
    .finance-desc { margin:0; font-size:12px; color:var(--text-muted); line-height:1.5; }
    .finance-savings { border-color:rgba(34,197,94,.3); background:rgba(34,197,94,.03); }
    .savings-val { color:#22c55e !important; }
    .health-row { display:flex; gap:12px; }
    .health-item {
      flex:1; padding:16px 20px; border-radius:12px;
      display:flex; flex-direction:column; align-items:center; gap:4px;
      border:1px solid transparent;
    }
    .health-ok   { background:rgba(34,197,94,.08);  border-color:rgba(34,197,94,.2); }
    .health-deg  { background:rgba(245,158,11,.08); border-color:rgba(245,158,11,.2); }
    .health-crit { background:rgba(239,68,68,.08);  border-color:rgba(239,68,68,.2); }
    .hi-val { font-family:var(--font-mono); font-size:28px; font-weight:700; }
    .health-ok .hi-val   { color:#22c55e; }
    .health-deg .hi-val  { color:#f59e0b; }
    .health-crit .hi-val { color:#ef4444; }
    .hi-lbl { font-size:12px; color:var(--text-muted); }
  `],
})
export class ManagerKpisComponent implements OnInit {
  loading = true;
  data: ManagerKpis | null = null;
  slaReport: ManagerSlaReport | null = null;
 
  constructor(private manager: ManagerService) {}
 
  ngOnInit(): void {
    forkJoin({
      kpis: this.manager.getKpis(),
      sla: this.manager.getSlaReport(),
    }).subscribe({
      next: ({ kpis, sla }) => {
        this.data = kpis;
        this.slaReport = sla;
        this.loading = false;
      },
      error: () => this.loading = false,
    });
  }

  get slaCompliancePct(): number {
    return this.slaReport?.sla_compliance ?? this.data?.performance.sla_compliance_pct ?? 0;
  }

  get slaStatus(): string {
    return this.slaCompliancePct >= 90 ? 'Conforme' : 'A ameliorer';
  }
 
  parseFloat = parseFloat;
}
