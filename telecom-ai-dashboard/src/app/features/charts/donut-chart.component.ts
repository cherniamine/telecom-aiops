import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';

// ── donut-chart.component.ts ──────────────────────────────────────────────────
@Component({
  selector:   'app-donut-chart',
  standalone: true,
  imports:    [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut-wrap">
      <canvas #canvas></canvas>
      <div class="donut-center" *ngIf="centerLabel">
        <span class="dc-val">{{ centerValue }}</span>
        <span class="dc-lbl">{{ centerLabel }}</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .donut-wrap { position:relative; display:inline-flex; align-items:center; justify-content:center; }
    .donut-center { position:absolute; display:flex; flex-direction:column; align-items:center; gap:1px; }
    .dc-val { font-family:var(--font-mono); font-size:16px; font-weight:700; color:var(--text-primary); line-height:1; }
    .dc-lbl { font-size:10px; color:var(--text-muted); }
    canvas { display:block; }
  `],
})
export class DonutChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() labels:     string[] = [];
  @Input() data:       number[] = [];
  @Input() colors:     string[] = ['#0ea5e9','#22c55e','#f59e0b','#ef4444','#a78bfa'];
  @Input() size        = 160;
  @Input() centerLabel = '';
  @Input() centerValue = '';
 
  private chart: any;
 
  async ngAfterViewInit(): Promise<void> {
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);
    this.canvasRef.nativeElement.width  = this.size;
    this.canvasRef.nativeElement.height = this.size;
    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels:   this.labels,
        datasets: [{ data: this.data, backgroundColor: this.colors.map(c => c + 'cc'),
          borderColor: this.colors, borderWidth: 2, hoverOffset: 4 }],
      },
      options: {
        responsive: false, cutout: '68%',
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
      },
    });
  }
 
  ngOnDestroy(): void { this.chart?.destroy(); }
}
 