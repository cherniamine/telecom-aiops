
// ═══════════════════════════════════════════════════════════════════════════════
// base-api.service.ts  — classe parente partagée par tous les services
// ═══════════════════════════════════════════════════════════════════════════════
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class BaseApiService {
  protected readonly base = environment.apiUrl;

  constructor(protected http: HttpClient) {}

  protected get<T>(path: string, params?: Record<string, any>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== null && v !== undefined) httpParams = httpParams.set(k, String(v));
      });
    }
    return this.http
      .get<T>(`${this.base}${path}`, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  protected post<T>(path: string, body?: any): Observable<T> {
    return this.http
      .post<T>(`${this.base}${path}`, body ?? {})
      .pipe(catchError(this.handleError));
  }

  private handleError(err: any): Observable<never> {
    const detail = err?.error?.detail;
    const message = Array.isArray(detail)
      ? detail.map(item => item?.msg ?? 'Requête invalide').join(' ')
      : typeof detail === 'string'
        ? detail
        : err?.message ?? 'Erreur API inconnue';
    console.error('[API Error]', message, err);
    return throwError(() => new Error(message));
  }
}
