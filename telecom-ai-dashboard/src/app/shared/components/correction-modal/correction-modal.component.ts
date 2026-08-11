// shared/components/correction-modal/correction-modal.component.ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-correction-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop" (click)="close()">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">
            <span class="modal-icon" [innerHTML]="getEditIcon()"></span>
            <h3>Corriger la cause</h3>
          </div>
          <button class="modal-close" (click)="close()" title="Fermer">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="anomaly-preview">
            <div class="preview-label">Anomalie concernée :</div>
            <div class="preview-message">{{ truncatedMessage }}</div>
            <div class="preview-meta">
              <span class="preview-platform">{{ platform }}</span>
              <span class="preview-score">Score: {{ (score * 100).toFixed(1) }}%</span>
            </div>
          </div>

          <div class="input-group">
            <label class="input-label">
              <span class="label-icon" [innerHTML]="getCauseIcon()"></span>
              Cause corrective
            </label>
            <textarea 
              [(ngModel)]="cause"
              class="cause-input"
              placeholder="Ex: Augmentation du timeout SMSC, Redémarrage du service, Correction de la configuration..."
              rows="4"
              autofocus
            ></textarea>
            <div class="input-hint">Décrivez la cause racine ou l'action corrective identifiée</div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" (click)="close()">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M8 7L13 12M6 7L1 12M8 7L13 2M6 7L1 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            Annuler
          </button>
          <button class="btn-confirm" (click)="confirm()" [disabled]="!cause.trim()">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11.5 3.5L5 10L2.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Enregistrer la correction
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
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

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

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
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px;
      border-bottom: 1px solid var(--border-subtle, rgba(148, 163, 184, 0.15));
    }

    .modal-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .modal-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }

    .modal-title h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary, #f1f5f9);
    }

    .modal-close {
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--text-muted, #94a3b8);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border-radius: 8px;
      transition: all 150ms;
    }

    .modal-close:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    .modal-body {
      padding: 20px;
    }

    .anomaly-preview {
      background: rgba(14, 165, 233, 0.05);
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 20px;
      border-left: 3px solid var(--accent, #0ea5e9);
    }

    .preview-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted, #94a3b8);
      margin-bottom: 8px;
    }

    .preview-message {
      font-size: 13px;
      line-height: 1.5;
      color: var(--text-primary, #f1f5f9);
      margin-bottom: 10px;
      word-break: break-word;
    }

    .preview-meta {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .preview-platform {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      font-family: var(--font-mono);
    }

    .preview-score {
      font-size: 10px;
      color: #f59e0b;
      font-family: var(--font-mono);
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .input-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary, #f1f5f9);
    }

    .label-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
    }

    .cause-input {
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid var(--border-subtle, rgba(148, 163, 184, 0.2));
      background: var(--bg-page, #0f172a);
      color: var(--text-primary, #f1f5f9);
      font-size: 13px;
      line-height: 1.5;
      resize: vertical;
      font-family: inherit;
      transition: all 150ms;
    }

    .cause-input:focus {
      outline: none;
      border-color: var(--accent, #0ea5e9);
      box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
    }

    .cause-input::placeholder {
      color: var(--text-faint, #64748b);
    }

    .input-hint {
      font-size: 11px;
      color: var(--text-faint, #64748b);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      border-top: 1px solid var(--border-subtle, rgba(148, 163, 184, 0.15));
    }

    .btn-cancel, .btn-confirm {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 150ms;
      border: none;
    }

    .btn-cancel {
      background: transparent;
      color: var(--text-muted, #94a3b8);
      border: 1px solid var(--border-subtle, rgba(148, 163, 184, 0.3));
    }

    .btn-cancel:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.3);
    }

    .btn-confirm {
      background: linear-gradient(135deg, var(--accent, #0ea5e9), #3b82f6);
      color: white;
    }

    .btn-confirm:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
    }

    .btn-confirm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class CorrectionModalComponent {
  @Input() message: string = '';
  @Input() platform: string = '';
  @Input() score: number = 0;
  @Output() confirmed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  cause: string = '';
  truncatedMessage: string = '';

  ngOnInit(): void {
    this.truncatedMessage = this.message.length > 120 
      ? this.message.substring(0, 120) + '...' 
      : this.message;
  }

  close(): void {
    this.cancelled.emit();
  }

  confirm(): void {
    if (this.cause.trim()) {
      this.confirmed.emit(this.cause.trim());
    }
  }

  getEditIcon(): string {
    return `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M12.5 2.5L15.5 5.5M14 1L9 6V9H12L17 4L14 1Z" stroke="#f59e0b" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M2 13L1 17L5 16L14 7L11 4L2 13Z" stroke="#f59e0b" stroke-width="1.3" stroke-linejoin="round"/>
    </svg>`;
  }

  getCauseIcon(): string {
    return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1V3M7 11V13M1 7H3M11 7H13M2.5 2.5L4 4M10 10L11.5 11.5M2.5 11.5L4 10M10 4L11.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.2"/>
    </svg>`;
  }
}