import { Component, OnInit }  from '@angular/core';
import { Router }             from '@angular/router';
import { CommonModule }       from '@angular/common';
import { StatCardComponent }      from '../../shared/components/stat-card/stat-card.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { DashboardService, OverviewData } from '@app/services/Dashboard.service';
import { AuthService } from '@app/services/Auth.service';

@Component({
  selector:   'app-home',
  standalone: true,
  imports: [CommonModule, StatCardComponent, LoadingSpinnerComponent],
  template: `
    <div class="page-home">
      <div class="home-hero" *ngIf="!loading; else spin">
        <div class="hero-greeting">

          <!-- Icône SVG dynamique selon l'heure -->
          <div class="hero-icon-wrap" [ngClass]="greetingPeriod">
            <svg *ngIf="greetingPeriod === 'morning'" width="36" height="36" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5"/>
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <svg *ngIf="greetingPeriod === 'afternoon'" width="36" height="36" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.15"/>
              <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <svg *ngIf="greetingPeriod === 'evening'" width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                fill="currentColor" fill-opacity="0.15"/>
            </svg>
          </div>

          <div>
            <h1 class="hero-title">
              <span class="greeting-label">{{ greetingText }},</span>
              <span class="username-highlight">{{ username }}</span>
            </h1>
            <p class="hero-sub">{{ roleLabel }} · {{ today }}</p>
          </div>
        </div>

        <!-- Quick overview cards -->
   
<div class="overview-grid" *ngIf="overview">
  <!-- Logs historiques - valeur en cyan -->
  <app-stat-card 
    label="Logs historiques"
    [value]="overview.total_logs" 
    format="number"
    accent="cyan" 
    valueColor="cyan"
    icon='<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 4h12M3 8h10M3 12h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'/>
  
  <!-- Anomalies - valeur en amber -->
  <app-stat-card 
    label="Anomalies"
    [value]="overview.total_anomalies" 
    format="number"
    accent="amber" 
    valueColor="amber"
    icon='<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L16 14H2L9 2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 7v4M9 12.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'/>
  
  <!-- Incidents actifs - valeur conditionnelle -->
  <app-stat-card 
    label="Incidents actifs"
    [value]="overview.total_incidents" 
    format="number"
    [accent]="overview.latest_severity === 'CRITICAL' ? 'red' : 'blue'"
    [valueColor]="overview.latest_severity === 'CRITICAL' ? 'red' : 'default'"
    icon='<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.4"/><path d="M9 6v3.5M9 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'/>
  
  <!-- Sévérité - valeur en rouge avec accent red -->
  <app-stat-card 
    label="Sévérité"
    [value]="overview.latest_severity ?? '—'" 
    format="raw"
    accent="red"
    valueColor="red"
    icon='<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.4"/><path d="M6 9l2.5 2.5 3.5-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'/>
</div>
        <!-- Redirect button -->
        <button class="go-dashboard" (click)="goToDashboard()">
          Aller à mon tableau de bord →
        </button>
      </div>
      <ng-template #spin>
        <app-loading-spinner label="Chargement..." minHeight="300px"/>
      </ng-template>
    </div>
  `,
  styles: [`
    .page-home  { max-width: 900px; margin: 0 auto; }
    .home-hero  { padding: 8px 0 32px; }
    .hero-greeting { display:flex; align-items:center; gap:16px; margin-bottom:32px; }

    .hero-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 14px;
      flex-shrink: 0;
      transition: background 0.3s, color 0.3s;
    }
    .hero-icon-wrap.morning  { background: #fef9ec; color: #d97706; }
    .hero-icon-wrap.afternoon { background: #fff7ed; color: #ea580c; }
    .hero-icon-wrap.evening  { background: #eef2ff; color: #6366f1; }

    .hero-title {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -.02em;
    }
    .greeting-label { color: var(--accent, #0ea5e9); }
    
    /* Style moderne et professionnel pour le username */
    .username-highlight {
      background: linear-gradient(135deg, var(--accent, #0ea5e9) 0%, #8b5cf6 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      font-weight: 800;
      position: relative;
      display: inline-block;
      margin-left: 10px; 
    }
    
    /* Alternative avec un léger effet de brillance */
    .username-highlight::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 100%;
      height: 2px;
      background: linear-gradient(90deg, var(--accent, #0ea5e9), #8b5cf6, transparent);
      border-radius: 2px;
      opacity: 0.4;
    }
    
    .hero-sub   { margin: 4px 0 0; font-size: 13px; color: var(--text-muted); }

    .overview-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:24px; }
    @media (max-width:768px) { .overview-grid { grid-template-columns:repeat(2,1fr); } }

    .go-dashboard {
      padding:10px 22px; border-radius:10px; border:none;
      background:var(--accent,#0ea5e9); color:#fff;
      font-size:14px; font-weight:600; cursor:pointer;
      transition:opacity 150ms;
    }
    .go-dashboard:hover { opacity:.88; }
  `],
})
export class HomeComponent implements OnInit {
  loading   = true;
  overview: OverviewData | null = null;
  username  = '';
  roleLabel = '';
  today     = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });

  greetingText   = '';
  greetingPeriod: 'morning' | 'afternoon' | 'evening' = 'morning';

  constructor(
    private auth:      AuthService,
    private router:    Router,
    private dashboard: DashboardService,
  ) {}

  ngOnInit(): void {
    this.setGreeting();

    const user = this.auth.getCurrentUser();
    this.username  = user?.username ?? '';
    this.roleLabel = user?.role_label ?? '';
    this.dashboard.getOverview().subscribe({
      next:  v => { this.overview = v; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  private setGreeting(): void {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      this.greetingText   = 'Bonjour';
      this.greetingPeriod = 'morning';
    } else if (hour >= 12 && hour < 18) {
      this.greetingText   = 'Bon après-midi';
      this.greetingPeriod = 'afternoon';
    } else {
      this.greetingText   = 'Bonsoir';
      this.greetingPeriod = 'evening';
    }
  }

  goToDashboard(): void { this.router.navigate([this.auth.getDefaultRoute()]); }
}