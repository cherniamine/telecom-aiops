// ═══════════════════════════════════════════════════════════════════════════════
// pages/noc/dashboard/noc-dashboard.component.ts
// Statuts realtime 5 plateformes + Cascade + Topology Graph NOC
// ═══════════════════════════════════════════════════════════════════════════════
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule }                 from '@angular/common';
import { interval, Subscription }       from 'rxjs';
import { switchMap, startWith }         from 'rxjs/operators';

import { DashboardService }             from '@app/services/Dashboard.service';
import { NocService, NocRealtimeResponse, PlatformRealtimeStatus }
  from '@app/services/noc.service';

import { LoadingSpinnerComponent }  from '@app/shared/components/loading-spinner/loading-spinner.component';
import { PlatformTagComponent }     from '@app/shared/components/platform-tag/platform-tag.component';
import { SeverityBadgeComponent }   from '@app/shared/components/severity-badge/severity-badge.component';
import { StatCardComponent }        from '@app/shared/components/stat-card/stat-card.component';
import { TimelineStepComponent }    from '@app/shared/components/timeline-step/timeline-step.component';
import { TimeAgoPipe }              from '@app/shared/pipes/time-ago.pipe';

import { TopologyGraphComponent }   from '../../../features/rca-panel/topology-graph.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector:   'app-noc-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    SeverityBadgeComponent, PlatformTagComponent,
    LoadingSpinnerComponent, StatCardComponent,
    TimelineStepComponent, TimeAgoPipe,
    TopologyGraphComponent,FormsModule ,
  ],
  template: `
    <div class="noc-dash">

      <!-- ── Header ──────────────────────────────────── -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard NOC</h1>
          <p class="page-sub">Supervision temps réel · Mise à jour toutes les 30s</p>
        </div>
        <div class="header-right">
          <span class="last-update" *ngIf="lastUpdate">
            Mis à jour {{ lastUpdate | timeAgo }}
          </span>
          <div class="live-badge">
            <span class="live-dot"></span>LIVE
          </div>
        </div>
      </div>

      <app-loading-spinner *ngIf="loading" label="Chargement du statut..." minHeight="300px"/>

      <ng-container *ngIf="!loading">

        <!-- ── Statut global ───────────────────────────── -->
        <div class="global-banner"
             [ngClass]="'banner-' + (realtime?.overall_status ?? 'UNKNOWN').toLowerCase()">
          <div class="banner-left">
            <span class="banner-dot"></span>
            <span class="banner-label">
              Statut global : {{ realtime?.overall_status ?? '—' }}
            </span>
          </div>
          <app-severity-badge [severity]="overview?.latest_severity ?? ''" size="sm"/>
        </div>

        <!-- ── KPI row ─────────────────────────────────── -->
        <div class="kpi-row">
          <app-stat-card label="Logs totaux"
            [value]="overview?.total_logs ?? 0" format="number" accent="cyan"/>
          <app-stat-card label="Anomalies"
            [value]="overview?.total_anomalies ?? 0" format="number"
            accent="amber" valueColor="amber"/>
          <app-stat-card label="Alertes actives"
            [value]="overview?.total_alerts ?? 0" format="number"
            [accent]="(overview?.total_alerts ?? 0) > 0 ? 'red' : 'green'"
            [valueColor]="(overview?.total_alerts ?? 0) > 0 ? 'red' : 'green'"/>
          <app-stat-card label="Remediations"
            [value]="overview?.total_remediations ?? 0" format="number" accent="violet"/>
        </div>

        <!-- ── Plateformes cards ───────────────────────── -->
        <h2 class="section-title">État des plateformes</h2>
        <div class="platform-grid">
          <div class="platform-card"
               *ngFor="let p of realtime?.platforms"
               [ngClass]="'pcard-' + p.status.toLowerCase()"
               (click)="onPlatformCardClick(p.platform)"
               [class.pcard-selected]="selectedPlatform === p.platform">
            <div class="pc-top">
              <app-platform-tag [platform]="p.platform" size="lg"/>
              <span class="pc-status-badge" [ngClass]="'pstatus-' + p.status.toLowerCase()">
                <span class="pstatus-dot"
                      [ngClass]="{'pulsing': p.status === 'CRITICAL' || p.status === 'DEGRADED'}">
                </span>
                {{ p.status }}
              </span>
            </div>
            <div class="pc-metrics">
              <div class="pc-metric">
                <span class="pcm-val" [class.pcm-alert]="p.anomalies_1h > 100">
                  {{ p.anomalies_1h | number }}
                </span>
                <span class="pcm-lbl">Anomalies (1h)</span>
              </div>
              <div class="pc-metric">
                <span class="pcm-val" [class.pcm-alert]="p.active_alerts > 0">
                  {{ p.active_alerts }}
                </span>
                <span class="pcm-lbl">Alertes actives</span>
              </div>
            </div>
            <div class="pc-bar">
              <div class="pc-bar-fill"
                   [style.width.%]="getBarWidth(p)"
                   [style.background]="getBarColor(p.status)">
              </div>
            </div>
          </div>
        </div>

        <!-- ── Topology + Cascade (2 colonnes) ────────── -->
        <div class="topo-cascade-row" *ngIf="cascadePath.length > 0">

          <!-- Topology Graph -->
          <div class="topo-card card">
            <div class="card-header">
              <span class="card-title">Topologie d'impact</span>
              <div class="card-header-right">
                <span class="topo-trigger" *ngIf="propagationTrigger">
                  Déclencheur : <strong>{{ propagationTrigger }}</strong>
                </span>
                <span class="topo-links">{{ causalLinks }} liens causaux</span>
              </div>
            </div>
            <div style="padding:0">
              <app-topology-graph
                [affectedPlatforms]="cascadePath"
                [rootPlatform]="rootPlatform"
                [causalLinks]="topoLinks"
                [platformAnomalies]="platformAnomaliesMap"
                [height]="260"
                (platformSelected)="onTopoPlatformSelected($event)"/>
            </div>

            <!-- Sélection info -->
            <div class="topo-info-bar" *ngIf="selectedPlatform">
              <span class="tib-name">{{ selectedPlatform }}</span>
              <span class="tib-sep">·</span>
              <span class="tib-status"
                    [ngClass]="'tib-' + (getPlatformStatus(selectedPlatform) || 'ok').toLowerCase()">
                {{ getPlatformStatus(selectedPlatform) }}
              </span>
              <span class="tib-anomalies">
                {{ getPlatformAnomalies(selectedPlatform) | number }} anomalies/1h
              </span>
              <button class="tib-close" (click)="selectedPlatform = ''">✕</button>
            </div>
          </div>

          <!-- Propagation timeline (cascade) -->
          <div class="cascade-card card">
            <div class="card-header">
              <span class="card-title">Cascade de propagation</span>
              <span class="cascade-coherence" *ngIf="coherenceScore !== null">
                {{ (coherenceScore * 100).toFixed(0) }}% cohérence
              </span>
            </div>
            <div class="card-body">
              <app-timeline-step
                [steps]="cascadePath"
                [activeIndex]="cascadeActiveIndex"
                direction="vertical"/>

              <!-- Root cause info -->
              <div class="root-cause-hint" *ngIf="propagationTrigger">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1L11 10H1L6 1z" stroke="#f59e0b" stroke-width="1.2"
                        stroke-linejoin="round"/>
                  <path d="M6 5v2.5M6 9v.5" stroke="#f59e0b" stroke-width="1.2"
                        stroke-linecap="round"/>
                </svg>
                <span>
                  Cause probable : <strong>{{ propagationTrigger }}</strong>
                </span>
              </div>
            </div>
          </div>

        </div>

        <!-- Fallback timeline si pas de cascadePath -->
        <div class="prop-section"
             *ngIf="cascadePath.length === 0 && propagationTrigger">
          <div class="prop-card card">
            <div class="card-body">
              <p class="prop-empty">
                Aucune cascade détectée · Déclencheur : <strong>{{ propagationTrigger }}</strong>
              </p>
            </div>
          </div>
        </div>

      </ng-container>
    </div>
  `,
  styles: [`
    .noc-dash { display:flex; flex-direction:column; gap:20px; }

  /* Header modernisé */
  .page-header { 
    display: flex; 
    align-items: flex-start; 
    justify-content: space-between; 
    gap: 16px;
    margin-bottom: 8px;
  }
  
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
  
  .page-sub { 
    margin: 6px 0 0 16px; 
    font-size: 13px; 
    color: var(--text-muted);
    letter-spacing: 0.01em;
  }

  .header-right { display:flex; align-items:center; gap:10px; flex-shrink:0; }
  .last-update  { font-size:11px; color:var(--text-faint); }

  .live-badge {
    display:flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px;
    background:rgba(239,68,68,.1); color:#ef4444; font-size:11px; font-weight:700;
    letter-spacing:.06em;
  }
  .live-dot {
    width:7px; height:7px; border-radius:50%; background:#ef4444;
    animation:blink .8s ease-in-out infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
    .live-dot {
      width:7px; height:7px; border-radius:50%; background:#ef4444;
      animation:blink .8s ease-in-out infinite;
    }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }

    /* Banner */
    .global-banner {
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 16px; border-radius:10px; border:1px solid transparent;
    }
    .banner-ok       { background:rgba(34,197,94,.08);   border-color:rgba(34,197,94,.25); }
    .banner-warning  { background:rgba(245,158,11,.08);  border-color:rgba(245,158,11,.25); }
    .banner-degraded { background:rgba(245,158,11,.1);   border-color:rgba(245,158,11,.3); }
    .banner-critical { background:rgba(239,68,68,.1);    border-color:rgba(239,68,68,.3); }
    .banner-unknown  { background:rgba(148,163,184,.08); border-color:rgba(148,163,184,.2); }
    .banner-left  { display:flex; align-items:center; gap:8px; }
    .banner-dot   { width:8px; height:8px; border-radius:50%; background:currentColor; flex-shrink:0; }
    .banner-label { font-size:13px; font-weight:500; }

    /* KPI */
    .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    @media(max-width:768px) { .kpi-row { grid-template-columns:repeat(2,1fr); } }

    /* Section title */
    .section-title { margin:0; font-size:14px; font-weight:600; color:var(--text-primary); }

    /* Platform grid */
    .platform-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; }
    @media(max-width:1100px) { .platform-grid { grid-template-columns:repeat(3,1fr); } }
    @media(max-width:700px)  { .platform-grid { grid-template-columns:repeat(2,1fr); } }

    .platform-card {
      background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:10px;
      transition:all 200ms; cursor:pointer;
    }
    .platform-card:hover { box-shadow:0 4px 16px rgba(0,0,0,.08); transform:translateY(-1px); }
    .pcard-selected { border-color:var(--accent) !important;
      box-shadow:0 0 0 2px rgba(14,165,233,.2) !important; }
    .pcard-critical { border-color:rgba(239,68,68,.3); background:rgba(239,68,68,.03); }
    .pcard-degraded { border-color:rgba(245,158,11,.3); }
    .pcard-warning  { border-color:rgba(245,158,11,.2); }

    .pc-top { display:flex; align-items:center; justify-content:space-between; gap:6px; }
    .pc-status-badge {
      display:flex; align-items:center; gap:4px; font-size:10px; font-weight:700;
      letter-spacing:.05em; padding:2px 7px; border-radius:4px;
      font-family:var(--font-mono);
    }
    .pstatus-ok       { background:rgba(34,197,94,.12);  color:#16a34a; }
    .pstatus-warning  { background:rgba(245,158,11,.12); color:#d97706; }
    .pstatus-degraded { background:rgba(245,158,11,.15); color:#b45309; }
    .pstatus-critical { background:rgba(239,68,68,.12);  color:#dc2626; }
    .pstatus-unknown  { background:rgba(148,163,184,.1); color:#64748b; }
    .pstatus-dot      { width:5px; height:5px; border-radius:50%; background:currentColor; flex-shrink:0; }
    .pulsing { animation:blink 1s ease-in-out infinite; }

    .pc-metrics { display:flex; gap:12px; }
    .pc-metric  { display:flex; flex-direction:column; flex:1; }
    .pcm-val    { font-family:var(--font-mono); font-size:18px; font-weight:700; color:var(--text-primary); }
    .pcm-alert  { color:#f59e0b; }
    .pcm-lbl    { font-size:10px; color:var(--text-faint); letter-spacing:.04em; }
    .pc-bar { height:3px; background:var(--border-subtle); border-radius:2px; overflow:hidden; }
    .pc-bar-fill { height:100%; border-radius:2px; transition:width .5s ease; }

    /* Topology + Cascade 2 colonnes */
    .topo-cascade-row { display:grid; grid-template-columns:1fr 360px; gap:14px; }
    @media(max-width:1000px) { .topo-cascade-row { grid-template-columns:1fr; } }

    /* Card */
    .card { background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:12px; overflow:hidden; }
    .card-header { padding:12px 16px 8px; display:flex; align-items:center;
      justify-content:space-between; border-bottom:1px solid var(--border-subtle); }
    .card-title  { font-size:13px; font-weight:600; color:var(--text-primary); }
    .card-body   { padding:14px 16px; }

    /* Topo card */
    .topo-card { }
    .card-header-right { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .topo-trigger { font-size:11px; color:var(--text-muted);
      strong { color:var(--text-primary); } }
    .topo-links { font-size:11px; padding:2px 7px; border-radius:4px;
      background:rgba(14,165,233,.08); color:var(--accent);
      font-family:var(--font-mono); font-weight:600; }

    .topo-info-bar {
      display:flex; align-items:center; gap:8px; flex-wrap:wrap;
      padding:8px 16px; border-top:1px solid var(--border-subtle);
      background:rgba(14,165,233,.04);
      animation:fade-in 200ms ease-out;
    }
    @keyframes fade-in { from{opacity:0} to{opacity:1} }
    .tib-name { font-family:var(--font-mono); font-size:13px; font-weight:700; color:var(--accent); }
    .tib-sep  { color:var(--border-default); }
    .tib-status { font-size:11px; font-weight:700; padding:1px 6px; border-radius:4px; }
    .tib-ok       { background:rgba(34,197,94,.1);  color:#22c55e; }
    .tib-critical { background:rgba(239,68,68,.1);  color:#ef4444; }
    .tib-degraded { background:rgba(245,158,11,.12);color:#d97706; }
    .tib-warning  { background:rgba(245,158,11,.1); color:#d97706; }
    .tib-anomalies { font-size:11px; color:var(--text-muted); font-family:var(--font-mono); }
    .tib-close { margin-left:auto; background:none; border:none; cursor:pointer;
      color:var(--text-faint); font-size:12px; padding:0;
      &:hover { color:var(--text-primary); } }

    /* Cascade card */
    .cascade-card { }
    .cascade-coherence { font-size:11px; color:#22c55e; font-weight:600;
      font-family:var(--font-mono); }
    .root-cause-hint {
      display:flex; align-items:center; gap:6px; margin-top:12px;
      padding:7px 10px; border-radius:7px;
      background:rgba(245,158,11,.08); border:1px solid rgba(245,158,11,.2);
      font-size:12px; color:var(--text-muted);
      strong { color:var(--text-primary); }
    }

    /* Fallback */
    .prop-section { }
    .prop-empty { margin:0; font-size:13px; color:var(--text-muted);
      strong { color:var(--text-primary); } }
  `],
})
export class NocDashboardComponent implements OnInit, OnDestroy {
  loading    = true;
  realtime:  NocRealtimeResponse | null = null;
  overview:  any = null;
  lastUpdate: string | null = null;

  // Propagation state
  cascadePath:       string[] = [];
  cascadeActiveIndex = -1;
  rootPlatform       = '';
  propagationTrigger = '';
  causalLinks        = 0;
  coherenceScore:    number | null = null;

  // Topology graph inputs
  topoLinks:           { source: string; target: string; weight: number }[] = [];
  platformAnomaliesMap: Record<string, number> = {};

  // UI
  selectedPlatform = '';

  private subs = new Subscription();

  constructor(
    private noc:       NocService,
    private dashboard: DashboardService,
  ) {}

  ngOnInit(): void {
    // Realtime polling every 30s
    this.subs.add(
      interval(30000).pipe(
        startWith(0),
        switchMap(() => this.noc.getRealtime()),
      ).subscribe(r => {
        this.realtime   = r;
        this.lastUpdate = new Date().toISOString();
        this.loading    = false;
        this.buildPlatformAnomalies(r);
      })
    );

    // Overview KPIs
    this.dashboard.getOverview().subscribe(o => this.overview = o);

    // Intelligence for cascade path & causal links
    this.dashboard.getIntelligence?.().subscribe((intel: any) => {
      if (!intel) return;
      this.cascadePath        = intel.timeline ?? [];
      this.propagationTrigger = intel.top_root_causes?.[0]?.[0] ?? '—';
      this.causalLinks        = intel.causal_relation_count ?? 0;
      this.rootPlatform       = intel.root_platform_analysis?.root_platform ?? '';
      this.coherenceScore     = intel.cascade_validation?.coherence_score ?? null;
      this.topoLinks          = intel.weighted_causal_links ?? [];

      // Find active (failing) index = root platform position in cascade
      this.cascadeActiveIndex = this.rootPlatform
        ? Math.max(0, this.cascadePath.findIndex(
            p => p.toUpperCase() === this.rootPlatform.toUpperCase()))
        : 0;
    });
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  // Build anomaly map from realtime platform data
  private buildPlatformAnomalies(realtime: NocRealtimeResponse): void {
    this.platformAnomaliesMap = {};
    (realtime.platforms ?? []).forEach(p => {
      this.platformAnomaliesMap[p.platform] = p.anomalies_1h;
    });
  }

  onPlatformCardClick(platform: string): void {
    this.selectedPlatform = this.selectedPlatform === platform ? '' : platform;
  }

  onTopoPlatformSelected(platform: string): void {
    this.selectedPlatform = this.selectedPlatform === platform ? '' : platform;
  }

  getPlatformStatus(platform: string): string {
    return this.realtime?.platforms
      ?.find(p => p.platform === platform)
      ?.status ?? 'UNKNOWN';
  }

  getPlatformAnomalies(platform: string): number {
    return this.platformAnomaliesMap[platform] ?? 0;
  }

  getBarWidth(p: PlatformRealtimeStatus): number {
    return Math.min(100, (p.anomalies_1h / 200) * 100);
  }

  getBarColor(status: string): string {
    const m: Record<string, string> = {
      OK: '#22c55e', WARNING: '#f59e0b', DEGRADED: '#f97316', CRITICAL: '#ef4444',
    };
    return m[status] ?? '#94a3b8';
  }
}