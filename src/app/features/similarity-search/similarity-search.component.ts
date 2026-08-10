import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SimilarLogCardComponent } from "./similar-log-card.component";
import { FaissService, SimilarLog } from "@app/services/faiss.service";

// ── similarity-search.component.ts ───────────────────────────────────────────
@Component({
  selector:   'app-similarity-search',
  standalone: true,
  imports:    [CommonModule, FormsModule, SimilarLogCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sim-search">
      <div class="ss-header">
        <span class="ss-ai-badge">FAISS</span>
        <span class="ss-title">Recherche sémantique</span>
        <span class="ss-sub">{{ (totalVectors || 0).toLocaleString('fr-FR') }} vecteurs indexés</span>
      </div>
 
      <!-- Search input -->
      <div class="ss-input-wrap" [class.focused]="focused">
        <svg class="ss-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M10.5 10.5l3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <input class="ss-input" [(ngModel)]="queryText"
               placeholder="Ex: SMPP timeout queue full connection reset by peer"
               (focus)="focused=true" (blur)="focused=false"
               (keydown.enter)="search()"
               [disabled]="loading"/>
        <button class="ss-clear" *ngIf="queryText" (click)="queryText='';results=[]" type="button">✕</button>
        <div class="ss-shortcuts">
          <span *ngFor="let s of shortcuts" class="ss-chip" (click)="quickSearch(s)">{{ s }}</span>
        </div>
      </div>
      <button class="ss-btn" (click)="search()" [disabled]="!queryText.trim() || loading">
        <svg *ngIf="!loading" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M9.5 9.5l3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <svg *ngIf="loading" class="spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,.3)" stroke-width="2"/>
          <path d="M7 1.5a5.5 5.5 0 015.5 5.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
        {{ loading ? 'Recherche...' : 'Rechercher' }}
      </button>
 
      <!-- Results -->
      <div class="ss-results" *ngIf="results.length">
        <div class="ssr-header">
          <span>{{ results.length }} résultat{{ results.length > 1 ? 's' : '' }}</span>
          <span class="ssr-time">{{ searchTime }}ms</span>
        </div>
        <app-similar-log-card *ngFor="let r of results" [log]="r"/>
      </div>
 
      <div class="ss-empty" *ngIf="searched && !loading && results.length === 0">
        Aucun log similaire trouvé pour cette requête.
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .sim-search { display:flex; flex-direction:column; gap:10px; }
    .ss-header { display:flex; align-items:center; gap:8px; }
    .ss-ai-badge { padding:2px 7px; border-radius:5px; font-size:9px; font-weight:800;
      letter-spacing:.1em; background:rgba(14,165,233,.15); color:var(--accent); }
    .ss-title { font-size:13px; font-weight:600; color:var(--text-primary); }
    .ss-sub   { font-size:11px; color:var(--text-faint); margin-left:auto; font-family:var(--font-mono); }
    .ss-input-wrap {
      display:flex; align-items:center; gap:6px; flex-wrap:wrap;
      padding:0 12px; min-height:40px;
      border:1px solid var(--border-subtle); border-radius:8px;
      background:var(--bg-input); transition:border-color 150ms, box-shadow 150ms;
    }
    .ss-input-wrap.focused { border-color:var(--accent); box-shadow:0 0 0 3px rgba(14,165,233,.1); background:var(--bg-card); }
    .ss-icon  { color:var(--text-muted); flex-shrink:0; }
    .ss-input { flex:1; min-width:200px; border:none; background:transparent;
      font-size:13px; color:var(--text-primary); outline:none;
      &::placeholder { color:var(--text-faint); }
    }
    .ss-clear { background:none; border:none; cursor:pointer; color:var(--text-muted);
      font-size:12px; padding:0; &:hover { color:var(--text-primary); } }
    .ss-shortcuts { display:flex; gap:4px; flex-wrap:wrap; padding:4px 0; }
    .ss-chip { font-size:10px; padding:2px 7px; border-radius:4px;
      background:var(--bg-hover); color:var(--text-muted); cursor:pointer;
      border:1px solid var(--border-subtle); transition:all 150ms;
      &:hover { background:rgba(14,165,233,.1); color:var(--accent); border-color:rgba(14,165,233,.3); }
    }
    .ss-btn { width:100%; padding:9px; border-radius:8px; border:none;
      background:var(--accent); color:#fff; font-size:13px; font-weight:600;
      cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px;
      transition:opacity 150ms; &:hover { opacity:.88; } &:disabled { opacity:.5; cursor:not-allowed; } }
    .spin { animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .ss-results { display:flex; flex-direction:column; gap:6px; }
    .ssr-header { display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); }
    .ssr-time   { font-family:var(--font-mono); }
    .ss-empty   { text-align:center; padding:16px; font-size:12px; color:var(--text-faint); }
  `],
})
export class SimilaritySearchComponent {
  @Input()  platformFilter?: string;
  @Input()  totalVectors = 7_224_549;
 
  results:   SimilarLog[] = [];
  queryText  = '';
  loading    = false;
  searched   = false;
  focused    = false;
  searchTime = 0;
 
  readonly shortcuts = ['timeout', 'queue full', 'connection reset', 'fail retry', 'disconnect'];
 
  constructor(private faiss: FaissService, private cdr: ChangeDetectorRef) {}
 
  quickSearch(term: string): void { this.queryText = term; this.search(); }
 
  search(): void {
    if (!this.queryText.trim()) return;
    const t0 = Date.now();
    this.loading  = true;
    this.searched = true;
    this.faiss.searchByText(this.queryText, 5, this.platformFilter).subscribe({
      next: r => {
        this.results    = r.results;
        this.searchTime = Date.now() - t0;
        this.loading    = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }
}