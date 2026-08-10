// ───────────────────────────────────────────────────────────────────────────────
// cascade-timeline.component.ts

import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { PlatformSvgComponent } from "@app/shared/components/platform-svg/platform-svg.component";

// ───────────────────────────────────────────────────────────────────────────────
@Component({
  selector:   'app-cascade-timeline',
  standalone: true,
  imports: [CommonModule, PlatformSvgComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ct" [class.ct-v]="dir==='vertical'">
      <ng-container *ngFor="let s of steps; let i=index; let last=last">
        <!-- Node -->
        <div class="ct-node" [ngClass]="nodeClass(i)" [style.animation-delay.ms]="i*130">
          <div class="ct-dot">
            <span class="ct-root-crown" *ngIf="i===rootIdx" title="Plateforme racine">👑</span>
            <span class="ct-pulse" *ngIf="nodeStatus(i)==='active'"></span>
            
            <!-- Afficher l'icône de la plateforme correspondante -->
            @switch (s.toUpperCase()) {
              @case ('MMG') {
                <app-platform-svg platform="MMG" [size]="20"/>
              }
              @case ('SMSC') {
                <app-platform-svg platform="SMSC" [size]="20"/>
              }
              @case ('SMPPS') {
                <app-platform-svg platform="SMPPS" [size]="20"/>
              }
              @case ('SMPPC') {
                <app-platform-svg platform="SMPPC" [size]="20"/>
              }
              @case ('DMC') {
                <app-platform-svg platform="DMC" [size]="20"/>
              }
              @default {
                <!-- Fallback: première lettre si plateforme inconnue -->
                <span style="font-size:12px; font-weight:bold;">{{ s.charAt(0) }}</span>
              }
            }
            
            <!-- Checkmark pour les étapes terminées -->
            <svg *ngIf="nodeStatus(i)==='done'" class="checkmark" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" stroke-width="1.5"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="ct-lbl" [ngClass]="'ctl-'+s.toLowerCase()">{{ s }}</span>
          <div class="ct-stat" *ngIf="stats?.[s]">
            <span>{{ stats?.[s]?.anomalies | number }}</span>
            <span class="ct-stat-lbl">anomalies</span>
          </div>
        </div>
        <!-- Connector -->
        <div class="ct-conn" *ngIf="!last" [ngClass]="connClass(i)">
          <div class="ct-track"><div class="ct-flow" [style.animation-delay.ms]="i*130+80"></div></div>
          <svg class="ct-arr" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path [attr.d]="dir==='vertical'?'M5 2v6M3 6l2 2 2-2':'M2 5h6M6 3l2 2-2 2'"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="ct-trigger" *ngIf="i===0 && trigger">{{ trigger }}</span>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .ct { display:flex; align-items:center; flex-wrap:wrap; gap:0; }
    .ct-v { flex-direction:column; align-items:flex-start; }
 
    .ct-node {
      display:flex; flex-direction:column; align-items:center; gap:4px;
      animation: ct-in 380ms ease-out both;
    }
    .ct-v .ct-node { flex-direction:row; gap:9px; }
    @keyframes ct-in { from{opacity:0;transform:scale(.65)} to{opacity:1;transform:scale(1)} }
 
    .ct-dot {
      width:30px; height:30px; border-radius:50%;
      border:2px solid var(--border-default); background:var(--bg-card);
      display:flex; align-items:center; justify-content:center;
      position:relative; transition:all 250ms;
    }
    .ct-node-done   .ct-dot { border-color:#22c55e; background:rgba(34,197,94,.1); color:#22c55e; }
    .ct-node-active .ct-dot { border-color:#ef4444; background:rgba(239,68,68,.08);
                               box-shadow:0 0 0 5px rgba(239,68,68,.12); }
    .ct-node-pending .ct-dot { opacity:.4; }
 
    .ct-root-crown { position:absolute; top:-10px; font-size:10px; }
 
    .ct-pulse {
      position:absolute; inset:-5px; border-radius:50%;
      border:2px solid #ef4444;
      animation: ct-pulse 1.4s ease-in-out infinite;
    }
    @keyframes ct-pulse { 0%{opacity:.9;transform:scale(1)} 100%{opacity:0;transform:scale(1.9)} }
 
    /* Positionner le checkmark par-dessus l'icône */
    .checkmark {
      position:absolute;
      bottom:-2px;
      right:-2px;
      background:var(--bg-card);
      border-radius:50%;
      padding:1px;
    }
 
    .ct-lbl { font-size:11px; font-weight:700; font-family:var(--font-mono); letter-spacing:.05em; }
    .ctl-mmg{color:#d97706} .ctl-smsc{color:#dc2626} .ctl-smpps{color:#2563eb}
    .ctl-smppc{color:#4f46e5} .ctl-dmc{color:#16a34a}
 
    .ct-stat { display:flex; flex-direction:column; align-items:center; gap:1px;
      font-family:var(--font-mono); font-size:10px; font-weight:600; color:var(--text-primary); }
    .ct-stat-lbl { font-size:8px; color:var(--text-faint); }
 
    .ct-conn { display:flex; align-items:center; padding:0 6px; color:var(--border-default); position:relative; }
    .ct-v .ct-conn { flex-direction:column; padding:3px 0 3px 15px; }
 
    .ct-track { flex:1; height:2px; min-width:20px; background:var(--border-subtle);
      border-radius:1px; overflow:hidden; position:relative; }
    .ct-v .ct-track { width:2px; height:20px; min-height:20px; flex:none; min-width:0; }
 
    .ct-flow {
      position:absolute; top:0; left:-100%; width:100%; height:100%;
      background:linear-gradient(90deg,transparent,currentColor 50%,transparent);
      animation: ct-flow 1.1s ease-in-out infinite both;
    }
    .ct-v .ct-flow { background:linear-gradient(180deg,transparent,currentColor 50%,transparent);
      animation:ct-flow-v 1.1s ease-in-out infinite both; }
    @keyframes ct-flow   { to{left:100%} }
    @keyframes ct-flow-v { from{top:-100%} to{top:100%} }
 
    .ct-conn-done   { color:#22c55e; }
    .ct-conn-active { color:#ef4444; }
    .ct-conn-pending { color:var(--border-subtle); .ct-flow{display:none} }
 
    .ct-arr { flex-shrink:0; }
    .ct-trigger {
      position:absolute; top:-16px; left:50%; transform:translateX(-50%);
      font-size:9px; font-weight:700; color:#ef4444;
      white-space:nowrap; font-family:var(--font-mono);
    }
  `],
})
export class CascadeTimelineComponent {
  @Input() steps:             string[]  = [];
  @Input() activeIndex        = -1;
  @Input() rootIdx            = 0;
  @Input() rootIndex?:        number;  // Alias for rootIdx
  @Input() trigger?:          string;
  @Input() summary?:          string;
  @Input() coherenceScore?:   number | null;
  @Input() dir:               'horizontal'|'vertical' = 'horizontal';
  @Input() stats?:            Record<string,{anomalies:number}>;
 
  nodeStatus(i:number):'done'|'active'|'pending' {
    if (this.activeIndex<0) return 'done';
    return i<this.activeIndex?'done':i===this.activeIndex?'active':'pending';
  }
  nodeClass(i:number): string { return 'ct-node-'+this.nodeStatus(i); }
  connClass(i:number): string {
    if (this.activeIndex<0) return 'ct-conn-done';
    return i<this.activeIndex?'ct-conn-done':i===this.activeIndex?'ct-conn-active':'ct-conn-pending';
  }
}