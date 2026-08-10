// ═══════════════════════════════════════════════════════════════════════════════
// app.routes.ts — Lazy loading + RoleGuard
// ═══════════════════════════════════════════════════════════════════════════════
import { Routes }       from '@angular/router';
import { AuthGuard }    from './core/guards/auth.guard';
import { RoleGuard }    from './core/guards/role.guard';
 
export const APP_ROUTES: Routes = [
 
  // ─── Auth (pas de layout) ────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./layout/auth-layout/auth-layout.component')
        .then(m => m.AuthLayoutComponent),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./Pages/login/login.component')
            .then(m => m.LoginComponent),
        title: 'Connexion — TelecomAI',
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
 
  // ─── App (avec MainLayout + AuthGuard global) ─────────────────────────────
  {
    path: '',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component')
        .then(m => m.MainLayoutComponent),
    children: [
 
      // Overview (tous rôles)
      {
        path: 'overview',
        loadComponent: () =>
          import('./Pages/home/home.component').then(m => m.HomeComponent),
        title: 'Vue d\'ensemble — TelecomAI',
      },
 
      // Incidents (tous rôles)
      {
        path: 'incidents',
        loadChildren: () =>
          import('./Pages/incidents/incidents.routes')
            .then(m => m.INCIDENT_ROUTES),
        title: 'Incidents — TelecomAI',
      },
 
      // Analytics (manager + engineer)
      {
        path: 'analytics',
        canActivate: [RoleGuard],
        data: { roles: ['manager', 'engineer'] },
        loadComponent: () =>
          import('./Pages/incidents/analytics/analytics.component')
            .then(m => m.AnalyticsComponent),
        title: 'Analytics — TelecomAI',
      },
 
      // ── NOC routes ──────────────────────────────────────────────────────
      {
        path: 'noc',
        canActivate: [RoleGuard],
        data: { roles: ['noc', 'engineer'] },
        loadChildren: () =>
          import('./Pages/noc/noc.routes').then(m => m.NOC_ROUTES),
      },
 
      // ── Manager routes ───────────────────────────────────────────────────
      {
        path: 'manager',
        canActivate: [RoleGuard],
        data: { roles: ['manager', 'engineer'] },
        loadChildren: () =>
          import('./Pages/manager/manager.routes').then(m => m.MANAGER_ROUTES),
      },
 
      // ── Engineer routes ──────────────────────────────────────────────────
      {
        path: 'engineer',
        canActivate: [RoleGuard],
        data: { roles: ['engineer'] },
        loadChildren: () =>
          import('./Pages/engineer/engineer.routes').then(m => m.ENGINEER_ROUTES),
      },
 
      // ── AI feature pages (tous rôles) ────────────────────────────────────
      {
        path: 'copilot',
        loadComponent: () =>
          import('./features/ai-copilot/copilot-chat.component')
            .then(m => m.CopilotChatComponent),
        title: 'Copilot IA — TelecomAI',
      },
      {
        path: 'similarity',
        canActivate: [RoleGuard],
        data: { roles: ['engineer', 'manager'] },
        loadComponent: () =>
          import('./features/similarity-search/similarity-search.component')
            .then(m => m.SimilaritySearchComponent),
        title: 'Similarité FAISS — TelecomAI',
      },
 
      // Redirect par défaut (post-login)
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
    ],
  },
 
  // 404 → redirect overview
  { path: '**', redirectTo: '/overview' },
];
 