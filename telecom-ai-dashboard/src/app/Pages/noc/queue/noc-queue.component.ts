// ═══════════════════════════════════════════════════════════════════════════════
// noc/queue/noc-queue.component.ts — anomalies à valider ✅❌❓
// ═══════════════════════════════════════════════════════════════════════════════

import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { FeedbackLabel, FeedbackService } from "@app/services/feedback.service";
import { NocQueueItem, NocService } from "@app/services/noc.service";
import { EmptyStateComponent, LoadingSpinnerComponent, PlatformTagComponent, SearchBarComponent, TimeAgoPipe, ToastService } from "@app/shared/shared.index";

// Import des pipes personnalisés
import { FormatNocMessagePipe } from "@app/shared/pipes/format-noc-message.pipe";
import { ExtractConnectorPipe } from "@app/shared/pipes/extract-connector.pipe";
import { MessageIconPipe } from "@app/shared/pipes/message-icon.pipe";

// Import du dialog moderne
import { ConfirmDialogService } from "@app/shared/components/confirm-dialog/confirm-dialog.component";
import { CorrectionModalComponent } from "@app/shared/components/correction-modal/correction-modal.component";

@Component({
  selector: 'app-noc-queue',
  standalone: true,
  imports: [
    CommonModule,
    PlatformTagComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    SearchBarComponent,
    TimeAgoPipe,
    FormsModule,
    FormatNocMessagePipe,
    ExtractConnectorPipe,
    MessageIconPipe,
    CorrectionModalComponent
  ],
  template: `
    <div class="queue-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">File d'attente NOC</h1>
          <p class="page-sub">Anomalies en attente de validation · {{ pending.length }} en attente</p>
        </div>
        <div class="stats-mini">
          <span class="sm-badge sm-urgent">{{ urgentCount }} urgentes</span>
          <span class="sm-badge sm-normal">{{ pending.length - urgentCount }} normales</span>
        </div>
      </div>

      <div class="filters-row">
        <app-search-bar placeholder="Filtrer les anomalies..."
          (valueChange)="onSearch($event)" style="flex:1; max-width:340px"/>
        <div class="filter-pills">
          <button class="pill" [class.active]="platformFilter === ''"
                  (click)="platformFilter = ''; applyFilter()">Toutes</button>
          <button class="pill" *ngFor="let p of platforms"
                  [class.active]="platformFilter === p"
                  (click)="platformFilter = p; applyFilter()">{{ p }}</button>
        </div>
      </div>

      <app-loading-spinner *ngIf="loading" label="Chargement de la file..." minHeight="200px"/>

      <app-empty-state *ngIf="!loading && filtered.length === 0"
        title="File d'attente vide"
        description="Toutes les anomalies ont été validées. Excellent travail !"/>

      <div class="queue-list" *ngIf="!loading && filtered.length > 0">
        <div class="queue-item" *ngFor="let a of filtered; trackBy: trackById"
             [class.qi-urgent]="a.urgency === 'URGENT'"
             [class.qi-processing]="processing.has(a._id)">

          <div class="qi-score">
            <span class="score-val" [class.score-high]="a.anomaly_score > 0.8">
              {{ (a.anomaly_score * 100).toFixed(1) }}%
            </span>
            <span class="score-lbl">score</span>
          </div>

          <div class="qi-platform">
            <app-platform-tag [platform]="a.platform"/>
            <span class="qi-thresh" *ngIf="a.threshold_type">
              seuil {{ a.threshold_type }}
            </span>
          </div>

          <!-- Message formaté -->
          <div class="qi-message">
            <div class="qm-header">
              <div class="qm-left">
                <span class="qm-icon" [innerHTML]="a.message | messageIcon"></span>
                <span class="platform-badge" [class]="'platform-' + a.platform.toLowerCase()">
                  {{ a.platform | uppercase }}
                </span>
                <span class="connector-badge" *ngIf="a.message | extractConnector as connector">
                  <span class="connector-icon" [innerHTML]="getConnectorIcon()"></span>
                  {{ connector }}
                </span>
              </div>
              <span class="urgency-badge" [class]="'urgency-' + a.urgency.toLowerCase()">
                {{ a.urgency }}
              </span>
            </div>
            
            <p class="qm-message" [innerHTML]="a.message | formatNocMessage:true"></p>
            
            <div class="qm-footer">
              <span class="qm-score" *ngIf="a.anomaly_score">
                <span class="score-icon" [innerHTML]="getScoreIcon()"></span>
                Score: {{ a.anomaly_score | number:'1.3-3' }}
              </span>
              <span class="qm-time">
                <span class="time-icon" [innerHTML]="getTimeIcon()"></span>
                {{ a.timestamp | timeAgo }}
              </span>
              <button class="qm-expand" (click)="toggleRawMessage(a._id)" title="Voir message brut">
                <span class="expand-icon" [innerHTML]="getExpandIcon()"></span>
              </button>
            </div>
            
            <div class="qm-raw" *ngIf="expandedRawId === a._id">
              <code>{{ a.message }}</code>
            </div>
          </div>

          <!-- Feedback buttons -->
          <div class="qi-actions">
            <button class="fb-btn fb-tp" (click)="submitFeedback(a._id, 'true_positive')"
                    [disabled]="processing.has(a._id)" title="Vrai positif — anomalie confirmée">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2" 
                      stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M14 2L8 8L6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 4L14 2L12 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            
            <button class="fb-btn fb-fp" (click)="submitFeedback(a._id, 'false_positive')"
                    [disabled]="processing.has(a._id)" title="Faux positif — log normal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
                <path d="M10 6L6 10M6 6L10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            
            <button class="fb-btn fb-un" (click)="submitFeedback(a._id, 'uncertain')"
                    [disabled]="processing.has(a._id)" title="Incertain">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 5.5V8M8 10.5V10.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            
            <button class="fb-btn fb-cc" (click)="openCorrection(a)"
                    [disabled]="processing.has(a._id)" title="Corriger la cause">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M9 2L4 7V12H9L14 7L9 2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                <path d="M7 12L5 14M11 6L13 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Retrain banner -->
      <div class="retrain-banner" *ngIf="retrainReady">
        <span class="retrain-icon" [innerHTML]="getRetrainIcon()"></span>
        <span>50+ feedbacks disponibles — le modèle peut être ré-entraîné</span>
        <button class="retrain-btn" (click)="triggerRetrain()" [disabled]="retraining">
          {{ retraining ? 'Ré-entraînement...' : 'Lancer le ré-entraînement' }}
        </button>
      </div>
      <!-- Correction Modal -->
      <app-correction-modal 
        *ngIf="showCorrectionModal"
        [message]="selectedAnomaly?.message || ''"
        [platform]="selectedAnomaly?.platform || ''"
        [score]="selectedAnomaly?.anomaly_score || 0"
        (confirmed)="onCorrectionConfirmed($event)"
        (cancelled)="closeCorrectionModal()">
      </app-correction-modal>
    </div>
  `,
  styles: [`
    .queue-page { display: flex; flex-direction: column; gap: 16px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
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
    .page-sub { margin: 4px 0 0; font-size: 12px; color: var(--text-muted); }
    .stats-mini { display: flex; gap: 8px; flex-shrink: 0; }
    .sm-badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .sm-urgent { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
    .sm-normal { background: var(--bg-hover); color: var(--text-muted); }
    .filters-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .filter-pills { display: flex; gap: 6px; flex-wrap: wrap; }
    .pill {
      padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border-subtle);
      background: transparent; color: var(--text-muted); font-size: 11px;
      font-weight: 500; cursor: pointer; transition: all 150ms;
    }
    .pill.active { background: var(--bg-active); color: var(--accent); border-color: rgba(14, 165, 233, 0.3); }
    .queue-list { display: flex; flex-direction: column; gap: 6px; }
    .queue-item {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 12px 14px; border-radius: 10px;
      border: 1px solid var(--border-subtle); background: var(--bg-card);
      transition: all 150ms;
    }
    .queue-item:hover { box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06); }
    .qi-urgent { border-left: 3px solid #ef4444; }
    .qi-processing { opacity: 0.6; pointer-events: none; }
    .qi-score { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; min-width: 52px; }
    .score-val { font-family: var(--font-mono); font-size: 16px; font-weight: 700; color: var(--text-primary); }
    .score-high { color: #f59e0b; }
    .score-lbl { font-size: 9px; color: var(--text-faint); letter-spacing: 0.06em; }
    .qi-platform { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; flex-shrink: 0; }
    .qi-thresh { font-size: 9px; color: var(--text-faint); }
    
    /* Message styles */
    .qi-message {
      flex: 1;
      background: var(--bg-card);
      border-radius: 12px;
      padding: 12px;
      border: 1px solid var(--border-subtle);
      transition: all 0.2s ease;
    }
    
    .qi-message:hover {
      border-color: var(--accent);
      background: rgba(14, 165, 233, 0.02);
    }
    
    .qm-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .qm-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    
    .qm-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      
      svg {
        width: 18px;
        height: 18px;
      }
    }
    
    .platform-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 10px;
      border-radius: 20px;
      font-family: var(--font-mono);
      
      &.platform-mmg { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }
      &.platform-smsc { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
      &.platform-smpps { background: rgba(6, 182, 212, 0.15); color: #22d3ee; }
      &.platform-smppc { background: rgba(16, 185, 129, 0.15); color: #34d399; }
      &.platform-dmc { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    }
    
    .connector-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(14, 165, 233, 0.1);
      color: #38bdf8;
      font-family: var(--font-mono);
      
      .connector-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        
        svg {
          width: 12px;
          height: 12px;
        }
      }
    }
    
    .urgency-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      
      &.urgency-urgent {
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
      }
      &.urgency-high {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }
      &.urgency-normal {
        background: rgba(148, 163, 184, 0.15);
        color: #94a3b8;
      }
    }
    
    .qm-message {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin: 0 0 8px 0;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      line-height: 1.45;
      
      svg {
        flex-shrink: 0;
      }
    }
    
    .qm-footer {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 10px;
      color: var(--text-faint);
    }
    
    .qm-score, .qm-time {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    
    .score-icon, .time-icon, .expand-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      
      svg {
        width: 12px;
        height: 12px;
      }
    }
    
    .qm-expand {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-muted);
      padding: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      opacity: 0.6;
      transition: opacity 0.2s;
      
      &:hover {
        opacity: 1;
        color: var(--accent);
      }
    }
    
    .qm-raw {
      margin-top: 8px;
      padding: 8px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      border-left: 3px solid var(--accent);
      
      code {
        font-family: 'Fira Code', 'DM Mono', monospace;
        font-size: 10px;
        white-space: pre-wrap;
        word-break: break-all;
        color: var(--text-muted);
      }
    }
    
    .qi-actions { display: flex; gap: 6px; flex-shrink: 0; align-items: flex-start; }
    .fb-btn {
      width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border-subtle);
      background: transparent; cursor: pointer; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
      transition: all 150ms;
    }
    .fb-btn:hover { transform: scale(1.12); border-color: var(--border-default); }
    .fb-btn:disabled { opacity: 0.45; cursor: wait; }
    .fb-tp:hover { background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.3); }
    .fb-fp:hover { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); }
    .fb-un:hover { background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3); }
    .fb-cc:hover { background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.3); }
    
    .retrain-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px;
      border-radius: 10px;
      background: rgba(14, 165, 233, 0.06);
      border: 1px solid rgba(14, 165, 233, 0.2);
      font-size: 13px;
      color: var(--text-secondary);
    }
    
    .retrain-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      
      svg {
        width: 16px;
        height: 16px;
      }
    }
    
    .retrain-btn {
      padding: 7px 16px; border-radius: 8px; border: none;
      background: var(--accent, #0ea5e9); color: #fff;
      font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;
      transition: opacity 150ms;
    }
    .retrain-btn:hover { opacity: 0.88; }
    .retrain-btn:disabled { opacity: 0.55; cursor: wait; }
  `]
})
export class NocQueueComponent implements OnInit {
  loading = true;
  pending: NocQueueItem[] = [];
  filtered: NocQueueItem[] = [];
  processing = new Set<string>();
  searchTerm = '';
  platformFilter = '';
  retrainReady = false;
  retraining = false;
  platforms: string[] = ['MMG', 'SMSC', 'SMPPS', 'SMPPC', 'DMC'];
  expandedRawId: string | null = null;
  showCorrectionModal = false;
  selectedAnomaly: NocQueueItem | null = null;

  get urgentCount(): number { 
    return this.pending.filter(a => a.urgency === 'URGENT').length; 
  }

  constructor(
    private noc: NocService,
    private feedback: FeedbackService,
    private toast: ToastService,
    private sanitizer: DomSanitizer,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadQueue();
    this.feedback.getStats().subscribe(s => this.retrainReady = s.retrain_ready);
  }

  private loadQueue(): void {
    this.noc.getQueue(50).subscribe({
      next: r => { 
        this.pending = r.queue; 
        this.applyFilter(); 
        this.loading = false; 
      },
      error: () => this.loading = false,
    });
  }

  onSearch(q: string): void { 
    this.searchTerm = q; 
    this.applyFilter(); 
  }

  applyFilter(): void {
    this.filtered = this.pending.filter(a => {
      const matchPlatform = !this.platformFilter
        || a.platform?.toUpperCase() === this.platformFilter;
      const matchText = !this.searchTerm
        || a.message?.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchPlatform && matchText;
    });
  }

  // Icônes SVG pour les éléments UI
  getConnectorIcon(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(`<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="3" width="2.5" height="6" rx="0.5" stroke="#38bdf8" stroke-width="1"/>
      <rect x="8" y="3" width="2.5" height="6" rx="0.5" stroke="#38bdf8" stroke-width="1"/>
      <path d="M4 6H8" stroke="#38bdf8" stroke-width="1" stroke-linecap="round"/>
    </svg>`);
  }

  getScoreIcon(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(`<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="2.5" width="9" height="7" rx="0.8" stroke="#94a3b8" stroke-width="1"/>
      <rect x="3" y="4" width="1.5" height="3.5" rx="0.3" fill="#f97316"/>
      <rect x="5" y="3.5" width="1.5" height="4" rx="0.3" fill="#f97316"/>
      <rect x="7" y="4.5" width="1.5" height="3" rx="0.3" fill="#f97316"/>
    </svg>`);
  }

  getTimeIcon(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(`<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="4.5" stroke="#94a3b8" stroke-width="1"/>
      <path d="M6 3V6L7.5 7.5" stroke="#94a3b8" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`);
  }

  getExpandIcon(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(`<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`);
  }

  getRetrainIcon(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 8 14" stroke="#38bdf8" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M8 2L10 4L8 6" stroke="#38bdf8" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 8L10 10L8 8" stroke="#38bdf8" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`);
  }

  submitFeedback(id: string, label: FeedbackLabel): void {
    this.processing.add(id);
    this.feedback.submitFeedback(id, { label, operator_id: 'noc_operator' }).subscribe({
      next: () => {
        this.processing.delete(id);
        this.pending = this.pending.filter(a => a._id !== id);
        this.filtered = this.filtered.filter(a => a._id !== id);
        const msg = label === 'true_positive' ? 'Anomalie confirmée ✓'
                  : label === 'false_positive' ? 'Marquée faux positif ✗'
                  : 'Feedback enregistré';
        this.toast.success(msg);
        this.feedback.getStats().subscribe(s => this.retrainReady = s.retrain_ready);
      },
      error: () => { 
        this.processing.delete(id); 
        this.toast.error('Erreur lors du feedback'); 
      },
    });
  }


  private truncateMessage(message: string, maxLength: number): string {
    if (!message) return '';
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  }

  

  triggerRetrain(): void {
    this.retraining = true;
    this.feedback.retrain().subscribe({
      next: r => { 
        this.retraining = false; 
        this.retrainReady = false;
        this.toast.success('Ré-entraînement terminé', `${r.samples_used ?? '?'} feedbacks intégrés`); 
      },
      error: () => { 
        this.retraining = false; 
        this.toast.error('Erreur ré-entraînement'); 
      },
    });
  }

  toggleRawMessage(id: string): void {
    this.expandedRawId = this.expandedRawId === id ? null : id;
  }

  trackById = (_: number, a: NocQueueItem) => a._id;

  openCorrection(a: NocQueueItem): void {
    this.selectedAnomaly = a;
    this.showCorrectionModal = true;
  }

  closeCorrectionModal(): void {
    this.showCorrectionModal = false;
    this.selectedAnomaly = null;
  }

  onCorrectionConfirmed(cause: string): void {
    if (this.selectedAnomaly && cause) {
      this.submitFeedbackWithCause(this.selectedAnomaly._id, cause);
      this.closeCorrectionModal();
    }
  }

  private submitFeedbackWithCause(id: string, cause: string): void {
    this.processing.add(id);
    this.feedback.submitFeedback(id, {
      label: 'corrected_cause',
      corrected_cause: cause,
      operator_id: 'noc_operator',
    }).subscribe({
      next: () => {
        this.processing.delete(id);
        this.pending = this.pending.filter(a => a._id !== id);
        this.filtered = this.filtered.filter(a => a._id !== id);
        this.toast.success('Correction enregistrée ✏️');
      },
      error: () => { 
        this.processing.delete(id); 
        this.toast.error('Erreur lors de la correction');
      },
    });
  }
  
}