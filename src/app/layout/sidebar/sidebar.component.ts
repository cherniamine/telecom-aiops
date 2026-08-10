import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/Auth.service';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';

export interface NavItem {
  label: string;
  icon: string;      
  route: string;
  badge?: string;     
  roles: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, SafeHtmlPipe],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed">

      <!-- ── Logo ─────────────────────────────────────── -->
      <div class="logo-area">
        <div class="logo-mark">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Fond technique -->
            <rect width="28" height="28" rx="6" fill="#0f172a"/>
            
            <!-- Dégradés -->
            <defs>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#3b82f6"/>
                <stop offset="100%" stop-color="#8b5cf6"/>
              </linearGradient>
            </defs>
            
            <!-- Bouclier principal -->
            <path d="M14 2L4 6v8c0 6 4 10 10 12 6-2 10-6 10-12V6L14 2z" 
                  stroke="url(#shieldGrad)" stroke-width="1" fill="none" stroke-linejoin="round"/>
            
            <!-- EKG pulsation sur bouclier -->
            <path d="M6 14L8 14L9 11L10 16L11 12L12 14.5L13 13L14 14L16 14L17 12L18 15L19 13L20 14L22 14" 
                  stroke="#22c55e" stroke-width="0.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            
            <!-- Point de pic d'alerte -->
            <circle cx="17" cy="12" r="1" fill="#ef4444" opacity="0.8"/>
            
            <!-- Loupe intégrée (coin bas-droit) -->
            <circle cx="21" cy="21" r="4" stroke="#8b5cf6" stroke-width="1" fill="none"/>
            <path d="M24 24L26 26" stroke="#8b5cf6" stroke-width="1" stroke-linecap="round"/>
            
            <!-- Logs dans la loupe -->
            <path d="M19 20h3M19 22h2" stroke="#475569" stroke-width="0.5" stroke-linecap="round"/>
            <path d="M22 21h1" stroke="#ef4444" stroke-width="0.7" stroke-linecap="round"/>
            
            <!-- Neurone IA -->
            <circle cx="21" cy="21" r="2" stroke="#a78bfa" stroke-width="0.4" fill="none" opacity="0.6"/>
            <circle cx="21" cy="21" r="0.6" fill="#a78bfa"/>
            
            <!-- Badge LIVE temps réel -->
            <rect x="18" y="3" width="7" height="3" rx="0.8" fill="#ef4444" opacity="0.9"/>
            <text x="19" y="5.2" font-size="4.5" fill="white" font-weight="bold" font-family="monospace">LIVE</text>
            
            <!-- Effet de pulse -->
            <circle cx="14" cy="14" r="11" stroke="#3b82f6" stroke-width="0.3" fill="none" opacity="0.4">
              <animate attributeName="r" values="11;14;11" dur="2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite"/>
            </circle>
          </svg> 
        </div>
        <div class="logo-text" *ngIf="!collapsed">
          <span class="logo-name">TelecomAI</span>
          <span class="logo-sub">Supervision</span>
        </div>
        <button class="collapse-btn" *ngIf="!collapsed" (click)="toggleCollapse.emit()" [title]="collapsed ? 'Expand' : 'Collapse'">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path [attr.d]="collapsed ? 'M6 4l4 4-4 4' : 'M10 4L6 8l4 4'"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      </div>

      <!-- ── Role Badge ─────────────────────────────────── -->
      <div class="role-badge" *ngIf="!collapsed">
        <span class="role-dot" [ngClass]="roleColor"></span>
        <span class="role-label">{{ roleLabel }}</span>
      </div>
      <div class="role-badge-mini" *ngIf="collapsed">
        <span class="role-dot-mini" [ngClass]="roleColor" [title]="roleLabel"></span>
      </div>

      <!-- ── Nav ───────────────────────────────────────── -->
      <nav class="nav">
        <div class="nav-section-label" *ngIf="!collapsed">Navigation</div>

        <ng-container *ngFor="let item of visibleNavItems">
          <a class="nav-item"
             [routerLink]="item.route"
             routerLinkActive="active"
             [title]="item.label">
            <span class="nav-icon" [innerHTML]="item.icon | safeHtml"></span>
            <span class="nav-label" *ngIf="!collapsed">{{ item.label }}</span>
            <span class="nav-badge" *ngIf="item.badge && !collapsed">{{ item.badge }}</span>
          </a>
        </ng-container>

        <!-- ── Divider ─────────────────────────────────── -->
        <div class="nav-divider"></div>
        <div class="nav-section-label" *ngIf="!collapsed">Outils IA</div>

        <ng-container *ngFor="let item of aiNavItemsVisible">
          <a class="nav-item ai"
             [routerLink]="item.route"
             routerLinkActive="active"
             [title]="item.label">
            <span class="nav-icon" [innerHTML]="item.icon | safeHtml"></span>
            <span class="nav-label" *ngIf="!collapsed">{{ item.label }}</span>
            <span class="nav-badge ai" *ngIf="item.badge && !collapsed">{{ item.badge }}</span>
          </a>
        </ng-container>
      </nav>

      <!-- ── Bottom: User ──────────────────────────────── -->
      <div class="user-area">
        <div class="user-avatar">{{ userInitials }}</div>
        <div class="user-info" *ngIf="!collapsed">
          <span class="user-name">{{ username }}</span>
          <span class="user-role">{{ roleLabel }}</span>
        </div>
        <button class="logout-btn" *ngIf="!collapsed" (click)="logout()" title="Déconnexion">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </aside>
  `,
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit {
  @Input() collapsed = false;
  @Output() toggleCollapse = new EventEmitter<void>();

  username = '';
  roleLabel = '';
  roleColor = '';
  userInitials = '';

  readonly navItems: NavItem[] = [
    {
      label: 'Vue d\'ensemble',
      route: '/overview',
      roles: ['noc', 'manager', 'engineer'],
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
               <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
               <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
               <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
               <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
             </svg>`,
    },
    {
      label: 'Alertes NOC',
      route: '/noc/alerts',
      roles: ['noc', 'engineer'],
      badge: 'LIVE',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
               <path d="M9 2a5 5 0 015 5c0 3 1 4 2 5H2c1-1 2-2 2-5a5 5 0 015-5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
               <path d="M7 14a2 2 0 004 0" stroke="currentColor" stroke-width="1.4"/>
             </svg>`,
    },
    {
      label: 'File d\'attente',
      route: '/noc/queue',
      roles: ['noc', 'engineer'],
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
               <path d="M3 5h12M3 9h8M3 13h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
             </svg>`,
    },
    {
      label: 'Incidents',
      route: '/incidents',
      roles: ['noc', 'manager', 'engineer'],
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
               <path d="M9 2L16 14H2L9 2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
               <path d="M9 8v3M9 13v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
             </svg>`,
    },
    {
      label: 'KPIs Manager',
      route: '/manager/kpis',
      roles: ['manager', 'engineer'],
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
               <path d="M3 13l4-4 3 3 5-7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
               <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/>
             </svg>`,
    },
    {
      label: 'Analytics',
      route: '/analytics',
      roles: ['manager', 'engineer'],
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
               <rect x="3" y="9" width="3" height="7" rx="1" stroke="currentColor" stroke-width="1.4"/>
               <rect x="8" y="5" width="3" height="11" rx="1" stroke="currentColor" stroke-width="1.4"/>
               <rect x="13" y="2" width="3" height="14" rx="1" stroke="currentColor" stroke-width="1.4"/>
             </svg>`,
    },
    {
      label: 'ML Métriques',
      route: '/engineer/ml-metrics',
      roles: ['engineer'],
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
               <circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.4"/>
               <path d="M9 5v4l2.5 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
             </svg>`,
    },
  ];

  readonly aiNavItems: NavItem[] = [
    {
      label: 'Copilot IA',
      route: '/copilot',
      roles: ['noc', 'manager', 'engineer'],
      badge: 'AI',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
               <path d="M9 2C5.13 2 2 5.13 2 9s3.13 7 7 7c.9 0 1.76-.17 2.55-.47L15 17l-1.03-3.55A6.97 6.97 0 0016 9c0-3.87-3.13-7-7-7z"
                     stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
               <path d="M6 8h6M6 11h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
             </svg>`,
    },
    {
      label: 'What-If',
      route: '/incidents',
      roles: ['noc', 'manager', 'engineer'],
      badge: 'AI',
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
               <path d="M9 2v4M9 12v4M2 9h4M12 9h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
               <circle cx="9" cy="9" r="3" stroke="currentColor" stroke-width="1.4"/>
             </svg>`,
    },
    {
      label: 'Similarité FAISS',
      route: '/similarity',
      roles: ['engineer'],
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
               <circle cx="6" cy="6" r="3" stroke="currentColor" stroke-width="1.4"/>
               <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.4"/>
               <path d="M8.5 8.5l1 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
             </svg>`,
    },
    {
      label: 'Drift Monitor',
      route: '/engineer/ml-metrics',
      roles: ['engineer'],
      icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
               <path d="M2 9c2-4 4-4 6 0s4 4 6 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
               <path d="M2 13c2-2 4-2 6 0s4 2 6 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.4"/>
             </svg>`,
    },
  ];

  get visibleNavItems(): NavItem[] {
    const role = this.authService.getRole() ?? '';
    return this.navItems.filter(item => item.roles.includes(role));
  }

  get aiNavItemsFiltered(): NavItem[] {
    const role = this.authService.getRole() ?? '';
    return this.aiNavItems.filter(item => item.roles.includes(role));
  }

  get aiNavItemsVisible(): NavItem[] {
    return this.aiNavItemsFiltered;
  }

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.username = user?.username ?? 'Utilisateur';
    this.userInitials = this.username.slice(0, 2).toUpperCase();
    const role = user?.role ?? 'noc';
    const roleMap: Record<string, { label: string; color: string }> = {
      noc:      { label: 'Opérateur NOC',    color: 'dot-red'   },
      manager:  { label: 'Manager',           color: 'dot-green' },
      engineer: { label: 'Ingénieur Système', color: 'dot-blue'  },
    };
    this.roleLabel = roleMap[role]?.label ?? role;
    this.roleColor = roleMap[role]?.color ?? 'dot-gray';
  }

  logout(): void {
    this.authService.logout();
  }
}
