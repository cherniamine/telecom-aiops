import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-chart-card',
  templateUrl: './chart-card.component.html',
  styleUrl: './chart-card.component.css',
  standalone: false,
})
export class ChartCardComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
