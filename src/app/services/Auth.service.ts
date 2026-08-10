// ═══════════════════════════════════════════════════════════════════════════════
// auth.service.ts
// POST /auth/login  →  JWT token + rôle
// ═══════════════════════════════════════════════════════════════════════════════
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '@env/environment';

export interface AuthUser {
  username:   string;
  role:       'noc' | 'manager' | 'engineer';
  role_label: string;
  token:      string;
}

export interface LoginResponse {
  access_token: string;
  token_type:   string;
  role:         string;
  role_label:   string;
  username:     string;
  expires_in:   string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly STORAGE_KEY = 'telecom_user';
  private readonly apiUrl = environment.apiUrl;

  private userSubject = new BehaviorSubject<AuthUser | null>(
    this.loadFromStorage()
  );

  /** Observable du user courant (utilisé par les composants) */
  readonly currentUser$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  // ── Login ──────────────────────────────────────────────────────────────────

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/auth/login`, { username, password })
      .pipe(
        tap(res => {
          const user: AuthUser = {
            username:   username,
            role:       res.role as AuthUser['role'],
            role_label: res.role_label,
            token:      res.access_token,
          };
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
          this.userSubject.next(user);
        })
      );
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getToken():       string | null  { return this.userSubject.value?.token ?? null; }
  getRole():        string | null  { return this.userSubject.value?.role ?? null; }
  getCurrentUser(): AuthUser | null { return this.userSubject.value; }
  isLoggedIn():     boolean        { return !!this.userSubject.value; }

  hasRole(...roles: string[]): boolean {
    return roles.includes(this.userSubject.value?.role ?? '');
  }

  // ── Dashboard redirect helper ──────────────────────────────────────────────

  getDefaultRoute(): string {
    const role = this.getRole();
    const map: Record<string, string> = {
      noc:      '/noc/dashboard',
      manager:  '/manager/kpis',
      engineer: '/engineer/ml-metrics',
    };
    return map[role ?? ''] ?? '/overview';
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private loadFromStorage(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}