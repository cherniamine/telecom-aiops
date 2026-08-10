// ═══════════════════════════════════════════════════════════════════════════════
// WHAT-IF SIMULATOR COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
 
import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy,
         ChangeDetectorRef } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { FormsModule }       from '@angular/forms';
import { WhatIfService, WhatIfAction, SimulationResult, CompareResponse }
  from '../../services/whatif.service';
 
// ── what-if-panel.component.ts ────────────────────────────────────────────────
@Component({
  selector:   'app-what-if-panel',
  standalone: true,
  imports:    [CommonModule, FormsModule ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wif-panel">
      <div class="wif-header">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v4M8 10v4M2 8h4M10 8h4" stroke="var(--accent)" stroke-width="1.4" stroke-linecap="round"/>
          <circle cx="8" cy="8" r="2.5" stroke="var(--accent)" stroke-width="1.4"/>
        </svg>
        <span class="wif-title">Simulateur What-If</span>
      </div>
 
      <div class="wif-body">
        <!-- Action selector -->
        <div class="wif-field">
          <label class="wif-label">Action corrective</label>
          <select class="wif-select" [(ngModel)]="selectedActionId" (change)="onActionChange()">
            <option value="">— Choisir une action —</option>
            <optgroup *ngFor="let group of actionGroups" [label]="group.label">
              <option *ngFor="let a of group.actions" [value]="a.id">{{ a.label }}</option>
            </optgroup>
          </select>
        </div>
 
        <!-- Action description -->
        <div class="wif-desc" *ngIf="selectedAction">
          <p>{{ selectedAction.description }}</p>
          <div class="wif-targets">
            <span>Cibles :</span>
            <span class="wif-target" *ngFor="let t of selectedAction.targets">{{ t }}</span>
          </div>
        </div>
 
        <!-- Parameters -->
        <div class="wif-params" *ngIf="selectedAction && paramKeys.length">
          <label class="wif-label">Paramètres</label>
          <div class="param-row" *ngFor="let key of paramKeys">
            <label class="param-label">{{ formatParamLabel(key) }}</label>
            <div class="param-input-wrap">
              <input class="param-input" type="number"
                     [min]="selectedAction.parameters[key].min ?? 0"
                     [max]="selectedAction.parameters[key].max ?? 999"
                     [(ngModel)]="parameters[key]"/>
              <span class="param-unit" *ngIf="getParamUnit(key)">{{ getParamUnit(key) }}</span>
            </div>
          </div>
        </div>
 
        <!-- Actions -->
        <div class="wif-actions">
          <button class="btn-simulate" (click)="simulate()"
                  [disabled]="!selectedActionId || simulating || !incidentId">
            <svg *ngIf="!simulating" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 2l9 5-9 5V2z" fill="currentColor"/>
            </svg>
            <svg *ngIf="simulating" class="spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,.3)" stroke-width="2"/>
              <path d="M7 1.5a5.5 5.5 0 015.5 5.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
            {{ simulating ? 'Simulation...' : 'Simuler' }}
          </button>
          <button class="btn-compare" (click)="compare()"
                  [disabled]="comparing || !incidentId">
            <svg *ngIf="!comparing" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 11l3-4 3 3 4-6" stroke="currentColor" stroke-width="1.3"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ comparing ? 'Comparaison...' : '⚖️ Comparer tout' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .wif-panel { background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:12px; overflow:hidden; }
    .wif-header { display:flex; align-items:center; gap:8px; padding:12px 16px 10px;
      border-bottom:1px solid var(--border-subtle); }
    .wif-title { font-size:13px; font-weight:600; color:var(--text-primary); }
    .wif-body  { padding:14px 16px; display:flex; flex-direction:column; gap:12px; }
    .wif-label { font-size:11px; font-weight:600; letter-spacing:.06em;
      text-transform:uppercase; color:var(--text-muted); display:block; margin-bottom:5px; }
    .wif-select {
      width:100%; padding:8px 10px; border-radius:8px;
      border:1px solid var(--border-subtle); background:var(--bg-input);
      color:var(--text-primary); font-size:13px; outline:none; cursor:pointer;
    }
    .wif-select:focus { border-color:var(--accent); }
    .wif-desc { padding:8px 12px; border-radius:8px;
      background:rgba(14,165,233,.06); border:1px solid rgba(14,165,233,.15);
      p { margin:0 0 6px; font-size:12px; color:var(--text-muted); }
    }
    .wif-targets { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-muted); }
    .wif-target { padding:1px 7px; border-radius:4px; background:rgba(14,165,233,.1);
      color:var(--accent); font-family:var(--font-mono); font-weight:600; font-size:10px; }
    .wif-params { display:flex; flex-direction:column; gap:8px; }
    .param-row  { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .param-label { font-size:12px; color:var(--text-secondary); flex:1; }
    .param-input-wrap { display:flex; align-items:center; gap:6px; }
    .param-input {
      width:80px; padding:5px 8px; border-radius:6px;
      border:1px solid var(--border-subtle); background:var(--bg-input);
      color:var(--text-primary); font-size:13px; font-family:var(--font-mono);
      text-align:right; outline:none;
    }
    .param-input:focus { border-color:var(--accent); }
    .param-unit { font-size:11px; color:var(--text-muted); }
    .wif-actions { display:flex; gap:8px; }
    .btn-simulate, .btn-compare {
      flex:1; padding:9px 14px; border-radius:8px; border:none;
      font-size:13px; font-weight:600; cursor:pointer; transition:all 150ms;
      display:flex; align-items:center; justify-content:center; gap:6px;
    }
    .btn-simulate { background:var(--accent,#0ea5e9); color:#fff; }
    .btn-simulate:hover { opacity:.88; }
    .btn-simulate:disabled { opacity:.55; cursor:not-allowed; }
    .btn-compare { background:var(--bg-hover); color:var(--text-secondary);
      border:1px solid var(--border-subtle); }
    .btn-compare:hover { border-color:var(--border-default); color:var(--text-primary); }
    .btn-compare:disabled { opacity:.55; cursor:not-allowed; }
    .spin { animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `],
})
export class WhatIfPanelComponent implements OnInit {
  @Input()  incidentId = '';
  @Output() simulated  = new EventEmitter<SimulationResult>();
  @Output() compared   = new EventEmitter<CompareResponse>();
 
  actions:         WhatIfAction[] = [];
  selectedActionId = '';
  selectedAction:  WhatIfAction | null = null;
  parameters:      Record<string, any> = {};
  paramKeys:       string[] = [];
  simulating       = false;
  comparing        = false;
 
  readonly actionGroups = [
    { label: 'SMSC / Queue', filter: ['increase_smsc_queue', 'combined_recovery'] },
    { label: 'SMPP Sessions', filter: ['restart_smpp_sessions', 'increase_timeout', 'reduce_retry_interval'] },
    { label: 'MMG / DMC',    filter: ['enable_load_balancing', 'scale_dmc_workers', 'isolate_platform'] },
  ].map(g => ({ label: g.label, actions: [] as WhatIfAction[] }));
 
  constructor(private whatif: WhatIfService, private cdr: ChangeDetectorRef) {}
 
  ngOnInit(): void {
    this.whatif.getActions().subscribe(res => {
      this.actions = res.actions;
      this.actionGroups[0].actions = this.actions.filter(a => ['increase_smsc_queue','combined_recovery'].includes(a.id));
      this.actionGroups[1].actions = this.actions.filter(a => ['restart_smpp_sessions','increase_timeout','reduce_retry_interval'].includes(a.id));
      this.actionGroups[2].actions = this.actions.filter(a => ['enable_load_balancing','scale_dmc_workers','isolate_platform'].includes(a.id));
      this.cdr.markForCheck();
    });
  }
 
  onActionChange(): void {
    this.selectedAction = this.actions.find(a => a.id === this.selectedActionId) ?? null;
    this.paramKeys      = this.selectedAction ? Object.keys(this.selectedAction.parameters) : [];
    this.parameters     = {};
    this.paramKeys.forEach(k => {
      this.parameters[k] = this.selectedAction!.parameters[k].default;
    });
    this.cdr.markForCheck();
  }
 
  simulate(): void {
    if (!this.selectedActionId || !this.incidentId) return;
    this.simulating = true;
    this.whatif.simulate(this.incidentId, this.selectedActionId, this.parameters).subscribe({
      next:  r => { this.simulating = false; this.simulated.emit(r); this.cdr.markForCheck(); },
      error: () => { this.simulating = false; this.cdr.markForCheck(); },
    });
  }
 
  compare(): void {
    if (!this.incidentId) return;
    this.comparing = true;
    this.whatif.compare(this.incidentId).subscribe({
      next:  r => { this.comparing = false; this.compared.emit(r); this.cdr.markForCheck(); },
      error: () => { this.comparing = false; this.cdr.markForCheck(); },
    });
  }
 
  formatParamLabel(key: string): string {
    return key.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
  }
 
  getParamUnit(key: string): string {
    if (key.includes('pct')) return '%';
    if (key.includes('sec')) return 'sec';
    if (key.includes('count')) return 'nœuds';
    return '';
  }
}