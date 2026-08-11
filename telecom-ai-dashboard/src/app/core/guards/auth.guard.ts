// ───────────────────────────────────────────────────────────────────────────────
// GUARDS / auth.guard.ts
// ───────────────────────────────────────────────────────────────────────────────
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../../services/Auth.service';

 
/**
 * AuthGuard — redirige vers /login si l'utilisateur n'est pas connecté.
 * Sauvegarde l'URL demandée pour redirect après login.
 */
export const AuthGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state:  RouterStateSnapshot,
) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
 
  if (auth.isLoggedIn()) return true;
 
  // Sauvegarder l'URL pour redirect post-login
  router.navigate(['/login'], {
    queryParams: { returnUrl: state.url },
  });
  return false;
};