// ───────────────────────────────────────────────────────────────────────────────
// anomaly-row.component.ts

import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FeedbackLabel, FeedbackService } from "@app/services/feedback.service";
import { PlatformTagComponent } from "@app/shared/components/platform-tag/platform-tag.component";
import { TimeAgoPipe, ToastService, TruncatePipe } from "@app/shared/shared.index";

// ───────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-anomaly-row',
  standalone: true,
  imports: [CommonModule, PlatformTagComponent, TimeAgoPipe, TruncatePipe,FormsModule ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="arow" [class.arow-urgent]="isUrgent" [class.arow-done]="done">
      <!-- Gauge circulaire -->
      <div class="arow-gauge" [title]="(anomaly.anomaly_score*100).toFixed(1)+'%'">
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="15" fill="none"
            stroke="var(--border-subtle)" stroke-width="3.5"/>
          <circle cx="20" cy="20" r="15" fill="none"
            [attr.stroke]="scoreColor" stroke-width="3.5"
            stroke-linecap="round" stroke-dashoffset="23.6"
            [attr.stroke-dasharray]="dashArr"
            transform="rotate(-90 20 20)"/>
        </svg>
        <span class="gauge-val" [style.color]="scoreColor">
          {{ (anomaly.anomaly_score*100).toFixed(0) }}
        </span>
      </div>
 
      <!-- Platform + infos -->
      <div class="arow-body">
        <div class="arow-meta">
          <app-platform-tag [platform]="anomaly.platform" size="sm"/>
          <span class="meta-thresh" *ngIf="anomaly.threshold_type">
            seuil {{ anomaly.threshold_type }}
            <b>{{ anomaly.threshold_used?.toFixed(3) }}</b>
          </span>
          <span class="meta-time">{{ anomaly.timestamp | timeAgo }}</span>
        </div>
        <p class="arow-msg">{{ anomaly.message | truncate:150 }}</p>
        <div class="arow-fl" *ngIf="done">
          <span class="fl-chip" [ngClass]="'fl-' + anomaly.feedback_label">
            {{ flText }}
          </span>
        </div>
      </div>
 
      <!-- Feedback buttons -->
      <div class="arow-fb" *ngIf="!done">
        <button class="fb-btn" (click)="giveFeedback('true_positive')"
                [disabled]="busy" title="Vrai positif — anomalie confirmée">✅</button>
        <button class="fb-btn" (click)="giveFeedback('false_positive')"
                [disabled]="busy" title="Faux positif — log normal">❌</button>
        <button class="fb-btn" (click)="giveFeedback('uncertain')"
                [disabled]="busy" title="Incertain">❓</button>
        <button class="fb-btn" (click)="openCorrect()"
                [disabled]="busy" title="Corriger la cause">✏️</button>
      </div>
      <svg *ngIf="done" width="18" height="18" viewBox="0 0 18 18" fill="none" class="arow-check">
        <circle cx="9" cy="9" r="8" stroke="#22c55e" stroke-width="1.4"/>
        <path d="M5.5 9l2.5 2.5 4.5-5" stroke="#22c55e" stroke-width="1.4"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .arow {
      display:flex; align-items:center; gap:12px;
      padding:10px 14px; border-radius:10px;
      border:1px solid var(--border-subtle); background:var(--bg-card);
      transition:box-shadow 150ms;
    }
    .arow:hover   { box-shadow:0 2px 10px rgba(0,0,0,.07); }
    .arow-urgent  { border-left:3px solid #f59e0b; }
    .arow-done    { opacity:.6; }
 
    .arow-gauge { position:relative; width:40px; height:40px; flex-shrink:0; }
    .gauge-val  {
      position:absolute; inset:0;
      display:flex; align-items:center; justify-content:center;
      font-family:var(--font-mono); font-size:9px; font-weight:700;
    }
 
    .arow-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
    .arow-meta { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
    .meta-thresh { font-size:10px; color:var(--text-faint); font-family:var(--font-mono); }
    .meta-thresh b { color:var(--accent,#0ea5e9); }
    .meta-time  { font-size:10px; color:var(--text-faint); margin-left:auto; }
    .arow-msg   { margin:0; font-size:12px; color:var(--text-secondary); line-height:1.5; }
    .arow-fl    { margin-top:2px; }
    .fl-chip    { padding:1px 7px; border-radius:4px; font-size:10px; font-weight:600; }
    .fl-true_positive  { background:rgba(34,197,94,.12);  color:#16a34a; }
    .fl-false_positive { background:rgba(239,68,68,.12);  color:#dc2626; }
    .fl-uncertain      { background:rgba(245,158,11,.12); color:#d97706; }
    .fl-corrected_cause{ background:rgba(59,130,246,.12); color:#2563eb; }
 
    .arow-fb   { display:flex; gap:3px; flex-shrink:0; }
    .fb-btn {
      width:30px; height:30px; border-radius:7px;
      border:1px solid var(--border-subtle); background:transparent;
      cursor:pointer; font-size:13px;
      display:flex; align-items:center; justify-content:center;
      transition:transform 150ms;
    }
    .fb-btn:hover:not(:disabled) { transform:scale(1.15); border-color:var(--border-default); }
    .fb-btn:disabled { opacity:.4; cursor:wait; }
    .arow-check { flex-shrink:0; }
  `],
})
export class AnomalyRowComponent {
  @Input()  anomaly!: any;
  @Output() feedbackGiven = new EventEmitter<{ id:string; label:FeedbackLabel }>();
 
  busy = false;
  done = false;
 
  get isUrgent(): boolean { return (this.anomaly?.anomaly_score??0) > 0.85; }
 
  get scoreColor(): string {
    const s = this.anomaly?.anomaly_score ?? 0;
    return s > 0.8 ? '#ef4444' : s > 0.65 ? '#f59e0b' : '#3b82f6';
  }
 
  get dashArr(): string {
    const c = 2 * Math.PI * 15;
    const f = (this.anomaly?.anomaly_score ?? 0) * c;
    return `${f} ${c - f}`;
  }
 
get flText(): string {
  const labels: Record<string, string> = {
    true_positive: '✅ Vrai positif',
    false_positive: '❌ Faux positif',
    uncertain: '❓ Incertain',
    corrected_cause: '✏️ Corrigé'
  };
  return labels[this.anomaly?.feedback_label] ?? '';
}
 
  constructor(private fb: FeedbackService, private toast: ToastService) {}
 
  giveFeedback(label: FeedbackLabel): void {
    this.busy = true;
    this.fb.submitFeedback(this.anomaly._id, { label, operator_id:'noc_operator' }).subscribe({
      next: () => {
        this.busy = false; this.done = true;
        this.anomaly.feedback_label = label;
        this.feedbackGiven.emit({ id: this.anomaly._id, label });
        this.toast.success('Feedback enregistré');
      },
      error: () => { this.busy = false; this.toast.error('Erreur feedback'); },
    });
  }
 
  openCorrect(): void {
    const cause = prompt(`Cause réelle :\n${this.anomaly.message?.slice(0,80)}…`);
    if (cause?.trim()) {
      this.busy = true;
      this.fb.submitFeedback(this.anomaly._id, {
        label:'corrected_cause', corrected_cause:cause, operator_id:'noc_operator',
      }).subscribe({
        next: () => { this.busy=false; this.done=true; this.toast.success('Correction enregistrée'); },
        error: () => this.busy=false,
      });
    }
  }
}