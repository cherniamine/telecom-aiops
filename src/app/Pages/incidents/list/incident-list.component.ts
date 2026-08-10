// ═══════════════════════════════════════════════════════════════════════════════
// incidents/list/incident-list.component.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { LoadingSpinnerComponent } from "@app/shared/components/loading-spinner/loading-spinner.component";
import { EmptyStateComponent } from "@app/shared/components/empty-state/empty-state.component";
import { PlatformTagComponent } from "@app/shared/components/platform-tag/platform-tag.component";
import { SearchBarComponent } from "@app/shared/components/search-bar/search-bar.component";
import { SeverityBadgeComponent } from "@app/shared/components/severity-badge/severity-badge.component";
import { TimeAgoPipe } from "@app/shared/pipes/time-ago.pipe";
import { IncidentService } from "@app/services/Incident.service";
import { FormsModule } from "@angular/forms";

 
@Component({
  selector:   'app-incident-list',  
  standalone: true,
  imports: [CommonModule, RouterLink, SeverityBadgeComponent, PlatformTagComponent,FormsModule ,
    LoadingSpinnerComponent, EmptyStateComponent, SearchBarComponent, TimeAgoPipe],
  template: `
    <div class="inc-list-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Incidents</h1>
          <p class="page-sub">{{ filtered.length }} incident{{ filtered.length > 1 ? 's' : '' }}</p>
        </div>
      </div>
 
      <div class="filters-row">
        <app-search-bar placeholder="Rechercher..."
          (valueChange)="onSearch($event)" style="flex:1;max-width:320px"/>
        <div class="filter-pills">
          <button class="pill" [class.active]="statusFilter === ''"
                  (click)="statusFilter='';applyFilter()">Tous</button>
          <button class="pill pill-open" [class.active]="statusFilter === 'open'"
                  (click)="statusFilter='open';applyFilter()">Ouverts</button>
          <button class="pill" [class.active]="statusFilter === 'resolved'"
                  (click)="statusFilter='resolved';applyFilter()">Résolus</button>
        </div>
      </div>
 
      <app-loading-spinner *ngIf="loading" minHeight="200px"/>
      <app-empty-state *ngIf="!loading && filtered.length === 0"
        title="Aucun incident" description="Aucun incident ne correspond aux filtres actifs."/>
 
      <div class="inc-table" *ngIf="!loading && filtered.length > 0">
        <div class="inc-row" *ngFor="let i of filtered; trackBy: trackById"
             [routerLink]="['/incidents', i._id]" style="cursor:pointer">
          <div class="ir-severity">
            <app-severity-badge [severity]="i.severity?.label ?? ''" size="sm"/>
          </div>
          <div class="ir-id">
            <span class="id-val">#{{ i._id.slice(-6).toUpperCase() }}</span>
            <span class="id-time">{{ i.created_at | timeAgo }}</span>
          </div>
          <div class="ir-platforms">
            <app-platform-tag *ngFor="let p of (i.platforms ?? [])" [platform]="p" size="sm"/>
          </div>
          <div class="ir-anomalies">
            <span class="anom-val">{{ i.total_anomalies | number }}</span>
            <span class="anom-lbl">anomalies</span>
          </div>
          <div class="ir-status">
            <span class="status-badge" [ngClass]="i.status === 'open' ? 'sb-open' : 'sb-resolved'">
              {{ i.status }}
            </span>
            <span class="resolution-note" *ngIf="i.status === 'resolved' && i.resolution_note">
              {{ i.resolution_note }}
            </span>
          </div>
          <div class="ir-actions">
            <button class="resolve-btn"
                    *ngIf="i.status !== 'resolved'"
                    [disabled]="resolvingIds.has(i._id)"
                    (click)="openResolveModal(i, $event)">
              {{ resolvingIds.has(i._id) ? 'Resolution...' : 'Marquer resolu' }}
            </button>
          </div>
          <div class="ir-arrow">→</div>
        </div>
      </div>

      <div class="modal-backdrop" *ngIf="selectedIncident" (click)="closeResolveModal()">
        <div class="modal-container" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">
              <span class="modal-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M14.5 5L7.5 12L3.5 8" stroke="#22c55e" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="9" cy="9" r="7" stroke="#22c55e" stroke-width="1.2"/>
                </svg>
              </span>
              <h3>Marquer l'incident comme resolu</h3>
            </div>
            <button class="modal-close" (click)="closeResolveModal()" title="Fermer">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="incident-preview">
              <div class="preview-label">Incident concerne :</div>
              <div class="preview-message">
                Incident #{{ selectedIncident._id.slice(-8).toUpperCase() }}
              </div>
              <div class="preview-meta">
                <span class="preview-platform" *ngFor="let p of (selectedIncident.platforms ?? [])">{{ p }}</span>
                <span class="preview-score">{{ selectedIncident.total_anomalies | number }} anomalies</span>
              </div>
            </div>

            <div class="input-group">
              <label class="input-label">
                <span class="label-icon">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1.5V12.5M2.5 4H11.5M3.5 7H10.5M4.5 10H8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                </span>
                Note de resolution
              </label>
              <textarea
                [(ngModel)]="resolutionNote"
                class="resolution-input"
                placeholder="Ex: Redemarrage du service SMPP, augmentation de la capacite SMSC, verification des connexions..."
                rows="4"
                autofocus
              ></textarea>
              <div class="input-hint">Indiquez brievement comment l'incident a ete resolu.</div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeResolveModal()">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M8 7L13 12M6 7L1 12M8 7L13 2M6 7L1 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
              Annuler
            </button>
            <button class="btn-confirm"
                    (click)="confirmResolveIncident()"
                    [disabled]="!resolutionNote.trim() || resolvingIds.has(selectedIncident._id)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11.5 3.5L5 10L2.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ resolvingIds.has(selectedIncident._id) ? 'Enregistrement...' : 'Confirmer la resolution' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .inc-list-page { display:flex; flex-direction:column; gap:16px; }
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
    .filters-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .filter-pills { display:flex; gap:6px; }
    .pill { padding:5px 12px; border-radius:20px; border:1px solid var(--border-subtle);
      background:transparent; color:var(--text-muted); font-size:12px; font-weight:500;
      cursor:pointer; transition:all 150ms; }
    .pill.active { background:var(--bg-active); color:var(--accent); border-color:rgba(14,165,233,.3); }
    .pill-open.active { background:rgba(239,68,68,.08); color:#ef4444; border-color:rgba(239,68,68,.3); }
    .inc-table { display:flex; flex-direction:column; gap:4px; }
    .inc-row {
      display:flex; align-items:center; gap:14px;
      padding:12px 16px; border-radius:10px;
      border:1px solid var(--border-subtle); background:var(--bg-card);
      transition:all 150ms;
    }
    .inc-row:hover { box-shadow:0 2px 12px rgba(0,0,0,.07); border-color:var(--border-default); }
    .ir-severity { flex-shrink:0; }
    .ir-id { display:flex; flex-direction:column; flex-shrink:0; min-width:80px; }
    .id-val  { font-family:var(--font-mono); font-size:12px; font-weight:600; color:var(--text-primary); }
    .id-time { font-size:10px; color:var(--text-faint); }
    .ir-platforms { display:flex; gap:4px; flex-wrap:wrap; flex:1; }
    .ir-anomalies { display:flex; flex-direction:column; align-items:center; flex-shrink:0; min-width:64px; }
    .anom-val { font-family:var(--font-mono); font-size:14px; font-weight:700; color:var(--text-primary); }
    .anom-lbl { font-size:9px; color:var(--text-faint); letter-spacing:.05em; }
    .ir-status { display:flex; flex-direction:column; gap:3px; align-items:flex-start; flex-shrink:0; min-width:96px; }
    .status-badge { padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; }
    .sb-open     { background:rgba(239,68,68,.1); color:#dc2626; }
    .sb-resolved { background:rgba(34,197,94,.1); color:#16a34a; }
    .resolution-note {
      max-width:160px;
      color:var(--text-faint);
      font-size:10px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .ir-actions { flex-shrink:0; min-width:124px; display:flex; justify-content:flex-end; }
    .resolve-btn {
      border:1px solid rgba(34,197,94,.35);
      background:rgba(34,197,94,.08);
      color:#16a34a;
      border-radius:8px;
      cursor:pointer;
      font-size:11px;
      font-weight:700;
      padding:7px 10px;
      transition:all 150ms;
    }
    .resolve-btn:hover:not(:disabled) { background:rgba(34,197,94,.14); border-color:rgba(34,197,94,.55); }
    .resolve-btn:disabled { cursor:wait; opacity:.6; }
    .ir-arrow { color:var(--text-faint); font-size:14px; flex-shrink:0; }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1100;
      animation: fadeIn 150ms ease-out;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal-container {
      background: var(--bg-card, #1e293b);
      border-radius: 20px;
      width: 90%;
      max-width: 520px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border: 1px solid var(--border-subtle, rgba(148, 163, 184, 0.2));
      animation: slideUp 200ms ease-out;
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .modal-header {
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:18px 20px;
      border-bottom:1px solid var(--border-subtle, rgba(148, 163, 184, 0.15));
    }
    .modal-title { display:flex; align-items:center; gap:10px; }
    .modal-icon, .label-icon {
      display:inline-flex;
      align-items:center;
      justify-content:center;
    }
    .modal-title h3 {
      margin:0;
      font-size:16px;
      font-weight:600;
      color:var(--text-primary, #f1f5f9);
    }
    .modal-close {
      background:transparent;
      border:none;
      cursor:pointer;
      color:var(--text-muted, #94a3b8);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:6px;
      border-radius:8px;
      transition:all 150ms;
    }
    .modal-close:hover { background:rgba(239,68,68,.1); color:#ef4444; }
    .modal-body { padding:20px; }
    .incident-preview {
      background:rgba(34,197,94,.06);
      border-radius:12px;
      padding:14px;
      margin-bottom:20px;
      border-left:3px solid #22c55e;
    }
    .preview-label {
      font-size:10px;
      font-weight:600;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:var(--text-muted, #94a3b8);
      margin-bottom:8px;
    }
    .preview-message {
      font-size:13px;
      line-height:1.5;
      color:var(--text-primary, #f1f5f9);
      margin-bottom:10px;
      word-break:break-word;
    }
    .preview-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .preview-platform {
      font-size:10px;
      padding:2px 8px;
      border-radius:4px;
      background:rgba(59,130,246,.15);
      color:#60a5fa;
      font-family:var(--font-mono);
    }
    .preview-score {
      font-size:10px;
      color:#f59e0b;
      font-family:var(--font-mono);
    }
    .input-group { display:flex; flex-direction:column; gap:8px; }
    .input-label {
      display:flex;
      align-items:center;
      gap:6px;
      font-size:12px;
      font-weight:600;
      color:var(--text-primary, #f1f5f9);
    }
    .resolution-input {
      width:100%;
      padding:12px;
      border-radius:10px;
      border:1px solid var(--border-subtle, rgba(148, 163, 184, 0.2));
      background:var(--bg-page, #0f172a);
      color:var(--text-primary, #f1f5f9);
      font-size:13px;
      line-height:1.5;
      resize:vertical;
      font-family:inherit;
      transition:all 150ms;
    }
    .resolution-input:focus {
      outline:none;
      border-color:#22c55e;
      box-shadow:0 0 0 3px rgba(34,197,94,.1);
    }
    .resolution-input::placeholder { color:var(--text-faint, #64748b); }
    .input-hint { font-size:11px; color:var(--text-faint, #64748b); }
    .modal-footer {
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:12px;
      padding:16px 20px;
      border-top:1px solid var(--border-subtle, rgba(148, 163, 184, 0.15));
    }
    .btn-cancel, .btn-confirm {
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:8px 16px;
      border-radius:8px;
      font-size:12px;
      font-weight:600;
      cursor:pointer;
      transition:all 150ms;
      border:none;
    }
    .btn-cancel {
      background:transparent;
      color:var(--text-muted, #94a3b8);
      border:1px solid var(--border-subtle, rgba(148, 163, 184, 0.3));
    }
    .btn-cancel:hover {
      background:rgba(239,68,68,.1);
      color:#ef4444;
      border-color:rgba(239,68,68,.3);
    }
    .btn-confirm {
      background:linear-gradient(135deg, #22c55e, #16a34a);
      color:white;
    }
    .btn-confirm:hover:not(:disabled) {
      transform:translateY(-1px);
      box-shadow:0 4px 12px rgba(34,197,94,.3);
    }
    .btn-confirm:disabled { opacity:.5; cursor:not-allowed; }
  `],
})
export class IncidentListComponent implements OnInit {
  loading = true;
  incidents: any[] = [];
  filtered:  any[] = [];
  searchTerm    = '';
  statusFilter  = '';
  resolvingIds = new Set<string>();
  selectedIncident: any = null;
  resolutionNote = '';
 
  constructor(private incidentService: IncidentService) {}
 
  ngOnInit(): void {
    this.incidentService.getIncidents().subscribe({
      next:  d => { this.incidents = Array.isArray(d) ? d : []; this.applyFilter(); this.loading = false; },
      error: () => this.loading = false,
    });
  }
 
  onSearch(q: string): void { this.searchTerm = q; this.applyFilter(); }

  openResolveModal(incident: any, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!incident?._id || this.resolvingIds.has(incident._id)) return;

    this.selectedIncident = incident;
    this.resolutionNote = incident.resolution_note || 'Action corrective appliquee et service stabilise';
  }

  closeResolveModal(): void {
    if (this.selectedIncident && this.resolvingIds.has(this.selectedIncident._id)) return;
    this.selectedIncident = null;
    this.resolutionNote = '';
  }

  confirmResolveIncident(): void {
    const incident = this.selectedIncident;
    const note = this.resolutionNote.trim();

    if (!incident?._id || !note || this.resolvingIds.has(incident._id)) return;

    this.resolvingIds.add(incident._id);
    this.incidentService.resolveIncident(incident._id, {
      resolved_by: 'dashboard_user',
      resolution_note: note,
      resolution_method: 'manual',
    }).subscribe({
      next: updated => {
        this.incidents = this.incidents.map(item =>
          item._id === incident._id ? { ...item, ...updated } : item,
        );
        this.resolvingIds.delete(incident._id);
        this.selectedIncident = null;
        this.resolutionNote = '';
        this.applyFilter();
      },
      error: error => {
        this.resolvingIds.delete(incident._id);
        window.alert(error?.message ?? "Impossible de marquer l'incident comme resolu.");
      },
    });
  }
 
  applyFilter(): void {
    this.filtered = this.incidents.filter(i => {
      const matchStatus = !this.statusFilter || i.status === this.statusFilter;
      const matchText   = !this.searchTerm
        || i._id?.toLowerCase().includes(this.searchTerm.toLowerCase())
        || (i.platforms ?? []).some((p: string) => p.toLowerCase().includes(this.searchTerm.toLowerCase()));
      return matchStatus && matchText;
    });
  }
 
  trackById = (_: number, i: any) => i._id;
}
 
