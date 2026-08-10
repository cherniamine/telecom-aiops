// ═══════════════════════════════════════════════════════════════════════════════
// CHARTS — Chart.js wrappers
// ═══════════════════════════════════════════════════════════════════════════════
 
// ── bar-chart.component.ts ────────────────────────────────────────────────────
import { AfterViewInit, ElementRef, ViewChild, OnDestroy, Component, ChangeDetectionStrategy, Input } from '@angular/core';
 
@Component({
  selector:   'app-bar-chart',
  standalone: true,
  imports:    [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas></canvas>`,
  styles: [`:host { display:block; position:relative; } canvas { width:100% !important; }`],
})
export class BarChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() labels:   string[]    = [];
  @Input() data:     number[]    = [];
  @Input() label     = 'Valeurs';
  @Input() color     = '#0ea5e9';
  @Input() height    = 200;
 
  private chart: any;
 
  async ngAfterViewInit(): Promise<void> {
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
 
    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'bar',
      data: {
        labels: this.labels,
        datasets: [{
          label: this.label,
          data:  this.data,
          backgroundColor: this.color + '80',
          borderColor:     this.color,
          borderWidth:     1.5,
          borderRadius:    4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor, font: { size: 11, family: 'DM Mono' } },
               grid: { color: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)' } },
          y: { ticks: { color: textColor, font: { size: 11 } },
               grid: { color: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)' } },
        },
      },
    });
    this.canvasRef.nativeElement.parentElement!.style.height = this.height + 'px';
  }
 
  ngOnDestroy(): void { this.chart?.destroy(); }
}