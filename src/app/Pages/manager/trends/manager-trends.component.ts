// ═══════════════════════════════════════════════════════════════════════════════
// manager-trends.component.ts
// Route : /manager/trends
// Graphiques 30 jours : incidents/jour + anomalies par plateforme
// ═══════════════════════════════════════════════════════════════════════════════
import { Component, OnInit, AfterViewInit, OnDestroy,
         ViewChild, ElementRef, ChangeDetectionStrategy,
         ChangeDetectorRef }        from '@angular/core';
import { CommonModule }             from '@angular/common';
import { RouterLink }               from '@angular/router';
import { ManagerService, ManagerTrends } from '../../../services/manager.service';
import { StatCardComponent }        from '../../../shared/components/stat-card/stat-card.component';
import { LoadingSpinnerComponent }  from '../../../shared/components/loading-spinner/loading-spinner.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector:   'app-manager-trends',
  standalone: true,
  imports:    [CommonModule, RouterLink, StatCardComponent, LoadingSpinnerComponent,FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="trends-page">

      <!-- Header + nav -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Tendances</h1>
          <p class="page-sub" *ngIf="data">{{ data.period_days }} derniers jours</p>
        </div>
        <div class="header-right">
          <div class="period-btns">
            <button class="pb" [class.pb-active]="days === 7"  (click)="setDays(7)">7j</button>
            <button class="pb" [class.pb-active]="days === 14" (click)="setDays(14)">14j</button>
            <button class="pb" [class.pb-active]="days === 30" (click)="setDays(30)">30j</button>
          </div>
          <div class="nav-pills">
            <a routerLink="../kpis"   class="nav-pill">KPIs</a>
            <a routerLink="../trends" class="nav-pill active">Tendances</a>
            <a routerLink="../sla"    class="nav-pill">SLA</a>
          </div>
        </div>
      </div>

      <app-loading-spinner *ngIf="loading" label="Chargement des tendances..." minHeight="300px"/>

      <ng-container *ngIf="!loading && data">

        <!-- Summary KPIs -->
        <div class="kpi-row">
          <app-stat-card label="Incidents total"
            [value]="totalIncidents" format="number" accent="blue"/>
          <app-stat-card label="Incidents critiques"
            [value]="totalCritical" format="number" accent="red" valueColor="red"/>
          <app-stat-card label="Pic quotidien"
            [value]="peakDay" format="number" accent="amber" valueColor="amber"
            [subtitle]="peakDayLabel"/>
          <app-stat-card label="Moy. par jour"
            [value]="avgPerDay.toFixed(1)" format="raw" accent="cyan"/>
        </div>

        <!-- Incidents timeline chart -->
        <div class="chart-card card">
          <div class="card-header">
            <span class="card-title">Incidents par jour</span>
            <div class="legend-row">
              <span class="legend-dot" style="background:#0ea5e9"></span>
              <span class="legend-label">Total</span>
              <span class="legend-dot" style="background:#ef4444"></span>
              <span class="legend-label">CRITICAL</span>
            </div>
          </div>
          <div class="card-body chart-body">
            <div class="chart-wrap">
              <canvas #incChart></canvas>
            </div>
          </div>
        </div>

        <!-- Anomalies by platform chart + mini distribution -->
        <div class="two-col">

          <div class="chart-card card">
            <div class="card-header">
              <span class="card-title">Anomalies par plateforme</span>
            </div>
            <div class="card-body chart-body">
              <div class="chart-wrap" style="height:220px">
                <canvas #platChart></canvas>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">Distribution</span>
            </div>
            <div class="card-body distrib-body">
              <div class="distrib-item" *ngFor="let p of platformStats">
                <div class="di-top">
                  <span class="di-name" [ngClass]="'pn-' + p.platform.toLowerCase()">
                    {{ p.platform }}
                  </span>
                  <span class="di-count">{{ p.count | number }}</span>
                  <span class="di-pct">{{ p.pct.toFixed(1) }}%</span>
                </div>
                <div class="di-bar">
                  <div class="di-fill"
                       [style.width.%]="p.pct"
                       [style.background]="p.color">
                  </div>
                </div>
              </div>
              <div class="distrib-total">
                Total : <strong>{{ totalAnomalies | number }}</strong> anomalies
              </div>
            </div>
          </div>

        </div>

        <!-- Heatmap-style calendar -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Calendrier d'activité</span>
          </div>
          <div class="card-body">
            <div class="cal-grid">
              <div class="cal-cell" *ngFor="let day of calendarData"
                   [style.background]="getCellColor(day.total)"
                   [title]="day.date + ' : ' + day.total + ' incident(s)'">
                <span class="cal-day">{{ day.dayNum }}</span>
              </div>
            </div>
            <div class="cal-legend">
              <span>0</span>
              <div class="cal-grad"></div>
              <span>{{ peakDay }}</span>
            </div>
          </div>
        </div>

      </ng-container>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .trends-page { display:flex; flex-direction:column; gap:16px; }

    .page-header  { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
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
    .page-sub     { margin:4px 0 0; font-size:12px; color:var(--text-muted); }
    .header-right { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

    .period-btns { display:flex; gap:3px; }
    .pb {
      padding:5px 12px; border-radius:7px; border:1px solid var(--border-subtle);
      background:transparent; color:var(--text-muted); font-size:12px; font-weight:600;
      cursor:pointer; transition:all 150ms;
      &:hover { border-color:var(--border-default); color:var(--text-primary); }
    }
    .pb-active { background:var(--accent); color:#fff !important; border-color:var(--accent) !important; }

    .nav-pills  { display:flex; gap:4px; }
    .nav-pill   { padding:5px 13px; border-radius:8px; text-decoration:none;
      font-size:12px; font-weight:500; color:var(--text-muted);
      border:1px solid transparent; transition:all 150ms;
      &:hover { background:var(--bg-hover); color:var(--text-primary); }
    }
    .nav-pill.active { background:var(--bg-active); color:var(--accent); border-color:rgba(14,165,233,.3); }

    .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    @media(max-width:768px) { .kpi-row { grid-template-columns:repeat(2,1fr); } }

    .card { background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:12px; overflow:hidden; }
    .card-header { padding:12px 16px 8px; display:flex; align-items:center; justify-content:space-between;
      border-bottom:1px solid var(--border-subtle); }
    .card-title  { font-size:13px; font-weight:600; color:var(--text-primary); }
    .card-body   { padding:14px 16px; }
    .chart-body  { padding:12px; }

    .legend-row  { display:flex; align-items:center; gap:10px; }
    .legend-dot  { width:8px; height:8px; border-radius:50%; }
    .legend-label { font-size:11px; color:var(--text-muted); }

    .chart-wrap { width:100%; height:240px; position:relative; }
    canvas { width:100% !important; height:100% !important; }

    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    @media(max-width:900px) { .two-col { grid-template-columns:1fr; } }

    /* Platform distribution */
    .distrib-body { display:flex; flex-direction:column; gap:10px; }
    .distrib-item { display:flex; flex-direction:column; gap:4px; }
    .di-top  { display:flex; align-items:center; gap:8px; }
    .di-name { font-family:var(--font-mono); font-size:11px; font-weight:700; min-width:48px; }
    .pn-mmg   { color:#d97706; } .pn-smsc  { color:#dc2626; }
    .pn-smpps { color:#2563eb; } .pn-smppc { color:#4f46e5; } .pn-dmc { color:#16a34a; }
    .di-count { font-family:var(--font-mono); font-size:13px; font-weight:700; color:var(--text-primary); }
    .di-pct   { font-size:11px; color:var(--text-muted); margin-left:auto; }
    .di-bar   { height:5px; background:var(--border-subtle); border-radius:3px; overflow:hidden; }
    .di-fill  { height:100%; border-radius:3px; transition:width .6s ease; }
    .distrib-total { font-size:12px; color:var(--text-muted); margin-top:4px;
      strong { color:var(--text-primary); } }

    /* Calendar */
    .cal-grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; margin-bottom:10px; }
    .cal-cell { aspect-ratio:1; border-radius:4px; display:flex; align-items:center;
      justify-content:center; cursor:default; transition:transform 150ms;
      min-width:24px; border:1px solid rgba(255,255,255,.04); }
    .cal-cell:hover { transform:scale(1.1); }
    .cal-day  { font-size:9px; color:rgba(255,255,255,.7); font-weight:600;
      font-family:var(--font-mono); }
    .cal-legend { display:flex; align-items:center; gap:6px; font-size:10px; color:var(--text-faint); }
    .cal-grad { flex:1; height:5px; border-radius:3px;
      background:linear-gradient(90deg, var(--border-subtle), #0ea5e9); }
  `],
})
export class ManagerTrendsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('incChart')  incChartRef!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('platChart') platChartRef!: ElementRef<HTMLCanvasElement>;

  loading  = true;
  data:    ManagerTrends | null = null;
  days     = 30;

  totalIncidents = 0;
  totalCritical  = 0;
  peakDay        = 0;
  peakDayLabel   = '';
  avgPerDay      = 0;
  totalAnomalies = 0;
  platformStats: { platform: string; count: number; pct: number; color: string }[] = [];
  calendarData:  { date: string; dayNum: number; total: number }[] = [];

  private incChart:  any = null;
  private platChart: any = null;
  private chartsBuilt = false;

  private readonly platformColors: Record<string, string> = {
    MMG:'#d97706', SMSC:'#dc2626', SMPPS:'#2563eb', SMPPC:'#4f46e5', DMC:'#16a34a',
  };

  constructor(
    private manager: ManagerService,
    private cdr:     ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.loadData(); }

  ngAfterViewInit(): void {
    if (this.data) this.buildCharts();
  }

  ngOnDestroy(): void {
    this.incChart?.destroy();
    this.platChart?.destroy();
  }

  setDays(d: number): void {
    this.days = d;
    this.loadData();
  }

  private loadData(): void {
    this.loading = true;
    this.manager.getTrends(this.days).subscribe({
      next: d => {
        this.data = d;
        this.computeStats(d);
        this.loading = false;
        this.cdr.markForCheck();
        // Give Angular one tick to render canvases
        setTimeout(() => this.buildCharts(), 80);
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  private computeStats(d: ManagerTrends): void {
    const daily = d.daily_incidents ?? [];

    this.totalIncidents = daily.reduce((s, x) => s + x.total, 0);
    this.totalCritical  = daily.reduce((s, x) => s + x.critical, 0);
    this.avgPerDay      = daily.length ? this.totalIncidents / daily.length : 0;

    const peak = daily.reduce((mx, x) => x.total > mx.total ? x : mx, daily[0] ?? { total: 0, date: '' });
    this.peakDay      = peak?.total ?? 0;
    this.peakDayLabel = peak?.date ? new Date(peak.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }) : '';

    const platData = d.anomalies_by_platform ?? [];
    this.totalAnomalies = platData.reduce((s, x) => s + x.count, 0);
    this.platformStats  = platData.map(p => ({
      platform: p.platform,
      count:    p.count,
      pct:      this.totalAnomalies ? (p.count / this.totalAnomalies) * 100 : 0,
      color:    this.platformColors[p.platform] ?? '#64748b',
    })).sort((a, b) => b.count - a.count);

    // Calendar
    this.calendarData = daily.map(d => ({
      date:   d.date,
      dayNum: new Date(d.date).getDate(),
      total:  d.total,
    }));
  }

  private async buildCharts(): Promise<void> {
    if (!this.data || !this.incChartRef?.nativeElement) return;

    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);

    const isDark    = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)';
    const textColor = isDark ? '#64748b' : '#94a3b8';

    const daily  = this.data.daily_incidents ?? [];
    const labels = daily.map(d => new Date(d.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }));

    // Destroy old
    this.incChart?.destroy();
    this.platChart?.destroy();

    // ── Incident timeline chart ─────────────────────
    this.incChart = new Chart(this.incChartRef.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label:           'Total',
            data:            daily.map(d => d.total),
            borderColor:     '#0ea5e9',
            backgroundColor: 'rgba(14,165,233,.1)',
            borderWidth:     2,
            tension:         0.4,
            pointRadius:     3,
            pointHoverRadius: 5,
            fill:            true,
          },
          {
            label:           'CRITICAL',
            data:            daily.map(d => d.critical),
            borderColor:     '#ef4444',
            backgroundColor: 'transparent',
            borderWidth:     1.5,
            tension:         0.3,
            pointRadius:     2,
            borderDash:      [4, 3],
            fill:            false,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0].label,
              label:  (item) => ` ${item.dataset.label}: ${item.parsed.y}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { size: 10, family: 'DM Mono' }, maxTicksLimit: 10 },
            grid:  { color: gridColor },
          },
          y: {
            beginAtZero: true,
            ticks: { color: textColor, font: { size: 10 }, stepSize: 1 },
            grid:  { color: gridColor },
          },
        },
        interaction: { mode: 'index', intersect: false },
      },
    });

    // ── Platform bar chart ──────────────────────────
    if (!this.platChartRef?.nativeElement) return;
    const platData = this.data.anomalies_by_platform ?? [];

    this.platChart = new Chart(this.platChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels:   platData.map(p => p.platform),
        datasets: [{
          label:           'Anomalies',
          data:            platData.map(p => p.count),
          backgroundColor: platData.map(p => (this.platformColors[p.platform] ?? '#64748b') + 'cc'),
          borderColor:     platData.map(p => this.platformColors[p.platform] ?? '#64748b'),
          borderWidth:     1.5,
          borderRadius:    5,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor, font: { size: 11, family: 'DM Mono', weight: 'bold' } },
               grid: { display: false } },
          y: { beginAtZero: true,
               ticks: { color: textColor, font: { size: 10 } },
               grid:  { color: gridColor } },
        },
      },
    });
  }

  getCellColor(total: number): string {
    if (!total) return 'var(--border-subtle)';
    const intensity = Math.min(1, total / Math.max(this.peakDay, 1));
    const r = Math.round(14  + (239-14)  * intensity);
    const g = Math.round(165 + (68-165)  * intensity);
    const b = Math.round(233 + (68-233)  * intensity);
    return `rgba(${r},${g},${b},${0.15 + intensity * 0.7})`;
  }
}