// ═══════════════════════════════════════════════════════════════════════════════
// manager/sla/manager-sla.component.ts
// ═══════════════════════════════════════════════════════════════════════════════

 
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ManagerService, ManagerSlaReport } from '@app/services/manager.service';
import { LoadingSpinnerComponent } from '@app/shared/components/loading-spinner/loading-spinner.component';
import { SeverityBadgeComponent } from '@app/shared/components/severity-badge/severity-badge.component';
@Component({
  selector:   'app-manager-sla',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingSpinnerComponent, SeverityBadgeComponent,FormsModule ],
  template: `
    <div class="sla-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Rapport SLA</h1>
          <p class="page-sub">Conformité par sévérité · {{ data?.sla_compliance | number:'1.1-1' }}% global</p>
        </div>
        <div class="nav-pills">
          <a routerLink="../kpis"   class="nav-pill">KPIs</a>
          <a routerLink="../trends" class="nav-pill">Tendances</a>
          <a routerLink="../sla"    class="nav-pill active">Rapport SLA</a>
        </div>
      </div>
 
      <app-loading-spinner *ngIf="loading" minHeight="200px"/>
 
      <ng-container *ngIf="!loading && data">
        <!-- Global compliance -->
        <div class="compliance-banner" [ngClass]="data.sla_compliance >= 90 ? 'cb-ok' : 'cb-fail'">
          <div class="cb-main">
            <span class="cb-pct">{{ data.sla_compliance | number:'1.1-1' }}%</span>
            <span class="cb-label">Conformité SLA globale</span>
          </div>
          <div class="cb-counts">
            <span class="cbc-ok">{{ data.sla_met }} respectés</span>
            <span class="cbc-fail">{{ data.sla_missed }} non respectés</span>
          </div>
        </div>
 
        <!-- By severity -->
        <h2 class="section-title">Par sévérité</h2>
        <div class="sev-grid">
          <div class="sev-card" *ngFor="let sev of severities">
            <div class="sc-header">
              <app-severity-badge [severity]="sev" size="sm"/>
              <span class="sc-target">Cible : {{ slaTargets[sev] }}min</span>
            </div>
            <div class="sc-body">
              <div class="sc-numbers">
                <span class="sc-total">{{ data.by_severity[sev]?.count ?? 0 }} incidents</span>
                <span class="sc-met">{{ data.by_severity[sev]?.met ?? 0 }} OK</span>
              </div>
              <div class="sc-bar">
                <div class="sc-bar-fill"
                     [style.width.%]="getCompliance(sev)"
                     [style.background]="getCompliance(sev) >= 90 ? '#22c55e' : getCompliance(sev) >= 70 ? '#f59e0b' : '#ef4444'">
                </div>
              </div>
              <span class="sc-pct"
                    [ngClass]="getCompliance(sev) >= 90 ? 'pct-ok' : getCompliance(sev) >= 70 ? 'pct-warn' : 'pct-fail'">
                {{ getCompliance(sev) | number:'1.1-1' }}%
              </span>
            </div>
          </div>
        </div>
 
        <!-- Detail table -->
        <h2 class="section-title">Détail des incidents</h2>
        <div class="table-wrap">
          <table class="sla-table">
            <thead>
              <tr>
                <th>Incident</th><th>Sévérité</th><th>Cible</th>
                <th>MTTR réel</th><th>Statut</th><th>Plateformes</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of data.details" [class.row-fail]="!r.sla_met">
                <td class="td-id">{{ r.incident_id.slice(-8) }}</td>
                <td><app-severity-badge [severity]="r.severity" size="sm"/></td>
                <td class="td-mono">{{ r.sla_target }}min</td>
                <td class="td-mono" [ngClass]="r.actual_mttr > r.sla_target ? 'text-red' : 'text-green'">
                  {{ r.actual_mttr }}min
                </td>
                <td>
                  <span class="sla-pill" [ngClass]="r.sla_met ? 'sla-ok' : 'sla-fail'">
                    {{ r.sla_met ? '✅ OK' : '❌ NOK' }}
                  </span>
                </td>
                <td>
                  <span class="plat-chip" *ngFor="let p of r.platforms">{{ p }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .sla-page { display:flex; flex-direction:column; gap:16px; }
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
    .nav-pills   { display:flex; gap:4px; }
    .nav-pill    { padding:6px 14px; border-radius:8px; text-decoration:none;
      font-size:12px; font-weight:500; color:var(--text-muted); border:1px solid transparent; transition:all 150ms; }
    .nav-pill:hover,.nav-pill.active { background:var(--bg-active); color:var(--accent); border-color:rgba(14,165,233,.3); }
    .section-title { margin:4px 0 0; font-size:13px; font-weight:600; color:var(--text-muted);
      letter-spacing:.04em; text-transform:uppercase; }
    .compliance-banner {
      display:flex; align-items:center; justify-content:space-between; gap:16px;
      padding:16px 20px; border-radius:12px; border:1px solid transparent;
    }
    .cb-ok   { background:rgba(34,197,94,.08);  border-color:rgba(34,197,94,.2); }
    .cb-fail { background:rgba(239,68,68,.08);   border-color:rgba(239,68,68,.2); }
    .cb-main { display:flex; align-items:baseline; gap:10px; }
    .cb-pct  { font-family:var(--font-mono); font-size:32px; font-weight:700; color:var(--text-primary); }
    .cb-label { font-size:13px; color:var(--text-muted); }
    .cb-counts { display:flex; gap:14px; }
    .cbc-ok   { font-size:13px; color:#22c55e; font-weight:600; }
    .cbc-fail { font-size:13px; color:#ef4444; font-weight:600; }
    .sev-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    @media(max-width:768px){ .sev-grid { grid-template-columns:repeat(2,1fr); } }
    .sev-card { background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:10px; }
    .sc-header { display:flex; align-items:center; justify-content:space-between; }
    .sc-target { font-size:11px; color:var(--text-muted); }
    .sc-body { display:flex; flex-direction:column; gap:6px; }
    .sc-numbers { display:flex; justify-content:space-between; }
    .sc-total { font-size:12px; color:var(--text-muted); }
    .sc-met   { font-size:12px; color:#22c55e; font-weight:600; }
    .sc-bar   { height:6px; background:var(--border-subtle); border-radius:3px; overflow:hidden; }
    .sc-bar-fill { height:100%; border-radius:3px; transition:width .6s; }
    .sc-pct   { font-family:var(--font-mono); font-size:14px; font-weight:700; }
    .pct-ok { color:#22c55e; } .pct-warn { color:#f59e0b; } .pct-fail { color:#ef4444; }
    .table-wrap { overflow-x:auto; }
    .sla-table { width:100%; border-collapse:collapse; font-size:12px; }
    .sla-table th {
      padding:8px 12px; text-align:left; font-size:10px; font-weight:600;
      letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted);
      border-bottom:1px solid var(--border-subtle);
    }
    .sla-table td { padding:9px 12px; border-bottom:1px solid var(--border-subtle); color:var(--text-secondary); }
    .sla-table tr:hover td { background:var(--bg-hover); }
    .row-fail td { background:rgba(239,68,68,.02); }
    .td-id   { font-family:var(--font-mono); font-size:11px; color:var(--text-muted); }
    .td-mono { font-family:var(--font-mono); }
    .text-red   { color:#ef4444; font-weight:600; }
    .text-green { color:#22c55e; font-weight:600; }
    .sla-pill { padding:2px 7px; border-radius:4px; font-size:11px; font-weight:600; }
    .sla-ok   { background:rgba(34,197,94,.1); color:#16a34a; }
    .sla-fail { background:rgba(239,68,68,.1); color:#dc2626; }
    .plat-chip { font-size:10px; padding:1px 5px; border-radius:3px;
      background:var(--bg-hover); color:var(--text-muted); margin-right:3px;
      font-family:var(--font-mono); font-weight:600; }
  `],
})
export class ManagerSlaComponent implements OnInit {
  loading = true;
  data: ManagerSlaReport | null = null;
  readonly severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  readonly slaTargets: Record<string, number> = { CRITICAL:30, HIGH:60, MEDIUM:120, LOW:240 };
 
  constructor(private manager: ManagerService) {}
 
  ngOnInit(): void {
    this.manager.getSlaReport().subscribe({
      next:  d => { this.data = d; this.loading = false; },
      error: () => this.loading = false,
    });
  }
 
  getCompliance(sev: string): number {
    const s = this.data?.by_severity[sev];
    if (!s || s.count === 0) return 0;
    return (s.met / s.count) * 100;
  }
}
 
