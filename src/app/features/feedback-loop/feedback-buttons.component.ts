// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK LOOP COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
 
import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy,
         ChangeDetectorRef } from '@angular/core';
import { CommonModule }      from '@angular/common';
import { FeedbackService, FeedbackStats } from '../../services/feedback.service';
import { ToastService }      from '../../shared/components/toast/toast.component';
 
// ── feedback-buttons.component.ts ────────────────────────────────────────────
@Component({
  selector:   'app-feedback-buttons',
  standalone: true,
  imports:    [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fb-group" [class.fb-compact]="compact" [class.fb-processing]="processing">
      <button class="fb-btn tp"
              [class.fb-active]="currentLabel === 'true_positive'"
              (click)="emit('true_positive')"
              [disabled]="processing"
              [title]="compact ? '✅ Vrai positif' : ''">
        <span class="fb-emoji">✅</span>
        <span class="fb-text" *ngIf="!compact">Vrai positif</span>
      </button>
      <button class="fb-btn fp"
              [class.fb-active]="currentLabel === 'false_positive'"
              (click)="emit('false_positive')"
              [disabled]="processing"
              [title]="compact ? '❌ Faux positif' : ''">
        <span class="fb-emoji">❌</span>
        <span class="fb-text" *ngIf="!compact">Faux positif</span>
      </button>
      <button class="fb-btn un"
              [class.fb-active]="currentLabel === 'uncertain'"
              (click)="emit('uncertain')"
              [disabled]="processing"
              [title]="compact ? '❓ Incertain' : ''">
        <span class="fb-emoji">❓</span>
        <span class="fb-text" *ngIf="!compact">Incertain</span>
      </button>
      <button class="fb-btn cc"
              [class.fb-active]="currentLabel === 'corrected_cause'"
              (click)="onCorrect()"
              [disabled]="processing"
              [title]="compact ? '✏️ Corriger' : ''">
        <span class="fb-emoji">✏️</span>
        <span class="fb-text" *ngIf="!compact">Corriger</span>
      </button>
    </div>
  `,
  styles: [`
    :host { display:inline-flex; }
    .fb-group { display:flex; gap:4px; }
    .fb-processing { opacity:.5; pointer-events:none; }
    .fb-btn {
      display:flex; align-items:center; gap:5px;
      padding:5px 10px; border-radius:7px;
      border:1px solid var(--border-subtle); background:transparent;
      cursor:pointer; transition:all 150ms; font-size:12px; font-weight:500;
      color:var(--text-muted);
    }
    .fb-compact .fb-btn { padding:5px 7px; }
    .fb-btn:hover   { transform:scale(1.08); border-color:var(--border-default); }
    .fb-btn:disabled { opacity:.4; cursor:wait; transform:none; }
    .fb-active { background:var(--bg-active); border-color:var(--accent); }
    .fb-emoji  { font-size:13px; line-height:1; }
    .fb-text   { color:var(--text-secondary); font-size:11px; }
    .tp:hover  { background:rgba(34,197,94,.08);  border-color:rgba(34,197,94,.3); }
    .fp:hover  { background:rgba(239,68,68,.08);  border-color:rgba(239,68,68,.3); }
    .un:hover  { background:rgba(245,158,11,.08); border-color:rgba(245,158,11,.3); }
    .cc:hover  { background:rgba(59,130,246,.08); border-color:rgba(59,130,246,.3); }
  `],
})
export class FeedbackButtonsComponent {
  @Input()  anomalyId!:    string;
  @Input()  currentLabel?: string;
  @Input()  compact        = true;
  @Input()  processing     = false;
  @Output() submitted      = new EventEmitter<{ id: string; label: string; cause?: string }>();
 
  emit(label: string): void {
    this.submitted.emit({ id: this.anomalyId, label });
  }
 
  onCorrect(): void {
    const cause = prompt('Quelle est la vraie cause racine pour cette anomalie ?');
    if (cause?.trim()) {
      this.submitted.emit({ id: this.anomalyId, label: 'corrected_cause', cause: cause.trim() });
    }
  }
}