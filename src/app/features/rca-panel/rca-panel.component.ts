// ═══════════════════════════════════════════════════════════════════════════════
// features/rca-panel/rca-panel.component.ts
// Causes racines bar chart + Cascade timeline + Topology Graph + Validation
// ═══════════════════════════════════════════════════════════════════════════════
import { CommonModule }          from '@angular/common';
import {
  ChangeDetectionStrategy, Component, Input, OnChanges,
} from '@angular/core';
import { CascadeTimelineComponent } from '../cascade-timeline/cascade-timeline.component';
import { TopologyGraphComponent }   from './topology-graph.component';

@Component({
  selector:   'app-rca-panel',
  standalone: true,
  imports:    [CommonModule, CascadeTimelineComponent, TopologyGraphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rca">

      <!-- ── Section 1 : Cascade de propagation ─────────────────────────── -->
      <div class="rca-card" *ngIf="cascadePath.length">
        <div class="rca-row">
          <span class="rca-sec">Propagation</span>
          <span class="rca-tag" *ngIf="topologyAware">🗺️ topology-aware</span>
          <span class="rca-tag rca-tag-root" *ngIf="rootPlatform">
            Root : {{ rootPlatform }}
          </span>
          <span class="rca-tag rca-tag-links">{{ causalLinks }} liens causaux</span>
          <span class="rca-tag rca-tag-coh" *ngIf="cascadeVal">
            {{ (cascadeVal.coherence_score * 100).toFixed(0) }}% cohérence
          </span>
        </div>
        <app-cascade-timeline
          [steps]="cascadePath"
          [activeIndex]="activeIndex"
          [rootIndex]="rootIdx"
          [trigger]="trigger"
          [coherenceScore]="cascadeVal?.coherence_score ?? null"
          [summary]="cascadeSummary"
          direction="horizontal"/>
      </div>

      <!-- ── Section 2 : Graphe + Causes racines (2 colonnes) ───────────── -->
      <div class="rca-two-col">

        <!-- Causes racines bar chart -->
        <div class="rca-card" *ngIf="topCauses.length">
          <div class="rca-row">
            <span class="rca-sec">Causes racines (top {{ topCauses.length }})</span>
            <span class="rca-count">{{ totalCount | number }} occurrences</span>
          </div>
          <div class="rca-bars">
            <div class="rca-bar-row"
                 *ngFor="let rc of topCauses; let i = index"
                 [style.animation-delay.ms]="i * 60">
              <span class="rbr-kw">{{ rc[0] }}</span>
              <div class="rbr-track">
                <div class="rbr-fill"
                     [style.width.%]="pct(rc[1])"
                     [style.background]="barColor(rc[0], i)">
                </div>
              </div>
              <span class="rbr-n">{{ rc[1] | number }}</span>
              <span class="rbr-p">{{ pct(rc[1]) | number:'1.1-1' }}%</span>
            </div>
          </div>

          <!-- Root platform analysis block -->
          <div class="root-analysis" *ngIf="rootPlatformAnalysis">
            <div class="ra-header">
              <span class="ra-label">Plateforme racine</span>
              <span class="ra-conf"
                    [ngClass]="rootPlatformAnalysis.confidence === 'HIGH' ? 'conf-high' : 'conf-med'">
                {{ rootPlatformAnalysis.confidence }}
              </span>
            </div>
            <div class="ra-platform">
              <span class="rap-name">{{ rootPlatformAnalysis.root_platform }}</span>
              <span class="rap-desc">{{ getPlatformDesc(rootPlatformAnalysis.root_platform) }}</span>
            </div>
            <div class="ra-candidates" *ngIf="rootPlatformAnalysis.candidates?.length">
              <div class="rac-item"
                   *ngFor="let c of rootPlatformAnalysis.candidates.slice(0, 4)">
                <span class="rac-name"
                      [class.rac-root]="c.platform === rootPlatformAnalysis.root_platform">
                  {{ c.platform }}
                </span>
                <span class="rac-crit" [ngClass]="'crit-' + c.criticality.toLowerCase()">
                  {{ c.criticality }}
                </span>
                <span class="rac-deps">{{ c.dependency_count }} dép.</span>
                <span class="rac-rec">~{{ c.recovery_minutes }}min</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Topology Graph ──────────────────────────────────────────── -->
        <div class="rca-card topo-card">
          <div class="rca-row">
            <span class="rca-sec">Graphe de dépendances</span>
            <span class="rca-tag" *ngIf="selectedPlatform">
              {{ selectedPlatform }} sélectionné
            </span>
          </div>
          <app-topology-graph
            [affectedPlatforms]="affectedPlatforms"
            [rootPlatform]="rootPlatform"
            [causalLinks]="topoCausalLinks"
            [platformAnomalies]="platformAnomaliesMap"
            [height]="260"
            (platformSelected)="onPlatformSelected($event)"/>
        </div>

      </div>

      <!-- ── Section 3 : Validation topologique ─────────────────────────── -->
      <div class="rca-card rca-validation"
           *ngIf="cascadeVal || cascadeValidation">
        <div class="rca-row">
          <span class="rca-sec">Validation topologie</span>
          <span class="cv-verdict"
                [ngClass]="verdictClass">
            {{ (cascadeVal ?? cascadeValidation)?.verdict ?? 'UNKNOWN' }}
          </span>
          <span class="cv-score"
                [ngClass]="coherenceClass">
            {{ ((cascadeVal ?? cascadeValidation)?.coherence_score * 100) | number:'1.0-0' }}%
            cohérence
          </span>
        </div>
        <div class="cv-steps-grid">
          <div class="cv-step"
               *ngFor="let s of (cascadeVal ?? cascadeValidation)?.steps"
               [class.cvs-ok]="s.valid"
               [class.cvs-fail]="!s.valid">
            <span class="cvs-icon">
  @if (s.valid) {
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#22c55e" fill-opacity="0.15" stroke="#22c55e" stroke-width="1.2"/>
      <path d="M5 8L7.5 10.5L11 5.5" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  } @else {
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#ef4444" fill-opacity="0.15" stroke="#ef4444" stroke-width="1.2"/>
      <path d="M5 5L11 11M11 5L5 11" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  }
</span>
            <span class="cvs-step">{{ s.step }}</span>
            <span class="cvs-reason">{{ s.reason }}</span>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host { display:block; }

    .rca { display:flex; flex-direction:column; gap:14px; }

    .rca-card {
      background:var(--bg-card);
      border:1px solid var(--border-subtle);
      border-radius:12px;
      padding:14px 16px;
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    /* 2-column layout for bar chart + topology */
    .rca-two-col {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:14px;
    }
    @media (max-width:900px) {
      .rca-two-col { grid-template-columns:1fr; }
    }

    .topo-card { padding:14px 16px 8px; }

    /* ── Row header ─────────────────────────────────── */
    .rca-row {
      display:flex; align-items:center; gap:7px; flex-wrap:wrap;
    }
    .rca-sec {
      font-size:11px; font-weight:700; letter-spacing:.09em;
      text-transform:uppercase; color:var(--text-muted);
    }
    .rca-count {
      font-size:11px; color:var(--text-faint);
      margin-left:auto; font-family:var(--font-mono);
    }
    .rca-tag {
      font-size:10px; padding:2px 7px; border-radius:4px;
      background:var(--bg-hover); color:var(--text-muted);
      border:1px solid var(--border-subtle);
    }
    .rca-tag-root  { background:rgba(245,158,11,.1); color:#d97706; border-color:rgba(245,158,11,.25); }
    .rca-tag-links { background:rgba(14,165,233,.08); color:var(--accent); border-color:rgba(14,165,233,.2); }
    .rca-tag-coh   { background:rgba(34,197,94,.08); color:#22c55e; border-color:rgba(34,197,94,.2); }

    /* ── Bar chart ──────────────────────────────────── */
    .rca-bars { display:flex; flex-direction:column; gap:7px; }
    .rca-bar-row {
      display:flex; align-items:center; gap:8px;
      animation:bar-row-in 350ms ease-out both;
    }
    @keyframes bar-row-in {
      from { opacity:0; transform:translateX(-6px); }
      to   { opacity:1; transform:none; }
    }
    .rbr-kw {
      font-family:var(--font-mono); font-size:12px; font-weight:600;
      color:var(--text-primary); min-width:88px;
    }
    .rbr-track {
      flex:1; height:7px; background:var(--border-subtle);
      border-radius:4px; overflow:hidden;
    }
    .rbr-fill {
      height:100%; border-radius:4px;
      transition:width .6s ease;
      animation:bar-in .55s ease-out both;
    }
    @keyframes bar-in { from { width:0 !important; } }
    .rbr-n {
      font-size:11px; color:var(--text-muted); font-family:var(--font-mono);
      min-width:66px; text-align:right;
    }
    .rbr-p { font-size:10px; color:var(--text-faint); min-width:40px; }

    /* ── Root platform analysis ─────────────────────── */
    .root-analysis {
      padding:10px 12px; border-radius:8px;
      background:rgba(14,165,233,.04);
      border:1px solid rgba(14,165,233,.15);
      display:flex; flex-direction:column; gap:7px;
    }
    .ra-header { display:flex; align-items:center; justify-content:space-between; }
    .ra-label  { font-size:10px; font-weight:700; letter-spacing:.08em;
      text-transform:uppercase; color:var(--text-muted); }
    .ra-conf   { font-size:10px; font-weight:700; padding:2px 7px; border-radius:4px; }
    .conf-high { background:rgba(34,197,94,.1);  color:#22c55e; }
    .conf-med  { background:rgba(245,158,11,.1); color:#f59e0b; }
    .ra-platform { display:flex; align-items:center; gap:10px; }
    .rap-name  { font-family:var(--font-mono); font-size:16px; font-weight:700; color:var(--accent); }
    .rap-desc  { font-size:11px; color:var(--text-muted); }
    .ra-candidates { display:flex; flex-direction:column; gap:4px; }
    .rac-item  {
      display:flex; align-items:center; gap:8px; font-size:11px;
      padding:3px 0; border-top:1px solid var(--border-subtle);
    }
    .rac-name  { font-family:var(--font-mono); font-weight:600;
      color:var(--text-secondary); min-width:50px; }
    .rac-root  { color:var(--accent) !important; }
    .rac-crit  { padding:1px 5px; border-radius:3px; font-size:10px; font-weight:700; }
    .crit-critical { background:rgba(239,68,68,.1); color:#dc2626; }
    .crit-high     { background:rgba(245,158,11,.1); color:#d97706; }
    .crit-medium   { background:rgba(59,130,246,.1); color:#2563eb; }
    .rac-deps,.rac-rec { color:var(--text-faint); font-size:10px; margin-left:auto; }
    .rac-rec { font-family:var(--font-mono); }

    /* ── Cascade validation ─────────────────────────── */
    .rca-validation { }
    .cv-verdict {
      font-size:10px; font-weight:800; padding:2px 8px;
      border-radius:4px; letter-spacing:.05em;
    }
    .cv-score {
      font-size:13px; font-weight:700; font-family:var(--font-mono);
    }
    .coh-ok   { color:#22c55e; }
    .coh-warn { color:#f59e0b; }
    .coh-fail { color:#ef4444; }
    .verd-ok   { background:rgba(34,197,94,.1);  color:#22c55e; }
    .verd-warn { background:rgba(245,158,11,.1); color:#f59e0b; }
    .verd-fail { background:rgba(239,68,68,.1);  color:#ef4444; }
    .cv-steps-grid { display:flex; flex-direction:column; gap:4px; }
    .cv-step {
      display:flex; align-items:center; gap:8px;
      font-size:11px; padding:3px 0;
      border-bottom:1px solid var(--border-subtle);
      &:last-child { border:none; }
    }
    .cvs-icon  { flex-shrink:0; font-size:12px; }
    .cvs-step  {
      font-family:var(--font-mono); font-weight:600; min-width:96px;
      color:var(--text-primary);
    }
    .cvs-ok .cvs-step   { color:#22c55e; }
    .cvs-fail .cvs-step { color:#ef4444; }
    .cvs-reason { color:var(--text-muted); line-height:1.4; }
  `],
})
export class RcaPanelComponent implements OnChanges {
  @Input() rootCauses:           [string, number][] = [];
  @Input() cascadePath:          string[]           = [];
  @Input() cascadeSummary        = '';
  @Input() activeIndex           = -1;
  @Input() rootPlatform?:        string;
  @Input() rootPlatformAnalysis?: any;
  @Input() rootIdx               = 0;
  @Input() trigger?:             string;
  @Input() topologyAware         = false;
  @Input() cascadeVal?:          any;
  @Input() cascadeValidation?:   any;   // alias for cascadeVal
  @Input() causalLinks           = 0;
  @Input() platformStats?:       Record<string, { anomalies: number }>;

  // Computed state
  topCauses:  [string, number][] = [];
  totalCount  = 0;
  maxCount    = 1;
  selectedPlatform = '';

  // Topology graph inputs (derived)
  affectedPlatforms:   string[]                              = [];
  topoCausalLinks:     { source: string; target: string; weight: number }[] = [];
  platformAnomaliesMap: Record<string, number>              = {};

  private readonly platformDescMap: Record<string, string> = {
    MMG:   'Mobile Messaging Gateway',
    SMSC:  'Short Message Service Center',
    SMPPS: 'SMPP Server (entrées)',
    SMPPC: 'SMPP Client (sorties)',
    DMC:   'Digital Messaging Core',
  };

  ngOnChanges(): void {
    // Bar chart
    this.topCauses  = (this.rootCauses ?? []).slice(0, 8);
    this.totalCount = this.topCauses.reduce((s, r) => s + Number(r[1]), 0);
    this.maxCount   = Number(this.topCauses[0]?.[1]) || 1;

    // Topology inputs
    this.affectedPlatforms = this.rootPlatformAnalysis?.candidates
      ?.map((c: any) => c.platform) ?? [];

    this.topoCausalLinks = this.rootPlatformAnalysis?.weighted_causal_links ?? [];

    // Build anomalies map from root causes (keyword = platform name heuristic)
    this.platformAnomaliesMap = {};
    const platforms = ['MMG','SMSC','SMPPS','SMPPC','DMC'];
    (this.rootCauses ?? []).forEach(([kw, count]) => {
      const upper = kw.toUpperCase();
      if (platforms.includes(upper)) {
        this.platformAnomaliesMap[upper] = Number(count);
      }
    });

    // Also inject from platformStats if provided
    if (this.platformStats) {
      Object.entries(this.platformStats).forEach(([p, s]) => {
        this.platformAnomaliesMap[p] = s.anomalies;
      });
    }
  }

  onPlatformSelected(platform: string): void {
    this.selectedPlatform = this.selectedPlatform === platform ? '' : platform;
  }

  pct(n: number): number {
    return (Number(n) / this.maxCount) * 100;
  }

  barColor(kw: string, i: number): string {
    const m: Record<string, string> = {
      fail: '#ef4444', error: '#f87171', timeout: '#f59e0b',
      retry: '#3b82f6', refused: '#6366f1', disconnect: '#a855f7',
      'queue full': '#f97316', drop: '#94a3b8',
    };
    const pal = ['#ef4444','#f59e0b','#3b82f6','#6366f1','#22c55e','#a855f7','#f97316','#94a3b8'];
    return m[(kw ?? '').toLowerCase()] ?? pal[i % pal.length];
  }

  getPlatformDesc(id: string): string {
    return this.platformDescMap[id?.toUpperCase()] ?? '';
  }

  get verdictClass(): string {
    const verdict = (this.cascadeVal ?? this.cascadeValidation)?.verdict ?? '';
    if (verdict.includes('VALID'))   return 'verd-ok';
    if (verdict.includes('PARTIAL')) return 'verd-warn';
    return 'verd-fail';
  }

  get coherenceClass(): string {
    const score = (this.cascadeVal ?? this.cascadeValidation)?.coherence_score ?? 0;
    return score >= 0.8 ? 'coh-ok' : score >= 0.5 ? 'coh-warn' : 'coh-fail';
  }
}