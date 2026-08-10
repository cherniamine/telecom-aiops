import { Component, Output, EventEmitter, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { interval, Subscription } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { AuthService } from '@app/services/Auth.service';
import { DashboardService } from '@app/services/Dashboard.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="topbar">

      <!-- ── Gauche : Breadcrumb + Status ─────────────── -->
      <div class="topbar-left">
        <button class="menu-btn" (click)="toggleSidebar.emit()" title="Menu">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 5h12M3 9h12M3 13h12"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- System Status indicator -->
        <div class="sys-status" [ngClass]="systemStatus.class" [title]="systemStatus.label">
          <span class="status-dot"></span>
          <span class="status-text">{{ systemStatus.label }}</span>
        </div>

        <!-- Pipeline realtime indicator -->
        <div class="pipeline-badge" *ngIf="realtimeActive">
          <span class="pulse-ring"></span>
          <span>Realtime</span>
        </div>
      </div>

      <!-- ── Centre : Stats rapides ─────────────────────── -->
      <div class="topbar-center">
        <div class="quick-stat" *ngFor="let stat of quickStats">
          <span class="qs-value" [ngClass]="stat.color">{{ stat.value }}</span>
          <span class="qs-label">{{ stat.label }}</span>
        </div>
      </div>

      <!-- ── Droite : Actions ─────────────────────────── -->
      <div class="topbar-right">

        <!-- Dark mode toggle -->
        <button class="icon-btn" (click)="toggleDarkMode()" [title]="darkMode ? 'Mode clair' : 'Mode sombre'">
          <svg *ngIf="!darkMode" width="17" height="17" viewBox="0 0 17 17" fill="none">
            <circle cx="8.5" cy="8.5" r="3.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M8.5 1v2M8.5 14v2M1 8.5h2M14 8.5h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M11.2 3.4l-1.4 1.4M3.4 11.2l1.4 1.4"
                  stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <svg *ngIf="darkMode" width="17" height="17" viewBox="0 0 17 17" fill="none">
            <path d="M14 9.5A6 6 0 017.5 3c0-.2 0-.3.01-.5A6 6 0 1014 9.5z"
                  stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Refresh -->
        <button class="icon-btn" (click)="refresh()" title="Actualiser" [class.spinning]="refreshing">
         <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
          <path d="M12 4.5C10.9 3.3 9.5 2.5 8 2.5A5.5 5.5 0 002.5 8"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M4 11.5C5.1 12.7 6.5 13.5 8 13.5A5.5 5.5 0 0013.5 8"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M12 2v3h-3" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4 14v-3h3" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        </button>

        <!-- Notifications -->
        <button class="icon-btn notif-btn" [routerLink]="['/noc/alerts']" title="Alertes">
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
            <path d="M8.5 1.5a4.5 4.5 0 014.5 4.5c0 2.7 1 3.6 1.8 4.5H2.2C3 9.6 4 8.7 4 6a4.5 4.5 0 014.5-4.5z"
                  stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M6.5 12.5a2 2 0 004 0" stroke="currentColor" stroke-width="1.4"/>
          </svg>
          <span class="notif-count" *ngIf="alertCount > 0">{{ alertCount > 9 ? '9+' : alertCount }}</span>
        </button>

        <!-- Séparateur -->
        <div class="topbar-sep"></div>

        <!-- Timestamp -->
        <span class="topbar-time">{{ currentTime }}</span>
      </div>
    </header>
  `,
  styleUrls: ['./topbar.component.scss'],
})
export class TopbarComponent implements OnInit, OnDestroy {
  @Output() toggleSidebar = new EventEmitter<void>();
  @Input() isDarkMode = false;

  darkMode = false;
  refreshing = false;
  realtimeActive = true;
  alertCount = 0;
  currentTime = '';

  systemStatus = { class: 'ok', label: 'Système OK' };

  quickStats: { value: string; label: string; color: string }[] = [];

  private subs = new Subscription();

  constructor(
    private authService: AuthService,
    private dashboardService: DashboardService,
  ) {}

  ngOnInit(): void {
    this.darkMode = document.documentElement.classList.contains('dark');
    this.updateTime();

    // Mise à jour de l'heure chaque seconde
    this.subs.add(
      interval(1000).subscribe(() => this.updateTime())
    );

    // Chargement overview toutes les 30s
    this.subs.add(
      interval(30000).pipe(
        startWith(0),
        switchMap(() => this.dashboardService.getOverview()),
      ).subscribe(data => this.updateStats(data))
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private updateTime(): void {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  private updateStats(data: any): void {
    const sev = data?.latest_severity ?? 'UNKNOWN';

    this.systemStatus = sev === 'CRITICAL'
      ? { class: 'critical', label: 'Incident CRITICAL' }
      : sev === 'HIGH'
      ? { class: 'warning',  label: 'Incident HIGH' }
      : { class: 'ok',       label: 'Système OK' };

    this.alertCount = data?.total_alerts ?? 0;

    this.quickStats = [
      {
        value: (data?.total_logs ?? 0).toLocaleString('fr-FR'),
        label: 'Logs',
        color: 'text-muted',
      },
      {
        value: (data?.total_anomalies ?? 0).toLocaleString('fr-FR'),
        label: 'Anomalies',
        color: 'text-amber',
      },
      {
        value: data?.total_incidents ?? '0',
        label: 'Incidents',
        color: sev === 'CRITICAL' ? 'text-red' : 'text-muted',
      },
      {
        value: data?.latest_severity ?? '—',
        label: 'Sévérité',
        color: sev === 'CRITICAL' ? 'text-red' : sev === 'HIGH' ? 'text-amber' : 'text-green',
      },
    ];
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    document.documentElement.classList.toggle('dark', this.darkMode);
    localStorage.setItem('theme', this.darkMode ? 'dark' : 'light');
  }

  refresh(): void {
    this.refreshing = true;
    this.dashboardService.getOverview().subscribe({
      next: (data) => { this.updateStats(data); this.refreshing = false; },
      error: () => { this.refreshing = false; },
    });
  }
}