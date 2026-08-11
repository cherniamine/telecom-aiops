// ═══════════════════════════════════════════════════════════════════════════════
// analytics/analytics.component.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { PlatformTagComponent } from "@app/shared/components/platform-tag/platform-tag.component";
import { LoadingSpinnerComponent } from "@app/shared/components/loading-spinner/loading-spinner.component";
import { DashboardService } from "@app/services/Dashboard.service";
@Component({
  selector:   'app-analytics',
  standalone: true,
  imports: [CommonModule, PlatformTagComponent, LoadingSpinnerComponent,],
  template: `
    <div class="analytics-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Analytics</h1>
          <p class="page-sub">Heatmap · Timeline · Distribution par plateforme</p>
        </div>
      </div>
 
      <app-loading-spinner *ngIf="loading" minHeight="300px"/>
 
      <ng-container *ngIf="!loading">
 
        <!-- Heatmap -->
        <h2 class="section-title">Distribution anomalies par plateforme</h2>
        <div class="heatmap-card card">
          <div class="card-body">
            <div class="hm-row" *ngFor="let item of heatmap; let i = index">
              <app-platform-tag [platform]="item._id" size="lg"/>
              <div class="hm-bar-wrap">
                <div class="hm-bar">
                  <div class="hm-fill"
                       [style.width.%]="getBarPct(item.count)"
                       [style.background]="getPlatformColor(item._id)">
                  </div>
                </div>
                <span class="hm-count">{{ item.count | number }}</span>
                <span class="hm-pct">({{ getBarPct(item.count) | number:'1.1-1' }}%)</span>
              </div>
            </div>
          </div>
        </div>
 
        <!-- Timeline summary -->
        <h2 class="section-title">Résumé d'incidents</h2>
        <div class="timeline-card card" *ngIf="intelligence">
          <div class="card-body">
            <p class="tl-summary">{{ intelligence.summary }}</p>
            <div class="tl-stats">
              <div class="tl-stat">
                <span class="tls-val">{{ intelligence.cluster_count }}</span>
                <span class="tls-lbl">Clusters</span>
              </div>
              <div class="tl-stat">
                <span class="tls-val">{{ intelligence.causal_relation_count }}</span>
                <span class="tls-lbl">Liens causaux</span>
              </div>
              <div class="tl-stat">
                <span class="tls-val">{{ intelligence.total_anomalies | number }}</span>
                <span class="tls-lbl">Anomalies</span>
              </div>
            </div>
            <!-- Root causes bar -->
            <div class="rca-list">
              <div class="rca-item" *ngFor="let rc of intelligence.top_root_causes?.slice(0,6)">
                <span class="rca-kw">{{ rc[0] }}</span>
                <div class="rca-bar">
                  <div class="rca-fill"
                       [style.width.%]="getRcaPct(rc[1])"
                       [style.background]="getRcaColor(rc[0])">
                  </div>
                </div>
                <span class="rca-count">{{ rc[1] | number }}</span>
              </div>
            </div>
          </div>
        </div>
 
      </ng-container>
    </div>
  `,
  styles: [`
    .analytics-page { display:flex; flex-direction:column; gap:16px; }
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
    .page-sub    { margin:4px 0 0; font-size:12px; color:var(--text-muted); }
    .section-title { margin:4px 0 0; font-size:13px; font-weight:600; color:var(--text-muted);
      letter-spacing:.04em; text-transform:uppercase; }
    .card { background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:12px; }
    .card-body { padding:16px 20px; }
    .hm-row { display:flex; align-items:center; gap:14px; margin-bottom:10px; }
    .hm-bar-wrap { flex:1; display:flex; align-items:center; gap:10px; }
    .hm-bar  { flex:1; height:8px; background:var(--border-subtle); border-radius:4px; overflow:hidden; }
    .hm-fill { height:100%; border-radius:4px; transition:width .6s ease; }
    .hm-count { font-family:var(--font-mono); font-size:13px; font-weight:600;
      color:var(--text-primary); min-width:70px; text-align:right; }
    .hm-pct   { font-size:11px; color:var(--text-muted); min-width:52px; }
    .tl-summary { margin:0 0 14px; font-size:13px; color:var(--text-secondary); line-height:1.6; }
    .tl-stats { display:flex; gap:24px; margin-bottom:16px; padding-bottom:16px;
      border-bottom:1px solid var(--border-subtle); }
    .tl-stat  { display:flex; flex-direction:column; gap:2px; }
    .tls-val  { font-family:var(--font-mono); font-size:20px; font-weight:700; color:var(--accent); }
    .tls-lbl  { font-size:11px; color:var(--text-faint); letter-spacing:.05em; }
    .rca-list { display:flex; flex-direction:column; gap:7px; }
    .rca-item { display:flex; align-items:center; gap:12px; }
    .rca-kw   { font-family:var(--font-mono); font-size:12px; font-weight:600;
      color:var(--text-primary); min-width:100px; }
    .rca-bar  { flex:1; height:7px; background:var(--border-subtle); border-radius:4px; overflow:hidden; }
    .rca-fill { height:100%; border-radius:4px; }
    .rca-count { font-size:11px; color:var(--text-muted); font-family:var(--font-mono);
      min-width:70px; text-align:right; }
  `],
})
export class AnalyticsComponent implements OnInit {
  loading     = true;
  heatmap:    { _id: string; count: number }[] = [];
  intelligence: any = null;
  maxCount    = 1;
 
  constructor(private dashboard: DashboardService) {}
 
  ngOnInit(): void {
    this.dashboard.getHeatmap().subscribe(h => {
      this.heatmap  = this.normalizeHeatmap(h);
      this.maxCount = Math.max(...this.heatmap.map(x => x.count), 1);
    });
    this.dashboard.getIntelligence?.().subscribe((i: any) => { this.intelligence = i; this.loading = false; });
    setTimeout(() => this.loading = false, 2000);
  }
 
  normalizeHeatmap(data: { _id: string; count: number }[]): { _id: string; count: number }[] {
    const grouped = data.reduce((map, item) => {
      const key = (item._id ?? '').trim().toUpperCase();
      if (!key) { return map; }
      map[key] = (map[key] ?? 0) + Number(item.count ?? 0);
      return map;
    }, {} as Record<string, number>);

    const order = ['MMG', 'DMC', 'SMSC', 'SMPPC', 'SMPPS'];
    return Object.entries(grouped)
      .map(([platform, count]) => ({ _id: platform, count }))
      .sort((a, b) => {
        const ia = order.indexOf(a._id);
        const ib = order.indexOf(b._id);
        if (ia !== -1 || ib !== -1) {
          return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
        }
        return b.count - a.count;
      });
  }

  getBarPct(count: number): number { return (count / this.maxCount) * 100; }
 
  getPlatformColor(p: string): string {
    const m: Record<string, string> = {
      MMG:'#d97706', SMSC:'#dc2626', SMPPS:'#2563eb', SMPPC:'#4f46e5', DMC:'#16a34a',
    };
    return m[p?.toUpperCase()] ?? '#94a3b8';
  }
 
  getRcaMax(): number {
    return Math.max(...(this.intelligence?.top_root_causes?.map((r: any) => r[1]) ?? [1]), 1);
  }
 
  getRcaPct(count: number): number { return (count / this.getRcaMax()) * 100; }
 
  getRcaColor(kw: string): string {
    const m: Record<string, string> = {
      fail:'#ef4444', error:'#f87171', timeout:'#f59e0b', retry:'#3b82f6',
      refused:'#6366f1', disconnect:'#a855f7', 'queue full':'#f97316', drop:'#94a3b8',
    };
    return m[kw?.toLowerCase()] ?? '#64748b';
  }
}
 
