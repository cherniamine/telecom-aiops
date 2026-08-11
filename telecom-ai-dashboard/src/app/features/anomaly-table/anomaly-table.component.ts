// ───────────────────────────────────────────────────────────────────────────────
// anomaly-table.component.ts

import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AnomalyRowComponent } from "./anomaly-row.component";
import { EmptyStateComponent, LoadingSpinnerComponent, SearchBarComponent } from "@app/shared/shared.index";

// ───────────────────────────────────────────────────────────────────────────────
@Component({
  selector:   'app-anomaly-table',
  standalone: true,
  imports: [CommonModule, FormsModule, AnomalyRowComponent,
    SearchBarComponent, EmptyStateComponent, LoadingSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="atable">
      <div class="at-toolbar">
        <app-search-bar placeholder="Filtrer..." (valueChange)="onSearch($event)"
          style="flex:1;max-width:280px"/>
        <select class="at-sel" [(ngModel)]="platformFilter" (ngModelChange)="apply()">
          <option value="">Toutes plateformes</option>
          <option *ngFor="let p of platforms" [value]="p">{{ p }}</option>
        </select>
        <select class="at-sel" [(ngModel)]="sortBy" (ngModelChange)="apply()">
          <option value="score_desc">Score ↓</option>
          <option value="score_asc">Score ↑</option>
          <option value="time_desc">Récent d'abord</option>
        </select>
        <span class="at-count">{{ filtered.length }}/{{ anomalies.length }}</span>
      </div>
 
      <app-loading-spinner *ngIf="loading" minHeight="160px"/>
      <app-empty-state *ngIf="!loading && filtered.length===0"
        title="Aucune anomalie" description="Modifiez les filtres."/>
 
      <div class="at-list" *ngIf="!loading && filtered.length>0">
        <app-anomaly-row *ngFor="let a of page_data; trackBy:trackId"
          [anomaly]="a" (feedbackGiven)="onFb($event)"/>
      </div>
 
      <div class="at-pager" *ngIf="totalPages>1">
        <button class="pg" (click)="pg=pg-1" [disabled]="pg===1">‹</button>
        <span class="pg-info">{{ pg }}/{{ totalPages }}</span>
        <button class="pg" (click)="pg=pg+1" [disabled]="pg===totalPages">›</button>
      </div>
    </div>
  `,
  styles: [`
    .atable { display:flex; flex-direction:column; gap:10px; }
    .at-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .at-sel {
      padding:6px 10px; border-radius:8px;
      border:1px solid var(--border-subtle); background:var(--bg-input);
      color:var(--text-primary); font-size:12px; outline:none; cursor:pointer;
    }
    .at-count { font-size:12px; color:var(--text-muted); margin-left:auto; }
    .at-list  { display:flex; flex-direction:column; gap:5px; }
    .at-pager { display:flex; align-items:center; justify-content:center; gap:10px; }
    .pg {
      width:30px; height:30px; border-radius:7px;
      border:1px solid var(--border-subtle); background:transparent;
      color:var(--text-muted); cursor:pointer; font-size:15px;
      transition:all 150ms;
    }
    .pg:hover:not(:disabled) { background:var(--bg-hover); color:var(--text-primary); }
    .pg:disabled { opacity:.35; }
    .pg-info { font-size:12px; color:var(--text-muted); font-family:var(--font-mono); }
  `],
})
export class AnomalyTableComponent implements OnChanges {
  @Input()  anomalies:  any[]  = [];
  @Input()  loading            = false;
  @Input()  pageSize           = 20;
  @Output() feedbackSubmitted  = new EventEmitter<any>();
 
  filtered  : any[] = [];
  searchTerm = ''; platformFilter = ''; sortBy = 'score_desc'; pg = 1;
  readonly platforms = ['MMG','SMSC','SMPPS','SMPPC','DMC'];
 
  get page_data(): any[] { return this.filtered.slice((this.pg-1)*this.pageSize, this.pg*this.pageSize); }
  get totalPages(): number { return Math.max(1, Math.ceil(this.filtered.length/this.pageSize)); }
 
  ngOnChanges(): void { this.apply(); }
  onSearch(q:string): void { this.searchTerm=q; this.apply(); }
 
  apply(): void {
    this.pg = 1;
    let list = [...this.anomalies];
    if (this.platformFilter) list = list.filter(a=>a.platform?.toUpperCase()===this.platformFilter);
    if (this.searchTerm) list = list.filter(a=>a.message?.toLowerCase().includes(this.searchTerm.toLowerCase()));
    if (this.sortBy==='score_desc') list.sort((a,b)=>(b.anomaly_score??0)-(a.anomaly_score??0));
    else if (this.sortBy==='score_asc')  list.sort((a,b)=>(a.anomaly_score??0)-(b.anomaly_score??0));
    else list.sort((a,b)=>(b.timestamp??'').localeCompare(a.timestamp??''));
    this.filtered = list;
  }
 
  onFb(ev:any): void { this.feedbackSubmitted.emit(ev); }
  trackId = (_:number, a:any) => a._id;
}