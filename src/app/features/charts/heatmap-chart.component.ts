import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input, OnChanges } from "@angular/core";

// ── heatmap-chart.component.ts ────────────────────────────────────────────────
@Component({
  selector:   'app-heatmap-chart',
  standalone: true,
  imports:    [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="heatmap">
      <div class="hm-row" *ngFor="let row of heatmapData">
        <span class="hm-label">{{ row.platform }}</span>
        <div class="hm-cells">
          <div class="hm-cell"
               *ngFor="let cell of row.cells"
               [style.background]="getCellColor(cell.value, row.max)"
               [title]="cell.label + ': ' + cell.value"
               [class.hm-empty]="cell.value === 0">
          </div>
        </div>
        <span class="hm-total">{{ row.total | number }}</span>
      </div>
      <div class="hm-legend">
        <span>Peu</span>
        <div class="hm-gradient"></div>
        <span>Beaucoup</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .heatmap { display:flex; flex-direction:column; gap:6px; }
    .hm-row   { display:flex; align-items:center; gap:8px; }
    .hm-label { font-family:var(--font-mono); font-size:11px; font-weight:600;
      color:var(--text-primary); min-width:50px; }
    .hm-cells { display:flex; gap:2px; flex:1; }
    .hm-cell  { flex:1; height:20px; border-radius:3px; transition:transform 150ms;
      cursor:default; min-width:4px; }
    .hm-cell:hover { transform:scaleY(1.2); }
    .hm-empty { background:var(--border-subtle) !important; }
    .hm-total { font-family:var(--font-mono); font-size:11px; color:var(--text-muted); min-width:60px; text-align:right; }
    .hm-legend { display:flex; align-items:center; gap:6px; margin-top:4px; font-size:10px; color:var(--text-faint); }
    .hm-gradient { flex:1; height:5px; border-radius:3px;
      background:linear-gradient(90deg, rgba(14,165,233,.1), #0ea5e9); }
  `],
})
export class HeatmapChartComponent implements OnChanges {
  @Input() platforms: string[]                       = [];
  @Input() data:      { platform: string; count: number }[] = [];
  @Input() segments  = 20;
 
  heatmapData: { platform: string; cells: { value: number; label: string }[]; max: number; total: number }[] = [];
 
  ngOnChanges(): void {
    this.heatmapData = (this.data ?? []).map(d => ({
      platform: d.platform,
      total:    d.count,
      max:      d.count,
      cells:    Array.from({ length: this.segments }, (_, i) => ({
        value: Math.floor(d.count / this.segments) + (i < d.count % this.segments ? 1 : 0),
        label: `Segment ${i + 1}`,
      })),
    }));
  }
 
  getCellColor(value: number, max: number): string {
    if (!value || !max) return 'transparent';
    const intensity = value / max;
    return `rgba(14,165,233,${(intensity * 0.8 + 0.1).toFixed(2)})`;
  }
}
 