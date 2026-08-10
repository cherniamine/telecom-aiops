// ───────────────────────────────────────────────────────────────────────────────
// INTERCEPTORS / loading.interceptor.ts
// ───────────────────────────────────────────────────────────────────────────────
import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject, Injectable, signal }                        from '@angular/core';
import { finalize }                                  from 'rxjs/operators';
 
/**
 * LoadingService — compteur de requêtes HTTP en cours.
 * Expose un signal `isLoading` utilisé par la topbar.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private pendingRequests = 0;
 
  /** Signal réactif : true si au moins une requête HTTP est en cours */
  readonly isLoading = signal(false);
 
  start(): void {
    this.pendingRequests++;
    if (this.pendingRequests === 1) {
      this.isLoading.set(true);
    }
  }
 
  stop(): void {
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    if (this.pendingRequests === 0) {
      this.isLoading.set(false);
    }
  }
 
  reset(): void {
    this.pendingRequests = 0;
    this.isLoading.set(false);
  }
}
 
/**
 * loadingInterceptor — démarre/arrête le spinner global autour de chaque requête.
 * Exclut les appels vers des assets ou URLs externes.
 */
export const loadingInterceptor: HttpInterceptorFn = (
  req:  HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const loading = inject(LoadingService);
 
  // Ne pas compter les requêtes non-API (assets, fonts…)
  const isApiCall = req.url.includes('/dashboard') || req.url.includes('/auth');
  if (!isApiCall) return next(req);
 
  loading.start();
  return next(req).pipe(finalize(() => loading.stop()));
};