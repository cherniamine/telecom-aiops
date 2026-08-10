// ═══════════════════════════════════════════════════════════════════════════════
// manager/manager.routes.ts
// ═══════════════════════════════════════════════════════════════════════════════
import { Routes } from '@angular/router';
 
export const MANAGER_ROUTES: Routes = [
  { path: 'kpis',   loadComponent: () => import('./kpis/manager-kpis.component').then(m => m.ManagerKpisComponent) },
  { path: 'trends', loadComponent: () => import('./trends/manager-trends.component').then(m => m.ManagerTrendsComponent) },
  { path: 'sla',    loadComponent: () => import('./sla/manager-sla.component').then(m => m.ManagerSlaComponent) },
  { path: '', redirectTo: 'kpis', pathMatch: 'full' },
];
 
