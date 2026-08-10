// ═══════════════════════════════════════════════════════════════════════════════
// topology-graph.component.ts
// Graphe de dépendances SVG interactif — MMG / SMSC / SMPPS / SMPPC / DMC
// Liens causaux pondérés + root platform highlight + propagation animation
// ═══════════════════════════════════════════════════════════════════════════════
import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges,
  ChangeDetectionStrategy,
  ElementRef, ViewChild, AfterViewInit,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { FormsModule } from '@angular/forms';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TopoNode {
  id:         string;   // e.g. "MMG"
  label:      string;
  x:          number;
  y:          number;
  status:     'root' | 'affected' | 'ok' | 'unknown';
  anomalies?: number;
  recovery?:  number;   // minutes
}

export interface TopoEdge {
  source:    string;
  target:    string;
  weight:    number;    // 0..1 — link strength
  causal:    boolean;
}

// ── Platform metadata ─────────────────────────────────────────────────────────

const PLATFORM_META: Record<string, {
  color:  string;
  light:  string;
  desc:   string;
  deps:   string[];
}> = {
  MMG:   { color:'#d97706', light:'rgba(245,158,11,.18)', desc:'Mobile Messaging Gateway',     deps:['SMSC','DMC'] },
  SMSC:  { color:'#dc2626', light:'rgba(239,68,68,.18)',  desc:'Short Message Service Center',  deps:['SMPPS','SMPPC'] },
  SMPPS: { color:'#2563eb', light:'rgba(59,130,246,.18)', desc:'SMPP Server (entrées)',         deps:['SMSC'] },
  SMPPC: { color:'#4f46e5', light:'rgba(99,102,241,.18)', desc:'SMPP Client (sorties)',         deps:['SMSC'] },
  DMC:   { color:'#16a34a', light:'rgba(34,197,94,.18)',  desc:'Digital Messaging Core',        deps:['MMG'] },
};

// ── Fixed positions in a 520×300 SVG canvas ──────────────────────────────────
//
//           MMG(260,60)
//          /           \
//     SMSC(130,160)   DMC(390,160)
//    /          \
// SMPPS(70,270) SMPPC(200,270)
//
const POSITIONS: Record<string, { x: number; y: number }> = {
  MMG:   { x: 260, y:  60 },
  SMSC:  { x: 130, y: 160 },
  DMC:   { x: 390, y: 160 },
  SMPPS: { x:  70, y: 270 },
  SMPPC: { x: 200, y: 270 },
};

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector:   'app-topology-graph',
  standalone: true,
  imports:    [CommonModule,FormsModule ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [NO_ERRORS_SCHEMA],
  animations: [ 
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-6px) scale(0.97)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-6px) scale(0.97)' }))
      ])
    ])
  ],
  template: `
    <div class="topo-wrap" [style.height]="height + 'px'">

      <!-- SVG graph -->
      <svg #svgEl class="topo-svg" viewBox="0 0 520 320"
           role="img" aria-label="Graphe de dépendances des plateformes">

        <defs>
          <!-- Arrow markers -->
          <marker id="arrow-causal" viewBox="0 0 10 10" refX="8" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 2L8 5L2 8" fill="none" stroke="#ef4444"
                  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </marker>
          <marker id="arrow-dep" viewBox="0 0 10 10" refX="8" refY="5"
                  markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M2 2L8 5L2 8" fill="none" stroke="#94a3b8"
                  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </marker>

          <!-- Glow filter for root platform -->
          <filter id="glow-root" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <!-- Pulse animation gradient -->
          <radialGradient id="pulse-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stop-color="#ef4444" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
          </radialGradient>
        </defs>

        <!-- ── Edges ────────────────────────────────────── -->
        <g class="edges-layer">
          <g *ngFor="let edge of visibleEdges" class="edge-group">

            <!-- Dependency line (background) -->
            <line
              [attr.x1]="getNode(edge.source)?.x"
              [attr.y1]="getNode(edge.source)?.y"
              [attr.x2]="getEdgeEnd(edge).x"
              [attr.y2]="getEdgeEnd(edge).y"
              [attr.stroke]="edge.causal ? '#ef4444' : '#334155'"
              [attr.stroke-width]="edge.causal ? 2 : 1"
              [attr.stroke-opacity]="edge.causal ? 0.7 : 0.25"
              [attr.stroke-dasharray]="edge.causal ? '0' : '5 4'"
              [attr.marker-end]="edge.causal ? 'url(#arrow-causal)' : 'url(#arrow-dep)'"
              stroke-linecap="round"/>

            <!-- Flow animation on causal edges -->
            <line *ngIf="edge.causal && animating"
              class="flow-line"
              [attr.x1]="getNode(edge.source)?.x"
              [attr.y1]="getNode(edge.source)?.y"
              [attr.x2]="getEdgeEnd(edge).x"
              [attr.y2]="getEdgeEnd(edge).y"
              stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"
              stroke-dasharray="8 40" opacity="0.6"/>

            <!-- Weight label on causal edges -->
            <text *ngIf="edge.causal && showWeights"
              [attr.x]="getEdgeMid(edge).x"
              [attr.y]="getEdgeMid(edge).y - 6"
              text-anchor="middle"
              font-size="9"
              font-family="DM Mono, monospace"
              fill="#ef4444"
              opacity="0.8">
              {{ (edge.weight * 100).toFixed(0) }}%
            </text>

          </g>
        </g>

        <!-- ── Nodes ────────────────────────────────────── -->
        <g class="nodes-layer">
          <g *ngFor="let node of nodes"
             class="node-group"
             [class.node-clickable]="true"
             (click)="onNodeClick(node)"
             [attr.transform]="'translate(' + node.x + ',' + node.y + ')'">

            <!-- Pulse ring for root/affected -->
            <circle *ngIf="node.status === 'root' || node.status === 'affected'"
              class="pulse-ring"
              r="34" fill="none"
              [attr.stroke]="getPlatformColor(node.id)"
              stroke-width="1"
              opacity="0.3"/>

            <!-- Outer glow for root -->
            <circle *ngIf="node.status === 'root'"
              r="28"
              [attr.fill]="getPlatformLight(node.id)"
              filter="url(#glow-root)"
              opacity="0.6"/>

            <!-- Main circle -->
            <circle
              r="26"
              [attr.fill]="getNodeFill(node)"
              [attr.stroke]="getPlatformColor(node.id)"
              [attr.stroke-width]="node.status === 'root' ? 2.5 : node.status === 'affected' ? 2 : 1.2"
              [attr.stroke-opacity]="node.status === 'ok' || node.status === 'unknown' ? 0.35 : 0.9"/>

            <!-- Platform label -->
            <text
              text-anchor="middle"
              dominant-baseline="central"
              dy="-3"
              font-family="DM Mono, monospace"
              font-size="11"
              font-weight="700"
              letter-spacing="0.04em"
              [attr.fill]="getPlatformColor(node.id)"
              [attr.opacity]="node.status === 'ok' ? 0.5 : 1">
              {{ node.id }}
            </text>

            <!-- Status sub-label -->
            <text
              text-anchor="middle"
              dominant-baseline="central"
              dy="10"
              font-family="DM Mono, monospace"
              font-size="8"
              [attr.fill]="getStatusColor(node.status)"
              opacity="0.85">
              {{ getStatusLabel(node.status) }}
            </text>

            <!-- Root crown indicator -->
            <text *ngIf="node.status === 'root'"
              text-anchor="middle" y="-38"
              font-size="14">
              ⚠
            </text>

            <!-- Anomaly count badge -->
            <g *ngIf="node.anomalies && node.anomalies > 0" transform="translate(18,-18)">
              <circle r="9" fill="#ef4444" stroke="var(--bg-card,#fff)" stroke-width="1.5"/>
              <text text-anchor="middle" dominant-baseline="central"
                    font-size="8" font-weight="700" fill="white"
                    font-family="DM Mono, monospace">
                {{ node.anomalies > 99 ? '99+' : node.anomalies }}
              </text>
            </g>

          </g>
        </g>

      </svg>

      <!-- ── Selected node panel ────────────────────── -->
      <div class="node-panel" *ngIf="selectedNode" [@slideIn]>
        <div class="np-header">
          <span class="np-name" [style.color]="getPlatformColor(selectedNode.id)">
            {{ selectedNode.id }}
          </span>
          <span class="np-status" [ngClass]="'nps-' + selectedNode.status">
            {{ getStatusLabel(selectedNode.status) }}
          </span>
          <button class="np-close" (click)="selectedNode = null">✕</button>
        </div>
        <div class="np-body">
          <p class="np-desc">{{ getPlatformDesc(selectedNode.id) }}</p>
          <div class="np-stats" *ngIf="selectedNode.anomalies !== undefined">
            <div class="nps-item">
              <span class="nps-val">{{ selectedNode.anomalies }}</span>
              <span class="nps-lbl">anomalies</span>
            </div>
            <div class="nps-item" *ngIf="selectedNode.recovery">
              <span class="nps-val">~{{ selectedNode.recovery }}min</span>
              <span class="nps-lbl">récupération</span>
            </div>
          </div>
          <div class="np-deps">
            <span class="npd-label">Dépendances :</span>
            <span class="npd-chip" *ngFor="let d of getPlatformDeps(selectedNode.id)">{{ d }}</span>
          </div>
        </div>
      </div>
       
      <!-- ── Legend ─────────────────────────────────── -->
      <div class="topo-legend" style="margin-top: 10px;">
        <div class="tl-item">
          <svg width="28" height="8" viewBox="0 0 28 8">
            <line x1="0" y1="4" x2="28" y2="4" stroke="#ef4444" stroke-width="2"/>
            <path d="M22 1l4 3-4 3" fill="none" stroke="#ef4444" stroke-width="1.5"/>
          </svg>
          <span>Lien causal</span>
        </div>
        <div class="tl-item">
          <svg width="28" height="8" viewBox="0 0 28 8">
            <line x1="0" y1="4" x2="24" y2="4" stroke="#334155" stroke-width="1"
                  stroke-dasharray="4 3" opacity="0.5"/>
          </svg>
          <span>Dépendance</span>
        </div>
        <div class="tl-item">
          <circle r="5" fill="rgba(81, 76, 76, 0.2)" stroke="#ef4444" stroke-width="1.5"/>
          <span>Root / Affecté</span>
        </div>
        <button class="tl-toggle" (click)="showWeights = !showWeights">
          {{ showWeights ? 'Masquer' : 'Afficher' }} les poids
        </button>
        <button class="tl-animate" (click)="animating = !animating">
          {{ animating ? '⏸' : '▶' }} Flux
        </button>
      </div>

    </div>
  `,
  styles: [`
    :host { display:block; }

    .topo-wrap {
      position:relative;
      background:var(--bg-card);
      border-radius:10px;
      overflow:hidden;
    }

    .topo-svg {
      width:100%;
      height:90%;
      
    }

    /* Node hover */
    .node-group {
      cursor:pointer;
      transition:opacity 150ms;
    }
    .node-group:hover { opacity:.88; }
    .node-group:hover circle:not(.pulse-ring) {
      filter:brightness(1.1);
    }

    /* Pulse ring animation */
    .pulse-ring {
      animation:ring-pulse 2.5s ease-in-out infinite;
      transform-origin:center;
    }
    @keyframes ring-pulse {
      0%,100% { transform:scale(1); opacity:.3; }
      50%      { transform:scale(1.3); opacity:.06; }
    }

    /* Flow line animation */
    .flow-line {
      stroke-dashoffset:0;
      animation:flow-anim 1.4s linear infinite;
    }
    @keyframes flow-anim {
      from { stroke-dashoffset:0; }
      to   { stroke-dashoffset:-48; }
    }

    /* ── Node info panel ────────────────────────────── */
    .node-panel {
      position:absolute;
      top:10px; right:10px;
      width:200px;
      background:var(--bg-card);
      border:1px solid var(--border-subtle);
      border-radius:10px;
      box-shadow:0 8px 24px rgba(0,0,0,.15);
      animation:panel-in 180ms ease-out;
    }
    @keyframes panel-in {
      from { opacity:0; transform:translateY(-6px) scale(.97); }
      to   { opacity:1; transform:none; }
    }
    .np-header {
      display:flex; align-items:center; gap:7px;
      padding:10px 12px 6px;
      border-bottom:1px solid var(--border-subtle);
    }
    .np-name   { font-family:var(--font-mono); font-size:14px; font-weight:700; flex:1; }
    .np-status { font-size:10px; padding:2px 6px; border-radius:4px;
      font-weight:700; text-transform:uppercase; letter-spacing:.04em; }
    .nps-root     { background:rgba(239,68,68,.12);  color:#dc2626; }
    .nps-affected { background:rgba(245,158,11,.12); color:#d97706; }
    .nps-ok       { background:rgba(34,197,94,.1);   color:#16a34a; }
    .nps-unknown  { background:rgba(148,163,184,.1); color:#64748b; }
    .np-close {
      background:none; border:none; cursor:pointer;
      color:var(--text-muted); font-size:12px; padding:0;
      &:hover { color:var(--text-primary); }
    }
    .np-body { padding:8px 12px 12px; display:flex; flex-direction:column; gap:8px; }
    .np-desc { margin:0; font-size:11px; color:var(--text-muted); line-height:1.5; }
    .np-stats { display:flex; gap:12px; }
    .nps-item { display:flex; flex-direction:column; gap:1px; }
    .nps-val  { font-family:var(--font-mono); font-size:14px; font-weight:700;
      color:var(--text-primary); }
    .nps-lbl  { font-size:9px; color:var(--text-faint); letter-spacing:.04em; }
    .np-deps  { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
    .npd-label { font-size:10px; color:var(--text-faint); }
    .npd-chip  { font-size:10px; padding:1px 6px; border-radius:3px;
      background:var(--bg-hover); color:var(--text-muted);
      font-family:var(--font-mono); font-weight:600; border:1px solid var(--border-subtle); }

    /* ── Legend ─────────────────────────────────────── */
    .topo-legend {
      position:relative; top:-5px; left:10px;
      display:flex; align-items:center; gap:12px; flex-wrap:wrap;
    
    }
    .tl-item {
      display:flex; align-items:center; gap:5px;
      font-size:10px; color:var(--text-faint);
      svg { flex-shrink:0; overflow:visible; }
      circle { display:block; }
    }
    .tl-toggle, .tl-animate {
      font-size:10px; padding:2px 8px; border-radius:4px;
      border:1px solid var(--border-subtle); background:transparent;
      color:var(--text-muted); cursor:pointer; transition:all 150ms;
      &:hover { background:var(--bg-hover); color:var(--text-primary); }
    }
  `],
})
export class TopologyGraphComponent implements OnChanges {
  @Input() affectedPlatforms: string[] = [];
  @Input() rootPlatform?:     string;
  @Input() causalLinks:       { source: string; target: string; weight: number }[] = [];
  @Input() platformAnomalies: Record<string, number> = {};
  @Input() height             = 320;
  @Output() platformSelected  = new EventEmitter<string>();

  nodes:        TopoNode[] = [];
  visibleEdges: TopoEdge[] = [];
  selectedNode: TopoNode | null = null;
  showWeights   = false;
  animating     = true;

  readonly allPlatforms = ['MMG','SMSC','SMPPS','SMPPC','DMC'];

  ngOnChanges(): void {
    this.buildGraph();
  }

  private buildGraph(): void {
    // ── Nodes ──────────────────────────────────────────────────────────────
    this.nodes = this.allPlatforms.map(id => {
      const pos = POSITIONS[id] ?? { x: 260, y: 160 };
      let status: TopoNode['status'] = 'ok';
      if (id === this.rootPlatform)                    status = 'root';
      else if (this.affectedPlatforms.includes(id))    status = 'affected';
      return {
        id, label: id,
        x: pos.x, y: pos.y,
        status,
        anomalies: this.platformAnomalies[id] ?? 0,
        recovery:  PLATFORM_META[id]?.deps?.length ? PLATFORM_META[id].deps.length * 15 : 30,
      };
    });

    // ── Edges ───────────────────────────────────────────────────────────────
    const edges: TopoEdge[] = [];

    // Default dependency edges from platform metadata
    this.allPlatforms.forEach(id => {
      (PLATFORM_META[id]?.deps ?? []).forEach(dep => {
        edges.push({ source: id, target: dep, weight: 0.3, causal: false });
      });
    });

    // Causal links from analysis (override/add)
    (this.causalLinks ?? []).forEach(link => {
      const existing = edges.find(e => e.source === link.source && e.target === link.target);
      if (existing) {
        existing.causal = true;
        existing.weight = link.weight;
      } else {
        edges.push({ ...link, causal: true });
      }
    });

    // If no causal links provided but we have root + affected, infer
    if (!this.causalLinks?.length && this.rootPlatform && this.affectedPlatforms.length) {
      const root = this.rootPlatform;
      this.affectedPlatforms.filter(p => p !== root).forEach(target => {
        const existing = edges.find(e => e.source === root && e.target === target);
        if (existing) { existing.causal = true; existing.weight = 0.7; }
        else edges.push({ source: root, target, weight: 0.7, causal: true });
      });
    }

    this.visibleEdges = edges;
  }

  // ── Node helpers ──────────────────────────────────────────────────────────

  getNode(id: string): TopoNode | undefined {
    return this.nodes.find(n => n.id === id);
  }

  getNodeFill(node: TopoNode): string {
    if (node.status === 'root')     return PLATFORM_META[node.id]?.light ?? 'rgba(239,68,68,.15)';
    if (node.status === 'affected') return `${PLATFORM_META[node.id]?.light ?? 'rgba(245,158,11,.1)'}`;
    return 'var(--bg-card, #0f172a)';
  }

  getPlatformColor(id: string): string {
    return PLATFORM_META[id]?.color ?? '#64748b';
  }

  getPlatformLight(id: string): string {
    return PLATFORM_META[id]?.light ?? 'rgba(148,163,184,.1)';
  }

  getPlatformDesc(id: string): string {
    return PLATFORM_META[id]?.desc ?? id;
  }

  getPlatformDeps(id: string): string[] {
    return PLATFORM_META[id]?.deps ?? [];
  }

  getStatusLabel(status: TopoNode['status']): string {
    const map: Record<string, string> = {
      root: 'ROOT', affected: 'AFFECTED', ok: 'OK', unknown: '?',
    };
    return map[status] ?? status;
  }

  getStatusColor(status: TopoNode['status']): string {
    const map: Record<string, string> = {
      root:     '#ef4444',
      affected: '#f59e0b',
      ok:       '#22c55e',
      unknown:  '#94a3b8',
    };
    return map[status] ?? '#94a3b8';
  }

  // ── Edge helpers ──────────────────────────────────────────────────────────

  /** Edge endpoint: slightly before the target node center (offset by node radius) */
  getEdgeEnd(edge: TopoEdge): { x: number; y: number } {
    const src = this.getNode(edge.source);
    const tgt = this.getNode(edge.target);
    if (!src || !tgt) return { x: 0, y: 0 };
    const dx   = tgt.x - src.x;
    const dy   = tgt.y - src.y;
    const len  = Math.sqrt(dx * dx + dy * dy) || 1;
    const r    = 30; // node radius + gap
    return { x: tgt.x - (dx / len) * r, y: tgt.y - (dy / len) * r };
  }

  /** Midpoint of an edge for label placement */
  getEdgeMid(edge: TopoEdge): { x: number; y: number } {
    const src = this.getNode(edge.source);
    const tgt = this.getNode(edge.target);
    if (!src || !tgt) return { x: 0, y: 0 };
    return { x: (src.x + tgt.x) / 2, y: (src.y + tgt.y) / 2 };
  }

  onNodeClick(node: TopoNode): void {
    this.selectedNode = this.selectedNode?.id === node.id ? null : node;
    this.platformSelected.emit(node.id);
  }
}