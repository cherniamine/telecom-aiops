// ═══════════════════════════════════════════════════════════════════════════════
// pages/incidents/detail/incident-detail.component.ts
// Page complète : cascade + RCA + Topology Graph + What-If + Copilot + FAISS
// ═══════════════════════════════════════════════════════════════════════════════
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule }                 from '@angular/common';
import { ActivatedRoute, RouterLink }   from '@angular/router';
import { Subscription }                 from 'rxjs';

// Services
import { IncidentService }   from '@app/services/Incident.service';
import { DashboardService }  from '@app/services/Dashboard.service';

// Shared
import { SeverityBadgeComponent }  from '../../../shared/components/severity-badge/severity-badge.component';
import { PlatformTagComponent }    from '../../../shared/components/platform-tag/platform-tag.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { TimeAgoPipe }             from '../../../shared/pipes/time-ago.pipe';

// Features
import { CascadeTimelineComponent }  from '../../../features/cascade-timeline/cascade-timeline.component';
import { RcaPanelComponent }         from '../../../features/rca-panel/rca-panel.component';
import { TopologyGraphComponent }    from '../../../features/rca-panel/topology-graph.component';
import { WhatIfPanelComponent }      from '../../../features/what-if-simulator/what-if-panel.component';
import { WhatIfResultComponent }     from '../../../features/what-if-simulator/what-if-result.component';
import { WhatIfCompareComponent }    from '../../../features/what-if-simulator/what-if-compare.component';
import { ExplainPanelComponent }     from '../../../features/ai-copilot/explain-panel.component';
import { CopilotChatComponent }      from '../../../features/ai-copilot/copilot-chat.component';
import { SimilaritySearchComponent } from '../../../features/similarity-search/similarity-search.component';
import { IncidentInvestigationComponent } from '../../../features/incident-investigation/incident-investigation.component';
import { TabIconComponent } from '@app/shared/components/tab-icon/tab-icon.component';
import { FormsModule } from '@angular/forms';

type TabId = 'overview' | 'rca' | 'investigation' | 'whatif' | 'copilot' | 'faiss';
interface Tab { id: TabId; label: string; icon: string; badge?: string; }

@Component({
  selector:   'app-incident-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, TimeAgoPipe,TabIconComponent,FormsModule,
    SeverityBadgeComponent, PlatformTagComponent, LoadingSpinnerComponent,
    CascadeTimelineComponent, RcaPanelComponent, TopologyGraphComponent,
    WhatIfPanelComponent, WhatIfResultComponent, WhatIfCompareComponent,
    ExplainPanelComponent, CopilotChatComponent, SimilaritySearchComponent,
    IncidentInvestigationComponent,
  ],
  template: `
    <div class="inc-detail" *ngIf="!loading; else spin">

      <!-- Breadcrumb -->
      <nav class="breadcrumb">
        <a routerLink="/incidents" class="bc-link">Incidents</a>
        <span class="bc-sep">›</span>
        <span class="bc-current">#{{ incidentId.slice(-8).toUpperCase() }}</span>
      </nav>

      <!-- Hero -->
      <div class="hero" *ngIf="incident">
        <div class="hero-left">
          <app-severity-badge [severity]="incident.severity?.label ?? ''" size="lg"/>
          <div class="hero-meta">
            <h1 class="hero-id">Incident #{{ incident._id.slice(-8).toUpperCase() }}</h1>
            <p class="hero-time">
              Ouvert {{ incident.created_at | timeAgo }}
              <span class="hero-status" [ngClass]="'hs-' + incident.status">{{ incident.status }}</span>
            </p>
          </div>
        </div>
        <div class="hero-right">
          <div class="hero-stats">
            <div class="hs-item">
              <span class="hsi-val">{{ incident.total_anomalies | number }}</span>
              <span class="hsi-lbl">anomalies</span>
            </div>
            <div class="hs-item">
              <span class="hsi-val">{{ incident.clusters }}</span>
              <span class="hsi-lbl">clusters</span>
            </div>
            <div class="hs-item">
              <span class="hsi-val">{{ incident.causal_links }}</span>
              <span class="hsi-lbl">liens causaux</span>
            </div>
          </div>
          <div class="hero-platforms">
            <app-platform-tag *ngFor="let p of incident.platforms" [platform]="p" size="md"/>
          </div>
        </div>
      </div>

      <!-- Cascade (always visible) -->
      <div class="cascade-section" *ngIf="cascadeSteps.length">
        <app-cascade-timeline
          [steps]="cascadeSteps"
          [activeIndex]="activeIndex"
          [summary]="cascadeSummary"
          [trigger]="cascadeTrigger"
          [rootIndex]="rootIndex"
          [coherenceScore]="coherenceScore"/>
      </div>

      <!-- Tabs -->
      <div class="tab-nav">
        <button class="tab-btn" *ngFor="let t of tabs"
                [class.tab-active]="activeTab === t.id"
                (click)="activeTab = t.id">
          <app-tab-icon [id]="t.id"/>
          <span>{{ t.label }}</span>
          <span class="tab-badge" *ngIf="t.badge">{{ t.badge }}</span>
        </button>
      </div>

      <div class="tab-content">

        <!-- ── OVERVIEW ──────────────────────── -->
        <div *ngIf="activeTab === 'overview'" class="panel-overview">
          <div class="intel-card card" *ngIf="intelligence">
            <div class="card-header">
              <span class="card-title">Résumé intelligence</span>
              <span class="intel-badge" *ngIf="intelligence.topology_aware">topology-aware</span>
            </div>
            <div class="card-body">
              <p class="intel-summary">{{ intelligence.summary }}</p>
              <div class="intel-timeline">
                <div class="it-step" *ngFor="let step of intelligence.timeline; let i = index"
                     [style.animation-delay]="(i * 60) + 'ms'">
                  <span class="its-num">{{ i + 1 }}</span>
                  <span class="its-text">{{ step }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="two-col">
            <div class="card" *ngIf="incident?.impact">
              <div class="card-header"><span class="card-title">Impact</span></div>
              <div class="card-body impact-body">
                <div class="impact-row">
                  <span class="ir-lbl">Dégradation SMS</span>
                  <span class="ir-val" [ngClass]="smsColor">{{ incident.impact.sms_delivery_degradation }}</span>
                </div>
                <div class="impact-row">
                  <span class="ir-lbl">Risque propagation</span>
                  <span class="ir-val" [ngClass]="propColor">{{ incident.impact.propagation_risk }}</span>
                </div>
                <div class="impact-row">
                  <span class="ir-lbl">Plateformes</span>
                  <div class="ir-platforms">
                    <app-platform-tag *ngFor="let p of incident.impact.affected_platforms"
                                      [platform]="p" size="sm"/>
                  </div>
                </div>
              </div>
            </div>
            <div class="card" *ngIf="remediation?.recommended_actions?.length">
              <div class="card-header"><span class="card-title">Actions recommandées</span></div>
              <div class="card-body">
                <div class="action-item"
                     *ngFor="let a of remediation.recommended_actions; let i = index">
                  <span class="ai-num">{{ i + 1 }}</span>
                  <span class="ai-text">{{ a }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── RCA + TOPOLOGY ────────────────── -->
        <div *ngIf="activeTab === 'rca'" class="panel-rca">

          <!-- RCA Panel complet (bar chart + cascade + validation interne) -->
          <app-rca-panel
            [rootCauses]="incident?.root_cause?.root_causes ?? []"
            [cascadePath]="cascadeSteps"
            [cascadeSummary]="cascadeSummary"
            [activeIndex]="activeIndex"
            [rootPlatform]="rootPlatform"
            [rootPlatformAnalysis]="incident?.root_cause?.root_platform_analysis"
            [rootIdx]="rootIndex"
            [trigger]="cascadeTrigger"
            [topologyAware]="intelligence?.topology_aware ?? false"
            [cascadeVal]="incident?.root_cause?.cascade_validation"
            [causalLinks]="incident?.causal_links ?? 0"
            [platformStats]="platformStatsMap"/>

          <!-- Topology Graph standalone (grand format interactif) -->
          <div class="card topo-standalone">
            <div class="card-header">
              <span class="card-title">Topologie interactive des plateformes</span>
              <div class="topo-header-right">
                <span class="topo-hint">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/>
                    <path d="M6 4v3.5M6 9v.5" stroke="currentColor" stroke-width="1.2"
                          stroke-linecap="round"/>
                  </svg>
                  Cliquez sur un nœud
                </span>
                <span class="topo-root-badge" *ngIf="rootPlatform">
                  Root : <strong>{{ rootPlatform }}</strong>
                </span>
              </div>
            </div>

            <!-- Graph (padding:0 pour que le SVG s'étende) -->
            <div style="padding:0">
              <app-topology-graph
                [affectedPlatforms]="incident?.platforms ?? []"
                [rootPlatform]="rootPlatform"
                [causalLinks]="topoLinks"
                [platformAnomalies]="anomalyCountMap"
                [height]="320"
                (platformSelected)="onPlatformSelected($event)"/>
            </div>

            <!-- Selected platform banner -->
            <div class="topo-selected-banner" *ngIf="selectedPlatform">
              <span class="tsb-platform">{{ selectedPlatform }}</span>
              <span class="tsb-sep">·</span>
              <span class="tsb-info">
                {{ getAnomalyCount(selectedPlatform) | number }} anomalies détectées
              </span>
              <span class="tsb-sep" *ngIf="isRootPlatform(selectedPlatform)">·</span>
              <span class="tsb-root" *ngIf="isRootPlatform(selectedPlatform)">
                🎯 Plateforme racine probable
              </span>
              <button class="tsb-close" (click)="selectedPlatform = ''">✕</button>
            </div>
          </div>
        </div>

        <!-- ── INVESTIGATION ─────────────────── -->
        <div *ngIf="activeTab === 'investigation'" class="panel-investigation">
          <app-incident-investigation [incident]="incident"/>
        </div>

        <!-- ── WHAT-IF ──────────────────────── -->
        <div *ngIf="activeTab === 'whatif'" class="panel-whatif">
          <div class="whatif-layout">
            <app-what-if-panel
              [incidentId]="incidentId"
              (simulated)="onSimulated($event)"
              (compared)="onCompared($event)"/>
            <div class="whatif-right">
              <app-what-if-result  *ngIf="simResult && !compareResult"   [result]="simResult"/>
              <app-what-if-compare *ngIf="compareResult" [comparison]="compareResult"/>
              <div class="whatif-empty" *ngIf="!simResult && !compareResult">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="17" stroke="var(--border-default)"
                          stroke-width="1.5" stroke-dasharray="4 3"/>
                  <path d="M20 12v8M20 24v4" stroke="var(--border-default)"
                        stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <p>Sélectionnez une action et cliquez sur <strong>Simuler</strong></p>
              </div>
            </div>
          </div>
        </div>

        <!-- ── COPILOT ──────────────────────── -->
        <div *ngIf="activeTab === 'copilot'" class="panel-copilot">
          <div class="copilot-layout">
            <app-explain-panel [incidentId]="incidentId"/>
            <app-copilot-chat  [incidentId]="incidentId" [userInitial]="userInitial"/>
          </div>
        </div>

        <!-- ── FAISS ───────────────────────── -->
        <div *ngIf="activeTab === 'faiss'" class="panel-faiss">
          <app-similarity-search [totalVectors]="7224549"/>
        </div>

      </div>
    </div>

    <ng-template #spin>
      <app-loading-spinner label="Chargement de l'incident..." minHeight="400px"/>
    </ng-template>
  `,
  styles: [`
    :host { display:block; }
    .inc-detail { display:flex; flex-direction:column; gap:18px; }

    .breadcrumb { display:flex; align-items:center; gap:6px; font-size:13px; }
    .bc-link    { color:var(--accent); text-decoration:none;
                  &:hover { text-decoration:underline; } }
    .bc-sep     { color:var(--text-faint); }
    .bc-current { color:var(--text-muted); font-family:var(--font-mono); font-size:12px; }

    .hero { display:flex; align-items:flex-start; justify-content:space-between; gap:16px;
      padding:18px 20px; background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:14px; flex-wrap:wrap; }
    .hero-left { display:flex; align-items:center; gap:14px; }
    .hero-meta  { display:flex; flex-direction:column; gap:3px; }
    .hero-id    { margin:0; font-size:20px; font-weight:700; color:var(--text-primary);
      letter-spacing:-.02em; font-family:var(--font-mono); }
    .hero-time  { margin:0; font-size:12px; color:var(--text-muted);
      display:flex; align-items:center; gap:8px; }
    .hero-status { padding:2px 7px; border-radius:4px; font-size:10px; font-weight:700; }
    .hs-open     { background:rgba(239,68,68,.1);  color:#dc2626; }
    .hs-resolved { background:rgba(34,197,94,.1);  color:#16a34a; }
    .hs-acknowledged { background:rgba(245,158,11,.1); color:#d97706; }
    .hero-right  { display:flex; flex-direction:column; gap:10px; align-items:flex-end; }
    .hero-stats  { display:flex; gap:20px; }
    .hs-item     { display:flex; flex-direction:column; align-items:center; gap:2px; }
    .hsi-val     { font-family:var(--font-mono); font-size:20px; font-weight:700;
      color:var(--text-primary); line-height:1; }
    .hsi-lbl     { font-size:10px; color:var(--text-faint); letter-spacing:.04em; }
    .hero-platforms { display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end; }

    .cascade-section { background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:12px; padding:16px 20px; }

    .tab-nav { display:flex; gap:4px; border-bottom:1px solid var(--border-subtle);
      overflow-x:auto; scrollbar-width:none; }
    .tab-nav::-webkit-scrollbar { display:none; }
    .tab-btn { display:flex; align-items:center; gap:7px; padding:9px 16px;
      border:none; background:transparent; cursor:pointer; color:var(--text-muted);
      font-size:13px; font-weight:500; border-bottom:2px solid transparent;
      margin-bottom:-1px; transition:all 150ms; white-space:nowrap; border-radius:8px 8px 0 0; }
    .tab-btn:hover { color:var(--text-primary); background:var(--bg-hover); }
    .tab-active    { color:var(--accent) !important;
      border-bottom-color:var(--accent) !important;
      background:rgba(14,165,233,.05) !important; }
    .tab-icon  { display:flex; align-items:center; svg { width:15px; height:15px; } }
    .tab-badge { padding:1px 5px; border-radius:4px; font-size:9px; font-weight:700;
      background:rgba(167,139,250,.15); color:#a78bfa; }

    .tab-content { animation:fade-up 200ms ease-out; }
    @keyframes fade-up { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }

    .card { background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:12px; overflow:hidden; }
    .card-header { padding:12px 16px 8px; display:flex; align-items:center;
      justify-content:space-between; border-bottom:1px solid var(--border-subtle); }
    .card-title  { font-size:13px; font-weight:600; color:var(--text-primary); }
    .card-body   { padding:14px 16px; }

    /* Overview */
    .panel-overview { display:flex; flex-direction:column; gap:14px; }
    .intel-card .card-body { display:flex; flex-direction:column; gap:12px; }
    .intel-badge { font-size:10px; padding:2px 7px; border-radius:4px;
      background:rgba(14,165,233,.1); color:var(--accent); font-weight:600; }
    .intel-summary { margin:0; font-size:13px; color:var(--text-secondary); line-height:1.6; }
    .intel-timeline { display:flex; flex-direction:column; gap:5px; }
    .it-step { display:flex; align-items:flex-start; gap:10px; font-size:12px;
      color:var(--text-muted); animation:fade-in 300ms ease-out both; }
    @keyframes fade-in { from{opacity:0} to{opacity:1} }
    .its-num { width:20px; height:20px; border-radius:50%; background:var(--bg-hover);
      display:flex; align-items:center; justify-content:center;
      font-size:10px; font-weight:700; color:var(--accent); flex-shrink:0; }
    .its-text { line-height:1.5; }
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    @media(max-width:768px){ .two-col { grid-template-columns:1fr; } }
    .impact-body { display:flex; flex-direction:column; gap:8px; }
    .impact-row  { display:flex; align-items:center; justify-content:space-between; gap:8px;
      padding:5px 0; border-bottom:1px solid var(--border-subtle);
      &:last-child { border:none; } }
    .ir-lbl { font-size:12px; color:var(--text-muted); }
    .ir-val { font-size:12px; font-weight:600; }
    .ir-platforms { display:flex; gap:4px; flex-wrap:wrap; }
    .text-red{color:#ef4444} .text-amber{color:#f59e0b} .text-green{color:#22c55e}
    .action-item { display:flex; gap:10px; padding:5px 0;
      border-bottom:1px solid var(--border-subtle); &:last-child{border:none;} }
    .ai-num { width:18px; height:18px; border-radius:50%; background:rgba(14,165,233,.1);
      display:flex; align-items:center; justify-content:center;
      font-size:10px; font-weight:700; color:var(--accent); flex-shrink:0; }
    .ai-text { font-size:12px; color:var(--text-secondary); line-height:1.5; }

    /* RCA tab */
    .panel-rca { display:flex; flex-direction:column; gap:14px; }

    .topo-standalone { }
    .topo-header-right { display:flex; align-items:center; gap:10px; }
    .topo-hint { display:flex; align-items:center; gap:4px;
      font-size:11px; color:var(--text-faint); }
    .topo-root-badge { font-size:11px; color:var(--text-muted);
      strong { color:#ef4444; } }
    .topo-selected-banner {
      display:flex; align-items:center; gap:8px; flex-wrap:wrap;
      padding:8px 16px; border-top:1px solid var(--border-subtle);
      background:rgba(14,165,233,.04);
      animation:fade-in 200ms ease-out;
    }
    .tsb-platform { font-family:var(--font-mono); font-size:13px;
      font-weight:700; color:var(--accent); }
    .tsb-sep  { color:var(--border-default); }
    .tsb-info { font-size:12px; color:var(--text-muted); }
    .tsb-root { font-size:12px; color:#ef4444; font-weight:600; }
    .tsb-close { margin-left:auto; background:none; border:none; cursor:pointer;
      color:var(--text-faint); font-size:12px; padding:0;
      &:hover { color:var(--text-primary); } }

    /* What-If */
    .panel-whatif { }
    .whatif-layout { display:grid; grid-template-columns:340px 1fr; gap:14px; }
    @media(max-width:900px){ .whatif-layout { grid-template-columns:1fr; } }
    .whatif-right { }
    .whatif-empty { display:flex; flex-direction:column; align-items:center; gap:10px;
      padding:48px 24px; text-align:center; background:var(--bg-card);
      border:1px solid var(--border-subtle); border-radius:12px; color:var(--text-faint);
      p { margin:0; font-size:13px; color:var(--text-muted);
        strong { color:var(--text-secondary); } }
    }

    /* Copilot */
    .panel-copilot { }
    .copilot-layout { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    @media(max-width:900px){ .copilot-layout { grid-template-columns:1fr; } }
  `],
})
export class IncidentDetailComponent implements OnInit, OnDestroy {
  incidentId    = '';
  loading       = true;
  incident:     any = null;
  intelligence: any = null;
  remediation:  any = null;
  simResult:    any = null;
  compareResult: any = null;

  // Cascade & topology state
  cascadeSteps:   string[] = [];
  activeIndex     = -1;
  cascadeSummary  = '';
  cascadeTrigger  = '';
  rootIndex       = 0;
  coherenceScore: number | null = null;
  rootPlatform    = '';
  selectedPlatform = '';

  // Topology graph inputs
  topoLinks:        { source: string; target: string; weight: number }[] = [];
  anomalyCountMap:  Record<string, number>              = {};
  platformStatsMap: Record<string, { anomalies: number }> = {};

  // UI
  activeTab: TabId = 'overview';
  userInitial = 'U';

    readonly tabs: Tab[] = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: 'dashboard' },
    { id: 'rca',      label: 'RCA + Topo',       icon: 'network' },
    { id: 'investigation', label: 'Investigation', icon: 'investigation', badge: 'AI' },
    { id: 'whatif',   label: 'What-If', icon: 'simulation', badge: 'AI' },
    { id: 'copilot',  label: 'Copilot',  icon: 'ai', badge: 'AI' },
    { id: 'faiss',    label: 'Similarité', icon: 'search', badge: 'AI' },
  ];

  private sub = new Subscription();

  constructor(
    private route:     ActivatedRoute,
    private incidents: IncidentService,
    private dashboard: DashboardService,
  ) {}

  ngOnInit(): void {
    this.incidentId = this.route.snapshot.paramMap.get('id') ?? 'latest';
    this.loadData();
  }

  private loadData(): void {
    this.incidents.getIncidents().subscribe({
      next: list => {
        this.incident = Array.isArray(list)
          ? (list.find((i: any) => i._id === this.incidentId) ?? list[0])
          : null;
        if (this.incident) {
          this.incidentId = this.incident._id;
          this.buildCascade();
          this.buildTopoInputs();
        }
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
    this.incidents.getIntelligence().subscribe(i => { this.intelligence = i; });
    this.dashboard.getRemediation().subscribe(r => { this.remediation = r; });
  }

  private buildCascade(): void {
    if (!this.incident) return;
    const tl = this.incident.timeline?.timeline
            ?? this.incident.incident_intelligence?.timeline
            ?? this.incident.platforms ?? [];
    this.cascadeSteps   = tl;
    this.cascadeSummary = this.incident.timeline?.summary ?? '';
    this.rootPlatform   = this.incident.root_cause?.root_platform_analysis?.root_platform ?? '';
    this.rootIndex      = Math.max(0,
      tl.findIndex((p: string) => p.toUpperCase() === this.rootPlatform.toUpperCase()));
    this.activeIndex    = this.incident.status === 'open' ? this.rootIndex : -1;
    this.coherenceScore = this.incident.root_cause?.cascade_validation?.coherence_score ?? null;
    this.cascadeTrigger = this.incident.root_cause?.root_causes?.[0]?.[0] ?? '';
  }

  private buildTopoInputs(): void {
    if (!this.incident) return;
    // Causal links
    this.topoLinks = this.incident.root_cause?.weighted_causal_links
      ?? this.incident.root_cause?.root_platform_analysis?.weighted_causal_links ?? [];

    // Anomaly counts per platform
    this.anomalyCountMap  = {};
    this.platformStatsMap = {};
    const platforms = ['MMG','SMSC','SMPPS','SMPPC','DMC'];

    (this.incident.root_cause?.root_causes ?? []).forEach(([kw, count]: [string, number]) => {
      if (platforms.includes(kw.toUpperCase())) {
        this.anomalyCountMap[kw.toUpperCase()]  = Number(count);
        this.platformStatsMap[kw.toUpperCase()] = { anomalies: Number(count) };
      }
    });
    (this.incident.root_cause?.platform_counts ?? []).forEach(([p, c]: [string, number]) => {
      this.anomalyCountMap[p]  = Number(c);
      this.platformStatsMap[p] = { anomalies: Number(c) };
    });
  }

  onPlatformSelected(platform: string): void {
    this.selectedPlatform = this.selectedPlatform === platform ? '' : platform;
  }

  getAnomalyCount(platform: string): number {
    return this.anomalyCountMap[platform] ?? 0;
  }

  isRootPlatform(platform: string): boolean {
    return platform === this.rootPlatform;
  }

  onSimulated(result: any): void  { this.simResult = result; this.compareResult = null; }
  onCompared(result: any): void   { this.compareResult = result; this.simResult = null; }

  get smsColor(): string {
    const v = this.incident?.impact?.sms_delivery_degradation;
    return v === 'HIGH' ? 'text-red' : v === 'MEDIUM' ? 'text-amber' : 'text-green';
  }

  get propColor(): string {
    const v = this.incident?.impact?.propagation_risk;
    return v === 'HIGH' ? 'text-red' : v === 'MEDIUM' ? 'text-amber' : 'text-green';
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }
}
