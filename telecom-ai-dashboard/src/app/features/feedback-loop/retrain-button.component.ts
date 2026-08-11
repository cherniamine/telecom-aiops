import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from "@angular/core";
import { FeedbackService } from "@app/services/feedback.service";
import { ToastService } from "@app/shared/shared.index";

// ── retrain-button.component.ts ───────────────────────────────────────────────
@Component({
  selector:   'app-retrain-button',
  standalone: true,
  imports:    [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="retrain-btn" [ngClass]="{'ready': ready, 'retraining': loading}"
            (click)="trigger()" [disabled]="!ready || loading">
      <svg *ngIf="!loading" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M12 7A5 5 0 112 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M2 1.5v3h3"  stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg *ngIf="loading" class="spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,.3)" stroke-width="2"/>
        <path d="M7 1.5a5.5 5.5 0 015.5 5.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
      {{ loading ? 'Ré-entraînement...' : ready ? '🔄 Ré-entraîner le modèle' : 'En attente de feedbacks' }}
    </button>
  `,
  styles: [`
    :host { display:block; }
    .retrain-btn {
      width:100%; padding:10px 16px; border-radius:8px; border:none;
      font-size:13px; font-weight:600; cursor:not-allowed;
      display:flex; align-items:center; justify-content:center; gap:7px;
      background:var(--bg-hover); color:var(--text-muted); border:1px solid var(--border-subtle);
      transition:all 150ms;
    }
    .retrain-btn.ready { background:var(--accent); color:#fff; cursor:pointer; border-color:transparent;
      &:hover { opacity:.88; } }
    .retrain-btn.retraining { opacity:.7; cursor:wait; }
    .spin { animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `],
})
export class RetrainButtonComponent {
  @Input()  ready   = false;
  @Output() done    = new EventEmitter<any>();
  loading = false;
 
  constructor(private feedback: FeedbackService, private toast: ToastService, private cdr: ChangeDetectorRef) {}
 
  trigger(): void {
    if (!this.ready) return;
    this.loading = true;
    this.feedback.retrain().subscribe({
      next: r => {
        this.loading = false;
        this.done.emit(r);
        this.toast.success(`Ré-entraînement terminé`, `${r.samples_used ?? '?'} feedbacks intégrés`);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.toast.error('Erreur lors du ré-entraînement');
        this.cdr.markForCheck();
      },
    });
  }
}