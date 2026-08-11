// ───────────────────────────────────────────────────────────────────────────────
// INTERCEPTORS / auth.interceptor.ts
// ───────────────────────────────────────────────────────────────────────────────
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError }                        from 'rxjs';
import { AuthService } from '../../services/Auth.service';
 
/**
 * authInterceptor — injecte le Bearer token JWT dans chaque requête HTTP.
 * Si le token expire (401), déconnecte l'utilisateur proprement.
 */
export const authInterceptor: HttpInterceptorFn = (
  req:  HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const auth  = inject(AuthService);
  const token = auth.getToken();
 
  // Cloner la requête avec l'en-tête Authorization
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
 
  return next(authReq).pipe(
    catchError(err => {
      // Token expiré ou invalide → logout automatique
      if (err.status === 401) {
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};