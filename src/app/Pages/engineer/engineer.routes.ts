// ═══════════════════════════════════════════════════════════════════════════════
// engineer/engineer.routes.ts

import { Routes } from '@angular/router';

// ═══════════════════════════════════════════════════════════════════════════════
export const ENGINEER_ROUTES: Routes = [
  { path: 'ml-metrics', loadComponent: () => import('./ml-metrics/ml-metrics.component').then(m => m.MlMetricsComponent) },
  { path: 'details/:id', loadComponent: () => import('./incident-details/incident-details.component').then(m => m.IncidentDetailsComponent) },
  { path: 'logs', loadComponent: () => import('./raw-logs/raw-logs.component').then(m => m.RawLogsComponent) },
  { path: '', redirectTo: 'ml-metrics', pathMatch: 'full' },
];
 
 
