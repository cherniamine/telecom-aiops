// ═══════════════════════════════════════════════════════════════════════════════
// noc/noc.routes.ts
// ═══════════════════════════════════════════════════════════════════════════════
import { Routes } from '@angular/router';
 
export const NOC_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('././dashboard/noc-dashboard.component').then(m => m.NocDashboardComponent),
  },
  {
    path: 'alerts',
    loadComponent: () => import('././alerts/noc-alerts.component').then(m => m.NocAlertsComponent),
  },
  {
    path: 'queue',
    loadComponent: () => import('././queue/noc-queue.component').then(m => m.NocQueueComponent),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];