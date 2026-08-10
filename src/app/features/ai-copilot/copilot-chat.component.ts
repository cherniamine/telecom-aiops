import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CopilotService } from "@app/services/copilot.service";

// ── copilot-chat.component.ts ─────────────────────────────────────────────────
interface ChatMessage {
  role:      'user' | 'assistant';
  content:   string;
  source?:   string;
  loading?:  boolean;
  timestamp: Date;
}
 
const QUICK_QUESTIONS = [
  'What is the root cause and the best action?',
  'Quel est l\'impact sur les clients ?',
  'Quelle est la durée estimée de résolution ?',
  'Quelles plateformes sont affectées ?',
];
 
@Component({
  selector:   'app-copilot-chat',
  standalone: true,
  imports:    [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="copilot-chat">
      <!-- Header -->
      <div class="cc-header">
        <div class="cc-title-row">
          <span class="cc-ai-badge">AI</span>
          <span class="cc-title">Copilot Incident</span>
          <span class="cc-model">Ollama · {{ modelName$ | async }}</span>
        </div>
        <button class="cc-clear" (click)="clearHistory()" [disabled]="messages.length === 0"
                title="Effacer l'historique">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 2l9 9M11 2L2 11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
 
      <!-- Messages -->
      <div class="cc-messages" #msgContainer>
        <!-- Quick questions (when empty) -->
        <div class="cc-quick" *ngIf="messages.length === 0">
          <p class="ccq-hint">Questions rapides :</p>
          <button class="ccq-btn" *ngFor="let q of quickQuestions" (click)="sendQuestion(q)">
            {{ q }}
          </button>
        </div>
 
        <div class="cc-msg" *ngFor="let m of messages; trackBy: trackByIdx"
             [ngClass]="'msg-' + m.role" [class.msg-loading]="m.loading">
          <div class="msg-avatar" [ngClass]="m.role === 'user' ? 'avatar-user' : 'avatar-ai'">
            <span *ngIf="m.role === 'user'">{{ userInitial }}</span>
            <span *ngIf="m.role === 'assistant'">AI</span>
          </div>
          <div class="msg-bubble">
            <div class="msg-content">
              <!-- Loading dots -->
              <div class="msg-dots" *ngIf="m.loading">
                <span></span><span></span><span></span>
              </div>
              <span *ngIf="!m.loading">{{ m.content }}</span>
            </div>
            <div class="msg-meta" *ngIf="!m.loading && m.source">
              <span>{{ m.source }}</span>
              <span>{{ m.timestamp | date:'HH:mm' }}</span>
            </div>
          </div>
        </div>
      </div>
 
      <!-- Input -->
      <div class="cc-input-row">
        <input class="cc-input" [(ngModel)]="inputText" placeholder="Posez votre question…"
               (keydown.enter)="sendQuestion(inputText)" [disabled]="isAsking"/>
        <button class="cc-send" (click)="sendQuestion(inputText)"
                [disabled]="!inputText.trim() || isAsking">
          <svg *ngIf="!isAsking" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 7l11-5-5 11-2-4L1 7z" fill="currentColor"/>
          </svg>
          <svg *ngIf="isAsking" class="spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,.3)" stroke-width="2"/>
            <path d="M7 1.5a5.5 5.5 0 015.5 5.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .copilot-chat { display:flex; flex-direction:column;
      background:var(--bg-card); border:1px solid var(--border-subtle);
      border-radius:12px; overflow:hidden; height:420px; }
    .cc-header { display:flex; align-items:center; justify-content:space-between;
      padding:10px 14px; border-bottom:1px solid var(--border-subtle);
      background:var(--bg-card); flex-shrink:0; }
    .cc-title-row { display:flex; align-items:center; gap:7px; }
    .cc-ai-badge { padding:2px 6px; border-radius:5px; font-size:9px; font-weight:800;
      letter-spacing:.1em; background:linear-gradient(135deg,#a78bfa,#6366f1); color:#fff; }
    .cc-title { font-size:13px; font-weight:600; color:var(--text-primary); }
    .cc-model { font-size:10px; color:var(--text-faint); }
    .cc-clear { background:none; border:none; cursor:pointer; color:var(--text-muted);
      padding:4px; border-radius:5px; &:hover { background:var(--bg-hover); }
      &:disabled { opacity:.3; cursor:default; } }
 
    .cc-messages { flex:1; overflow-y:auto; padding:12px 14px;
      display:flex; flex-direction:column; gap:10px;
      scrollbar-width:thin; scrollbar-color:var(--border-subtle) transparent; }
 
    .cc-quick { display:flex; flex-direction:column; gap:6px; }
    .ccq-hint { margin:0 0 4px; font-size:11px; color:var(--text-faint); }
    .ccq-btn { padding:7px 12px; border-radius:8px; border:1px solid var(--border-subtle);
      background:transparent; color:var(--text-secondary); font-size:12px;
      cursor:pointer; text-align:left; transition:all 150ms;
      &:hover { background:var(--bg-hover); color:var(--text-primary); border-color:var(--border-default); }
    }
 
    .cc-msg { display:flex; gap:8px; animation:msg-in 200ms ease-out; }
    @keyframes msg-in { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
    .msg-user      { flex-direction:row-reverse; }
    .msg-user .msg-bubble { background:var(--accent); }
    .msg-user .msg-content { color:#fff; }
    .msg-user .msg-meta    { color:rgba(255,255,255,.6); }
    .msg-assistant .msg-bubble { background:var(--bg-hover); }
    .msg-assistant .msg-content { color:var(--text-secondary); }
 
    .msg-avatar { width:28px; height:28px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:10px; font-weight:700; flex-shrink:0; }
    .avatar-user { background:var(--accent); color:#fff; }
    .avatar-ai   { background:linear-gradient(135deg,#a78bfa,#6366f1); color:#fff; font-size:9px; }
 
    .msg-bubble { padding:8px 12px; border-radius:10px; max-width:85%; }
    .msg-user .msg-bubble { border-bottom-right-radius:3px; }
    .msg-assistant .msg-bubble { border-bottom-left-radius:3px; }
    .msg-content { font-size:12px; line-height:1.6; }
    .msg-meta { display:flex; gap:6px; font-size:10px; color:var(--text-faint); margin-top:3px; }
 
    .msg-dots { display:flex; gap:4px; align-items:center; padding:2px 0; }
    .msg-dots span {
      width:6px; height:6px; border-radius:50%; background:var(--text-muted);
      animation:dot-bounce .8s ease-in-out infinite;
    }
    .msg-dots span:nth-child(2) { animation-delay:.15s; }
    .msg-dots span:nth-child(3) { animation-delay:.3s; }
    @keyframes dot-bounce { 0%,80%,100%{transform:scale(0.8)} 40%{transform:scale(1.2)} }
 
    .cc-input-row { display:flex; gap:8px; padding:10px 12px;
      border-top:1px solid var(--border-subtle); flex-shrink:0; }
    .cc-input { flex:1; padding:8px 12px; border-radius:8px;
      border:1px solid var(--border-subtle); background:var(--bg-input);
      color:var(--text-primary); font-size:13px; outline:none;
      &:focus { border-color:var(--accent); }
      &::placeholder { color:var(--text-faint); }
    }
    .cc-send { width:36px; height:36px; border-radius:8px; border:none;
      background:var(--accent); color:#fff; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      transition:opacity 150ms;
      &:hover { opacity:.88; }
      &:disabled { opacity:.45; cursor:not-allowed; }
    }
    .spin { animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `],
})
export class CopilotChatComponent {
  @Input()  incidentId?: string;
  @Input()  userInitial = 'U';
 
  messages:      ChatMessage[] = [];
  inputText      = '';
  isAsking       = false;
  quickQuestions = QUICK_QUESTIONS;

  constructor(private copilot: CopilotService, private cdr: ChangeDetectorRef) {}

  get modelName$() {
    return this.copilot.modelName$;
  }
 
  sendQuestion(q: string): void {
    const text = q?.trim();
    if (!text || this.isAsking) return;
 
    this.inputText = '';
    this.messages.push({ role: 'user', content: text, timestamp: new Date() });
    const loadingMsg: ChatMessage = { role: 'assistant', content: '', loading: true, timestamp: new Date() };
    this.messages.push(loadingMsg);
    this.isAsking = true;
    this.cdr.markForCheck();
 
    this.copilot.ask(text, this.incidentId).subscribe({
      next: r => {
        loadingMsg.loading = false;
        loadingMsg.content = r.answer;
        loadingMsg.source  = `${r.source}${r.from_cache ? ' · cached' : ''}`;
        this.isAsking = false;
        this.cdr.markForCheck();
      },
      error: () => {
        loadingMsg.loading = false;
        loadingMsg.content = 'Erreur lors de la communication avec le copilote.';
        this.isAsking = false;
        this.cdr.markForCheck();
      },
    });
  }
 
  clearHistory(): void { this.messages = []; this.cdr.markForCheck(); }
  trackByIdx = (i: number) => i;
}