// ═══════════════════════════════════════════════════════════════════════════════
// incidents.routes.ts

import { Routes } from '@angular/router';

// ═══════════════════════════════════════════════════════════════════════════════
export const INCIDENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./list/incident-list.component').then(m => m.IncidentListComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./detail/incident-detail.component').then(m => m.IncidentDetailComponent),
  },
];