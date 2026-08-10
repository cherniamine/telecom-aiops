// ───────────────────────────────────────────────────────────────────────────────
// MODELS / user.model.ts
// ───────────────────────────────────────────────────────────────────────────────
 
export type UserRole = 'noc' | 'manager' | 'engineer';
 
export interface User {
  username:   string;
  role:       UserRole;
  role_label: string;
  token:      string;
}
 
export interface LoginRequest {
  username: string;
  password: string;
}
 
export interface LoginResponse {
  access_token: string;
  token_type:   string;
  role:         UserRole;
  role_label:   string;
  username:     string;
  expires_in:   string;
}
 
/** Config des rôles pour l'UI */
export const ROLE_CONFIG: Record<UserRole, {
  label:      string;
  color:      string;       // couleur Tailwind hex
  dotClass:   string;       // classe CSS du dot sidebar
  dashRoute:  string;       // route par défaut après login
  endpoints:  string[];
}> = {
  noc: {
    label:     'Opérateur NOC',
    color:     '#ef4444',
    dotClass:  'dot-red',
    dashRoute: '/noc/dashboard',
    endpoints: [
      'GET /dashboard/noc/alerts',
      'GET /dashboard/noc/queue',
      'GET /dashboard/noc/realtime',
      'POST /dashboard/feedback/anomaly/{id}',
    ],
  },
  manager: {
    label:     'Manager',
    color:     '#22c55e',
    dotClass:  'dot-green',
    dashRoute: '/manager/kpis',
    endpoints: [
      'GET /dashboard/manager/kpis',
      'GET /dashboard/manager/trends',
      'GET /dashboard/manager/sla-report',
    ],
  },
  engineer: {
    label:     'Ingénieur Système',
    color:     '#3b82f6',
    dotClass:  'dot-blue',
    dashRoute: '/engineer/ml-metrics',
    endpoints: [
      'GET /dashboard/engineer/ml-metrics',
      'GET /dashboard/engineer/details/{id}',
      'GET /dashboard/engineer/logs/raw',
      'GET /dashboard/model-drift/latest',
      'POST /dashboard/feedback/retrain',
    ],
  },
};