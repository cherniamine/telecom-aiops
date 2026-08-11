// ═══════════════════════════════════════════════════════════════════════════════
// raw-logs.component.ts
// Route : /engineer/logs
// Logs bruts filtrables par plateforme et niveau de log
// ═══════════════════════════════════════════════════════════════════════════════
import { Component, OnInit }          from '@angular/core';
import { CommonModule }               from '@angular/common';
import { FormsModule }                from '@angular/forms';
import { EngineerService, RawLog }    from '../../../services/engineer.service';
import { PlatformTagComponent }       from '../../../shared/components/platform-tag/platform-tag.component';
import { LoadingSpinnerComponent }    from '../../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent }        from '../../../shared/components/empty-state/empty-state.component';
import { SearchBarComponent }         from '../../../shared/components/search-bar/search-bar.component';

@Component({
  selector:   'app-raw-logs',
  standalone: true,
  imports: [
    CommonModule, FormsModule ,
    PlatformTagComponent, LoadingSpinnerComponent,
    EmptyStateComponent, SearchBarComponent,
  ],
  template: `
    <div class="raw-logs-page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Logs bruts</h1>
          <p class="page-sub">
            {{ filtered.length | number }} lignes affichées
            <span *ngIf="total > filtered.length"> sur {{ total | number }}</span>
          </p>
        </div>
        <div class="header-actions">
          <button class="btn-refresh" (click)="loadLogs()" [disabled]="loading">
            <svg [class.spin]="loading" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M12 7A5 5 0 112 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              <path d="M2 1.5v3h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Actualiser
          </button>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        <app-search-bar
          placeholder="Filtrer les messages..."
          (valueChange)="onSearch($event)"
          style="flex:1; max-width:380px"/>

        <div class="filter-group">
          <label class="fg-label">Plateforme</label>
          <div class="filter-pills">
            <button class="pill" [class.active]="platformFilter === ''"
                    (click)="setFilter('platform', '')">Toutes</button>
            <button class="pill" *ngFor="let p of platforms"
                    [class.active]="platformFilter === p"
                    (click)="setFilter('platform', p)"
                    [ngClass]="'pill-' + p.toLowerCase()">{{ p }}</button>
          </div>
        </div>

        <div class="filter-group">
          <label class="fg-label">Niveau</label>
          <div class="filter-pills">
            <button class="pill" [class.active]="levelFilter === ''"
                    (click)="setFilter('level', '')">Tous</button>
            <button class="pill" *ngFor="let l of levels"
                    [class.active]="levelFilter === l"
                    (click)="setFilter('level', l)"
                    [ngClass]="'level-pill-' + l.toLowerCase()">{{ l }}</button>
          </div>
        </div>

        <div class="limit-select">
          <label class="fg-label">Limite</label>
          <select class="slim-select" [(ngModel)]="limitVal" (change)="loadLogs()">
            <option [value]="50">50</option>
            <option [value]="100">100</option>
            <option [value]="200">200</option>
            <option [value]="500">500</option>
          </select>
        </div>
      </div>

      <!-- Stats mini row -->
      <div class="stats-row" *ngIf="!loading && levelStats.length">
        <div class="stat-chip" *ngFor="let s of levelStats"
             [ngClass]="'sc-' + s.level.toLowerCase()">
          <span class="sc-val">{{ s.count | number }}</span>
          <span class="sc-lbl">{{ s.level }}</span>
        </div>
      </div>

      <app-loading-spinner *ngIf="loading" label="Chargement des logs..." minHeight="240px"/>

      <app-empty-state *ngIf="!loading && filtered.length === 0"
        title="Aucun log"
        description="Modifiez les filtres pour voir des logs."/>

      <!-- Log table -->
      <div class="log-table" *ngIf="!loading && filtered.length > 0">
        <div class="lt-header">
          <span class="lth-time">Timestamp</span>
          <span class="lth-platform">Plateforme</span>
          <span class="lth-level">Niveau</span>
          <span class="lth-msg">Message</span>
        </div>

        <div class="lt-body" #tableBody>
          <div class="lt-row" *ngFor="let log of paged; let i = index; trackBy: trackByIdx"
               [ngClass]="'lr-' + log.level.toLowerCase()">
            <span class="lr-time">{{ log.timestamp | date:'dd/MM HH:mm:ss' }}</span>
            <app-platform-tag [platform]="log.platform" size="sm"/>
            <span class="lr-level" [ngClass]="'llev-' + log.level.toLowerCase()">
              {{ log.level }}
            </span>
            <p class="lr-msg" [title]="log.message">
              {{ log.message | slice:0:180 }}{{ log.message.length > 180 ? '…' : '' }}
            </p>
          </div>
        </div>

        <!-- Pagination -->
        <div class="lt-pagination">
          <button class="pg-btn" (click)="prevPage()" [disabled]="currentPage === 1">‹</button>
          <span class="pg-info">Page {{ currentPage }} / {{ totalPages }}</span>
          <button class="pg-btn" (click)="nextPage()" [disabled]="currentPage === totalPages">›</button>
          <span class="pg-count">{{ filtered.length | number }} lignes</span>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host { display:block; }
    .raw-logs-page { display:flex; flex-direction:column; gap:14px; }

    .page-header  { display:flex; justify-content:space-between; align-items:flex-start; }
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
    .header-actions { display:flex; gap:8px; }
    .btn-refresh {
      display:flex; align-items:center; gap:6px; padding:7px 12px; border-radius:8px;
      border:1px solid var(--border-subtle); background:transparent;
      color:var(--text-secondary); font-size:12px; font-weight:500; cursor:pointer;
      transition:all 150ms;
      &:hover { background:var(--bg-hover); color:var(--text-primary); }
      &:disabled { opacity:.5; cursor:wait; }
    }
    .spin { animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .filter-bar { display:flex; align-items:flex-end; gap:14px; flex-wrap:wrap;
      padding:12px 14px; background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:10px; }
    .filter-group { display:flex; flex-direction:column; gap:4px; }
    .fg-label { font-size:9px; font-weight:700; letter-spacing:.1em;
      text-transform:uppercase; color:var(--text-faint); }
    .filter-pills { display:flex; gap:4px; flex-wrap:wrap; }
    .pill {
      padding:4px 10px; border-radius:20px; border:1px solid var(--border-subtle);
      background:transparent; color:var(--text-muted); font-size:11px;
      font-weight:500; cursor:pointer; transition:all 150ms;
      &:hover { border-color:var(--border-default); color:var(--text-primary); }
    }
    .pill.active { background:var(--bg-active); color:var(--accent); border-color:rgba(14,165,233,.3); }

    /* Platform pill colors */
    .pill-mmg.active   { background:rgba(245,158,11,.1); color:#d97706; border-color:rgba(245,158,11,.3); }
    .pill-smsc.active  { background:rgba(239,68,68,.1);  color:#dc2626; border-color:rgba(239,68,68,.3); }
    .pill-smpps.active { background:rgba(59,130,246,.1); color:#2563eb; border-color:rgba(59,130,246,.3); }
    .pill-smppc.active { background:rgba(99,102,241,.1); color:#4f46e5; border-color:rgba(99,102,241,.3); }
    .pill-dmc.active   { background:rgba(34,197,94,.1);  color:#16a34a; border-color:rgba(34,197,94,.3); }

    /* Level pill colors */
    .level-pill-error.active  { background:rgba(239,68,68,.1);  color:#dc2626; border-color:rgba(239,68,68,.3); }
    .level-pill-warn.active   { background:rgba(245,158,11,.1); color:#d97706; border-color:rgba(245,158,11,.3); }
    .level-pill-alert.active  { background:rgba(99,102,241,.1); color:#4f46e5; border-color:rgba(99,102,241,.3); }

    .limit-select { display:flex; flex-direction:column; gap:4px; }
    .slim-select { padding:5px 8px; border-radius:7px;
      border:1px solid var(--border-subtle); background:var(--bg-input);
      color:var(--text-primary); font-size:12px; outline:none; cursor:pointer;
      &:focus { border-color:var(--accent); }
    }

    .stats-row { display:flex; gap:8px; flex-wrap:wrap; }
    .stat-chip { display:flex; flex-direction:column; align-items:center; gap:2px;
      padding:6px 14px; border-radius:8px; border:1px solid transparent; }
    .sc-val { font-family:var(--font-mono); font-size:14px; font-weight:700; color:var(--text-primary); }
    .sc-lbl { font-size:9px; color:var(--text-muted); letter-spacing:.06em; }
    .sc-info   { background:rgba(148,163,184,.08); border-color:rgba(148,163,184,.15); }
    .sc-error  { background:rgba(239,68,68,.08);   border-color:rgba(239,68,68,.15); .sc-val { color:#ef4444; } }
    .sc-warn   { background:rgba(245,158,11,.08);  border-color:rgba(245,158,11,.15); .sc-val { color:#f59e0b; } }
    .sc-alert  { background:rgba(99,102,241,.08);  border-color:rgba(99,102,241,.15); .sc-val { color:#6366f1; } }
    .sc-debug  { background:rgba(34,197,94,.06);   border-color:rgba(34,197,94,.12);  .sc-val { color:#22c55e; } }

    /* Log table */
    .log-table { background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:12px; overflow:hidden; }
    .lt-header { display:grid; grid-template-columns:140px 80px 70px 1fr;
      gap:12px; padding:8px 14px;
      font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
      color:var(--text-muted); background:var(--bg-hover);
      border-bottom:1px solid var(--border-subtle); }
    .lt-body { max-height:520px; overflow-y:auto;
      scrollbar-width:thin; scrollbar-color:var(--border-subtle) transparent; }
    .lt-row {
      display:grid; grid-template-columns:140px 80px 70px 1fr;
      gap:12px; padding:7px 14px; align-items:center;
      border-bottom:1px solid var(--border-subtle);
      transition:background 100ms;
      &:hover { background:var(--bg-hover); }
      &:last-child { border:none; }
    }
    .lr-error { border-left:2px solid rgba(239,68,68,.4); }
    .lr-warn  { border-left:2px solid rgba(245,158,11,.3); }
    .lr-alert { border-left:2px solid rgba(99,102,241,.3); }
    .lr-time  { font-family:var(--font-mono); font-size:10px; color:var(--text-faint);
      white-space:nowrap; }
    .lr-level { font-family:var(--font-mono); font-size:10px; font-weight:700;
      padding:1px 5px; border-radius:3px; text-align:center; }
    .llev-error { background:rgba(239,68,68,.1);  color:#dc2626; }
    .llev-warn  { background:rgba(245,158,11,.1); color:#d97706; }
    .llev-info  { background:rgba(148,163,184,.1);color:#64748b; }
    .llev-alert { background:rgba(99,102,241,.1); color:#4f46e5; }
    .llev-debug { background:rgba(34,197,94,.08); color:#16a34a; }
    .lr-msg { margin:0; font-size:11px; color:var(--text-secondary); line-height:1.4;
      font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    .lt-pagination { display:flex; align-items:center; gap:8px; padding:10px 14px;
      border-top:1px solid var(--border-subtle); }
    .pg-btn { width:28px; height:28px; border-radius:6px; border:1px solid var(--border-subtle);
      background:transparent; color:var(--text-secondary); cursor:pointer; font-size:14px;
      display:flex; align-items:center; justify-content:center; transition:all 150ms;
      &:hover { background:var(--bg-hover); }
      &:disabled { opacity:.4; cursor:default; }
    }
    .pg-info  { font-size:12px; color:var(--text-muted); }
    .pg-count { margin-left:auto; font-size:11px; color:var(--text-faint);
      font-family:var(--font-mono); }
  `],
})
export class RawLogsComponent implements OnInit {
  loading        = true;
  logs:          RawLog[] = [];
  filtered:      RawLog[] = [];
  paged:         RawLog[] = [];
  searchTerm     = '';
  platformFilter = '';
  levelFilter    = '';
  limitVal       = 100;
  total          = 0;
  currentPage    = 1;
  readonly pageSize   = 50;
  totalPages     = 1;
  levelStats:    { level: string; count: number }[] = [];

  readonly platforms = ['MMG','SMSC','SMPPS','SMPPC','DMC'];
  readonly levels    = ['INFO','WARN','ERROR','ALERT','DEBUG'];

  constructor(private engineer: EngineerService) {}

  ngOnInit(): void { this.loadLogs(); }

  loadLogs(): void {
    this.loading = true;
    this.engineer.getRawLogs(
      this.platformFilter || undefined,
      this.levelFilter    || undefined,
      this.limitVal,
    ).subscribe({
      next: r => {
        this.logs  = r.logs;
        this.total = r.count;
        this.buildStats();
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  onSearch(q: string): void { this.searchTerm = q; this.applyFilter(); }

  setFilter(type: 'platform' | 'level', val: string): void {
    if (type === 'platform') this.platformFilter = val;
    else                     this.levelFilter    = val;
    this.loadLogs();
  }

  applyFilter(): void {
    let d = [...this.logs];
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      d = d.filter(l => l.message?.toLowerCase().includes(q));
    }
    this.filtered   = d;
    this.totalPages = Math.max(1, Math.ceil(d.length / this.pageSize));
    this.currentPage = 1;
    this.updatePage();
  }

  updatePage(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paged  = this.filtered.slice(start, start + this.pageSize);
  }

  prevPage(): void { if (this.currentPage > 1) { this.currentPage--; this.updatePage(); } }
  nextPage(): void { if (this.currentPage < this.totalPages) { this.currentPage++; this.updatePage(); } }

  private buildStats(): void {
    const map = new Map<string, number>();
    this.logs.forEach(l => {
      const lv = l.level ?? 'INFO';
      map.set(lv, (map.get(lv) ?? 0) + 1);
    });
    this.levelStats = Array.from(map.entries())
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => b.count - a.count);
  }

  trackByIdx = (i: number) => i;
}