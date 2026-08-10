import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="app-icon"
      [style.width.px]="size"
      [style.height.px]="size"
      [style.--icon-stroke]="strokeWidth"
      [attr.aria-hidden]="decorative ? 'true' : null"
      [attr.aria-label]="decorative ? null : label">
      <svg viewBox="0 0 24 24" fill="none">
        <ng-container [ngSwitch]="normalizedName">
          <ng-container *ngSwitchCase="'menu'">
            <path d="M4 7h16"></path>
            <path d="M4 12h16"></path>
            <path d="M4 17h16"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'refresh'">
            <path d="M21 12a9 9 0 0 1-15.4 6.4"></path>
            <path d="M3 12a9 9 0 0 1 15.4-6.4"></path>
            <path d="M17 2.8v4.6h4.6"></path>
            <path d="M7 21.2v-4.6H2.4"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'activity'">
            <path d="M3 12h4l2.2-5 3.2 10 2.2-5H21"></path>
          </ng-container>

         <ng-container *ngSwitchCase="'hub'">
        <!-- Globe -->
        <circle cx="12" cy="12" r="10"
          fill="none" stroke="currentColor" stroke-width="1.5"/>

        <!-- Méridiens -->
        <ellipse cx="12" cy="12" rx="4" ry="10"
          fill="none" stroke="currentColor" stroke-width="0.9" opacity="0.6"/>
        <ellipse cx="12" cy="12" rx="8" ry="10"
          fill="none" stroke="currentColor" stroke-width="0.7" opacity="0.4"/>

        <!-- Parallèles -->
        <line x1="2"  y1="9"  x2="22" y2="9"
          stroke="currentColor" stroke-width="0.8" opacity="0.5"/>
        <line x1="2"  y1="12" x2="22" y2="12"
          stroke="currentColor" stroke-width="0.8" opacity="0.5"/>
        <line x1="2"  y1="15" x2="22" y2="15"
          stroke="currentColor" stroke-width="0.8" opacity="0.5"/>

        <!-- Nœud IA central -->
        <circle cx="12" cy="12" r="2.5"
          fill="currentColor"/>
        <circle cx="12" cy="12" r="4"
          fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>

        <!-- Ping points réseau -->
        <circle cx="7"  cy="8"  r="1.2"
          fill="none" stroke="currentColor" stroke-width="1"/>
        <circle cx="17" cy="9"  r="1.2"
          fill="none" stroke="currentColor" stroke-width="1"/>
        <circle cx="15" cy="16" r="1.2"
          fill="none" stroke="currentColor" stroke-width="1"/>

        <!-- Connexions vers centre -->
        <line x1="7"  y1="8"  x2="12" y2="12"
          stroke="currentColor" stroke-width="0.8" opacity="0.5"/>
        <line x1="17" y1="9"  x2="12" y2="12"
          stroke="currentColor" stroke-width="0.8" opacity="0.5"/>
        <line x1="15" y1="16" x2="12" y2="12"
          stroke="currentColor" stroke-width="0.8" opacity="0.5"/>
      </ng-container>

          <ng-container *ngSwitchCase="'close'">
            <path d="M6 6l12 12"></path>
            <path d="M18 6L6 18"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'chevron_right'">
            <path d="M9 6l6 6-6 6"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'chevron_left'">
            <path d="M15 6l-6 6 6 6"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'chevron_down'">
            <path d="M6 9l6 6 6-6"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'dashboard'">
            <rect x="3" y="3" width="8" height="8" rx="2"></rect>
            <rect x="13" y="3" width="8" height="5" rx="2"></rect>
            <rect x="13" y="10" width="8" height="11" rx="2"></rect>
            <rect x="3" y="13" width="8" height="8" rx="2"></rect>
          </ng-container>

          <ng-container *ngSwitchCase="'warning'">
            <path d="M12 4.2 20 19a1.4 1.4 0 0 1-1.2 2H5.2A1.4 1.4 0 0 1 4 19l8-14.8Z"></path>
            <path d="M12 9v4.8"></path>
            <path d="M12 17.2h.01"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'report'">
            <path d="M8 3h6l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"></path>
            <path d="M14 3v5h5"></path>
            <path d="M12 10v5"></path>
            <path d="M12 18h.01"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'notifications'">
            <path d="M7 10a5 5 0 0 1 10 0v4l1.6 2.1a1 1 0 0 1-.8 1.6H6.2a1 1 0 0 1-.8-1.6L7 14v-4"></path>
            <path d="M10 20a2 2 0 0 0 4 0"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'psychology'">
            <path d="M9 8a3 3 0 0 1 6 0c0 1.4-.7 2-1.5 2.7-.8.6-1.5 1.2-1.5 2.3"></path>
            <path d="M12 16h.01"></path>
            <path d="M8 5.5A7 7 0 1 0 16 18l2.4 2.4"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'timeline'">
            <circle cx="6" cy="18" r="2"></circle>
            <circle cx="12" cy="10" r="2"></circle>
            <circle cx="18" cy="6" r="2"></circle>
            <path d="M7.7 16.7 10.3 11.3"></path>
            <path d="M13.7 8.7 16.3 7.3"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'grid_on'">
            <rect x="4" y="4" width="6.5" height="6.5" rx="1.5"></rect>
            <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"></rect>
            <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"></rect>
            <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"></rect>
          </ng-container>

          <ng-container *ngSwitchCase="'crisis_alert'">
            <path d="M12 3 4 7v5c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10V7l-8-4Z"></path>
            <path d="M12 8.2v5.2"></path>
            <path d="M12 17h.01"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'schedule'">
            <circle cx="12" cy="12" r="8.5"></circle>
            <path d="M12 7.5v5l3.6 2.2"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'trending_up'">
            <path d="M4 16l5-5 3.5 3.5L20 7"></path>
            <path d="M15 7h5v5"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'trending_down'">
            <path d="M4 8l5 5 3.5-3.5L20 17"></path>
            <path d="M15 17h5v-5"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'build'">
            <path d="M14.5 6.5a3.5 3.5 0 0 0 4.8 4.8l-8.7 8.7a2 2 0 1 1-2.8-2.8l8.7-8.7a3.5 3.5 0 0 0-2-6.2Z"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'search'">
            <circle cx="11" cy="11" r="6.5"></circle>
            <path d="m16 16 4.2 4.2"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'description'">
            <path d="M8 3h6l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"></path>
            <path d="M14 3v5h5"></path>
            <path d="M9 12h6"></path>
            <path d="M9 16h6"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'bubble_chart'">
            <circle cx="8" cy="15" r="3.2"></circle>
            <circle cx="15.8" cy="8.2" r="2.8"></circle>
            <circle cx="17.2" cy="16.8" r="2.4"></circle>
          </ng-container>

          <ng-container *ngSwitchCase="'groups'">
            <circle cx="9" cy="10" r="3"></circle>
            <circle cx="16.5" cy="11.5" r="2.5"></circle>
            <path d="M4.5 18a4.5 4.5 0 0 1 9 0"></path>
            <path d="M13.5 18a3.5 3.5 0 0 1 7 0"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'check_circle'">
            <circle cx="12" cy="12" r="8.5"></circle>
            <path d="M8.5 12.2 11 14.7 15.8 9.9"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'zap'">
            <path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'database'">
            <ellipse cx="12" cy="6" rx="7" ry="3"></ellipse>
            <path d="M5 6v8c0 1.7 3.1 3 7 3s7-1.3 7-3V6"></path>
            <path d="M5 10c0 1.7 3.1 3 7 3s7-1.3 7-3"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'server'">
            <rect x="4" y="4" width="16" height="6" rx="1.8"></rect>
            <rect x="4" y="14" width="16" height="6" rx="1.8"></rect>
            <path d="M8 7h.01"></path>
            <path d="M8 17h.01"></path>
            <path d="M12 7h5"></path>
            <path d="M12 17h5"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'target'">
            <circle cx="12" cy="12" r="8.5"></circle>
            <circle cx="12" cy="12" r="4.5"></circle>
            <circle cx="12" cy="12" r="1.5"></circle>
          </ng-container>

          <ng-container *ngSwitchCase="'download'">
            <path d="M12 4v10"></path>
            <path d="m8 10 4 4 4-4"></path>
            <path d="M5 19h14"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'layers'">
            <path d="m12 4 8 4-8 4-8-4 8-4Z"></path>
            <path d="m20 12-8 4-8-4"></path>
            <path d="m20 16-8 4-8-4"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'arrow_down'">
            <path d="M12 5v14"></path>
            <path d="m7 14 5 5 5-5"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'bar_chart'">
            <path d="M5 19V11"></path>
            <path d="M12 19V7"></path>
            <path d="M19 19V4"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'list'">
            <path d="M8 7h11"></path>
            <path d="M8 12h11"></path>
            <path d="M8 17h11"></path>
            <path d="M4 7h.01"></path>
            <path d="M4 12h.01"></path>
            <path d="M4 17h.01"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'eye'">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
            <circle cx="12" cy="12" r="2.5"></circle>
          </ng-container>

          <ng-container *ngSwitchCase="'check'">
            <path d="M5 12.5 9 16.5 19 7"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'circle'">
            <circle cx="12" cy="12" r="8"></circle>
          </ng-container>

          <ng-container *ngSwitchCase="'pie_chart'">
            <path d="M12 4a8 8 0 1 1-8 8h8V4Z"></path>
            <path d="M13 4.1A8 8 0 0 1 19.9 11H13V4.1Z"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'history'">
            <path d="M4 12a8 8 0 1 0 2.3-5.7"></path>
            <path d="M4 4v4h4"></path>
            <path d="M12 8v4l3 2"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'tag'">
            <path d="M11 4H5a1 1 0 0 0-1 1v6l8.5 8.5a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8L11 4Z"></path>
            <circle cx="8" cy="8" r="1"></circle>
          </ng-container>

          <ng-container *ngSwitchCase="'calendar'">
            <rect x="4" y="5" width="16" height="15" rx="2"></rect>
            <path d="M8 3v4"></path>
            <path d="M16 3v4"></path>
            <path d="M4 10h16"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'play'">
            <path d="m9 7 8 5-8 5V7Z"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'alert_circle'">
            <circle cx="12" cy="12" r="8.5"></circle>
            <path d="M12 8v5"></path>
            <path d="M12 16.5h.01"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'bell_off'">
            <path d="M6.8 6.8A5 5 0 0 1 17 10v4l1.6 2.1a1 1 0 0 1-.8 1.6H8.5"></path>
            <path d="M4 4l16 16"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'user'">
            <circle cx="12" cy="8" r="3.2"></circle>
            <path d="M5 19a7 7 0 0 1 14 0"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'hourglass'">
            <path d="M7 4h10"></path>
            <path d="M7 20h10"></path>
            <path d="M8 4c0 4 4 4 4 8s-4 4-4 8"></path>
            <path d="M16 4c0 4-4 4-4 8s4 4 4 8"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'more_horizontal'">
            <path d="M6 12h.01"></path>
            <path d="M12 12h.01"></path>
            <path d="M18 12h.01"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'mail'">
            <rect x="4" y="6" width="16" height="12" rx="2"></rect>
            <path d="m5 8 7 5 7-5"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'wifi'">
            <path d="M4.5 9.5a11 11 0 0 1 15 0"></path>
            <path d="M7.5 12.5a6.5 6.5 0 0 1 9 0"></path>
            <path d="M10.5 15.5a2.5 2.5 0 0 1 3 0"></path>
            <path d="M12 19h.01"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'hard_drive'">
            <rect x="4" y="6" width="16" height="12" rx="2"></rect>
            <path d="M8 15h.01"></path>
            <path d="M12 15h4"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'trash'">
            <path d="M4 7h16"></path>
            <path d="M9 4h6"></path>
            <path d="M8 7v12"></path>
            <path d="M16 7v12"></path>
            <path d="M6 7l1 12a2 2 0 0 0 2 1h6a2 2 0 0 0 2-1l1-12"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'shield'">
            <path d="M12 3 5 6v5c0 4.4 2.7 7.7 7 9 4.3-1.3 7-4.6 7-9V6l-7-3Z"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'link'">
            <path d="M10 13.5 8.5 15a3.5 3.5 0 1 1-5-5L7 6.5"></path>
            <path d="m14 10.5 1.5-1.5a3.5 3.5 0 0 1 5 5L17 17.5"></path>
            <path d="M8 12h8"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'quote'">
            <path d="M8 10H5.5A2.5 2.5 0 0 0 3 12.5V14a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1.5A2.5 2.5 0 0 0 6.5 10H5"></path>
            <path d="M19 10h-2.5A2.5 2.5 0 0 0 14 12.5V14a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1.5A2.5 2.5 0 0 0 17.5 10H16"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'message_circle'">
            <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v5A3.5 3.5 0 0 1 15.5 15H11l-4 4v-4.5A3.5 3.5 0 0 1 5 11.5v-5Z"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'cpu'">
            <rect x="7" y="7" width="10" height="10" rx="2"></rect>
            <path d="M9 1v4"></path>
            <path d="M15 1v4"></path>
            <path d="M9 19v4"></path>
            <path d="M15 19v4"></path>
            <path d="M1 9h4"></path>
            <path d="M1 15h4"></path>
            <path d="M19 9h4"></path>
            <path d="M19 15h4"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'git_branch'">
            <path d="M7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"></path>
            <path d="M17 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"></path>
            <path d="M7 10v4a4 4 0 0 0 4 4h3"></path>
            <path d="M7 10v10"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'git_compare'">
            <path d="M8 4v10a4 4 0 0 0 4 4h4"></path>
            <path d="M8 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"></path>
            <path d="M16 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"></path>
            <path d="M16 4v6a4 4 0 0 1-4 4H8"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'moon'">
            <path d="M18.5 14.5A7.5 7.5 0 0 1 9.5 5.5a7.5 7.5 0 1 0 9 9Z"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'sun'">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2.5v2.2"></path>
            <path d="M12 19.3v2.2"></path>
            <path d="m4.9 4.9 1.6 1.6"></path>
            <path d="m17.5 17.5 1.6 1.6"></path>
            <path d="M2.5 12h2.2"></path>
            <path d="M19.3 12h2.2"></path>
            <path d="m4.9 19.1 1.6-1.6"></path>
            <path d="m17.5 6.5 1.6-1.6"></path>
          </ng-container>

          <ng-container *ngSwitchCase="'settings'">
            <circle cx="12" cy="12" r="3.2"></circle>
            <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.8 1.8 0 1 1-3.6 0v-.1a1 1 0 0 0-.7-.9 1 1 0 0 0-1 .2l-.2.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H6a1.8 1.8 0 1 1 0-3.6h.1a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1l-.1-.2a1.8 1.8 0 1 1 2.5-2.5l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1.8 1.8 0 1 1 3.6 0v.1a1 1 0 0 0 .7.9 1 1 0 0 0 1-.2l.2-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.1a1.8 1.8 0 1 1 0 3.6h-.1a1 1 0 0 0-.9.7Z"></path>
          </ng-container>

          <ng-container *ngSwitchDefault>
            <circle cx="12" cy="12" r="8"></circle>
          </ng-container>
        </ng-container>
      </svg>
    </span>
  `,
  styleUrl: './app-icon.component.css',
})
export class AppIconComponent {
  @Input() name = '';
  @Input() size = 20;
  @Input() strokeWidth = 1.8;
  @Input() decorative = true;
  @Input() label = '';

  get normalizedName(): string {
    const value = (this.name ?? '').trim().toLowerCase().replace(/-/g, '_');

    const aliases: Record<string, string> = {
      grid: 'grid_on',
      chevron_right: 'chevron_right',
      chevron_left: 'chevron_left',
      chevron_down: 'chevron_down',
      chevron_right_outline: 'chevron_right',
      trending_up: 'trending_up',
      trending_down: 'trending_down',
      alert_triangle: 'warning',
      bell: 'notifications',
      clock: 'schedule',
      brain: 'psychology',
      file_text: 'description',
      users: 'groups',
      arrow_right: 'chevron_right',
      arrow_left: 'chevron_left',
      git_branch: 'git_branch',
      message_circle: 'message_circle',
    };

    return aliases[value] ?? value;
  }
}
