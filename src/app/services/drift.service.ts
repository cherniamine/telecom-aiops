// ═══════════════════════════════════════════════════════════════════════════════
// drift.service.ts
// Endpoints : overview, latest, history, analyze, set-reference

import { Injectable } from "@angular/core";
import { BaseApiService } from "./Base api.service";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

// ═══════════════════════════════════════════════════════════════════════════════
export interface DriftReference {
  available:      boolean;
  timestamp:      string;
  n_samples:      number;
  mean:           number;
  std:            number;
  anomaly_rate:   number;
  vocabulary_size?: number;
}

export interface DriftTestResult {
  drifted:        boolean;
  drift_ratio?:   number;
  interpretation: string;
  [key: string]:  any;
}

export interface DriftReport {
  window_label:         string;
  timestamp:            string;
  n_current_samples:    number;
  n_reference_samples:  number;
  drift_results:        Record<string, DriftTestResult>;
  drifted_tests:        string[];
  drift_severity:       string;
  drift_score:          number;
  verdict:              string;
  recommendations:      string[];
  retrain_required:     boolean;
}

export interface DriftOverview {
  reference:      DriftReference;
  latest_report:  Partial<DriftReport>;
  history_count:  number;
  status:         string;
}

@Injectable({ providedIn: 'root' })
export class DriftService extends BaseApiService {

  constructor(http: HttpClient) { super(http); }

  /** GET /dashboard/model-drift */
  getOverview(): Observable<DriftOverview> {
    return this.get<DriftOverview>('/dashboard/model-drift');
  }

  /** GET /dashboard/model-drift/latest */
  getLatest(): Observable<Partial<DriftReport> & { message?: string; drift_severity: string }> {
    return this.get('/dashboard/model-drift/latest');
  }

  /** GET /dashboard/model-drift/history */
  getHistory(): Observable<Partial<DriftReport>[]> {
    return this.get('/dashboard/model-drift/history');
  }

  /**
   * POST /dashboard/model-drift/analyze
   * Lance une analyse de drift sur un lot de scores
   */
  analyze(
    scores: number[],
    texts?: string[],
    windowLabel?: string,
  ): Observable<DriftReport> {
    return this.post<DriftReport>('/dashboard/model-drift/analyze', {
      scores,
      texts:        texts ?? null,
      window_label: windowLabel ?? null,
    });
  }

  /**
   * POST /dashboard/model-drift/set-reference
   * Enregistre une nouvelle référence après ré-entraînement
   */
  setReference(
    scores: number[],
    texts?: string[],
    anomalyRate = 0.05,
  ): Observable<any> {
    return this.post('/dashboard/model-drift/set-reference', {
      scores,
      texts:        texts ?? null,
      anomaly_rate: anomalyRate,
    });
  }
}

