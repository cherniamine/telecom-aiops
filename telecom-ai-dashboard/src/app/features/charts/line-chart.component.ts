import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';

// ── line-chart.component.ts ───────────────────────────────────────────────────
@Component({
  selector:   'app-line-chart',
  standalone: true,
  imports:    [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas></canvas>`,
  styles: [`:host { display:block; position:relative; } canvas { width:100% !important; }`],
})
export class LineChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() labels:      string[]   = [];
  @Input() datasets:    { label: string; data: number[]; color: string }[] = [];
  @Input() height       = 220;
  @Input() fill          = false;
 
  private chart: any;
 
  async ngAfterViewInit(): Promise<void> {
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
 
    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'line',
      data: {
        labels: this.labels,
        datasets: this.datasets.map(d => ({
          label:           d.label,
          data:            d.data,
          borderColor:     d.color,
          backgroundColor: this.fill ? d.color + '20' : 'transparent',
          borderWidth:     2,
          tension:         0.35,
          pointRadius:     3,
          pointHoverRadius: 5,
          fill:            this.fill,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { size: 11 }, boxWidth: 10 } },
        },
        scales: {
          x: { ticks: { color: textColor, font: { size: 11 } },
               grid: { color: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)' } },
          y: { ticks: { color: textColor, font: { size: 11 } },
               grid: { color: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)' } },
        },
      },
    });
    this.canvasRef.nativeElement.parentElement!.style.height = this.height + 'px';
  }
 
  ngOnDestroy(): void { this.chart?.destroy(); }
}