// ───────────────────────────────────────────────────────────────────────────────
// GUARDS / role.guard.ts
// ───────────────────────────────────────────────────────────────────────────────

import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../../services/Auth.service";
import { inject } from "@angular/core";

 
/**
 * RoleGuard — vérifie que l'utilisateur connecté a le rôle requis.
 * Usage dans les routes : canActivate: [RoleGuard], data: { roles: ['noc','engineer'] }
 */
export const RoleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
) => {
  const auth     = inject(AuthService);
  const router   = inject(Router);
  const required = route.data['roles'] as string[] | undefined;
 
  // Non connecté → login
  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }
 
  // Rôle insuffisant → overview (pas d'accès non autorisé)
  if (required?.length && !auth.hasRole(...required)) {
    router.navigate(['/overview']);
    return false;
  }
 
  return true;
};