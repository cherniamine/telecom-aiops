
// ═══════════════════════════════════════════════════════════════════════════════
// engineer.service.ts
// Endpoints rôle Engineer : ml-metrics, incident details, raw logs

import { Injectable } from "@angular/core";
import { BaseApiService } from "./Base api.service";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

// ═══════════════════════════════════════════════════════════════════════════════
export interface ModelInfo {
  path:      string;
  available: boolean;
}

export interface EngineerMlMetrics {
  role:         string;
  dataset: {
    total_logs:         number;
    historical_logs:    number;
    realtime_logs:      number;
    total_anomalies:    number;
    anomaly_rate_pct:   number;
    anomaly_rate_scope: string;
    clusters:           number;
    embedding_dim:      number;
  };
  models: {
    isolation_forest: ModelInfo;
    lof:              ModelInfo;
    tfidf:            ModelInfo;
  };
  drift: {
    severity:       string;
    score:          number;
    drifted_tests:  string[];
    retrain_needed: boolean;
  };
  feedback: {
    total:                number;
    true_positives:       number;
    false_positives:      number;
    precision_pct:        string;
    false_positive_rate:  string;
    retrain_ready:        boolean;
    unused_for_training:  number;
  };
  generated_at: string;
}

export interface EngineerIncidentDetails {
  role:         string;
  incident:     any;
  top_anomalies: any[];
  ml_metrics: {
    model_precision:     string;
    false_positive_rate: string;
    total_feedbacks:     number;
    retrain_ready:       boolean;
  };
  drift_status: {
    severity:       string;
    retrain_needed: boolean;
    last_check:     string | null;
  };
  generated_at: string;
}

export interface RawLog {
  platform:  string;
  level:     string;
  message:   string;
  timestamp: string;
}

export interface RawLogsResponse {
  role:         string;
  filters:      { platform: string | null; level: string | null };
  count:        number;
  logs:         RawLog[];
  generated_at: string;
}

@Injectable({ providedIn: 'root' })
export class EngineerService extends BaseApiService {

  constructor(http: HttpClient) { super(http); }

  /**
   * GET /dashboard/engineer/ml-metrics
   * Métriques complètes : dataset, modèles, drift, feedback
   */
  getMlMetrics(): Observable<EngineerMlMetrics> {
    return this.get<EngineerMlMetrics>('/dashboard/engineer/ml-metrics');
  }

  /**
   * GET /dashboard/engineer/details/:incidentId
   * Détails techniques complets d'un incident : RCA, anomalies, drift
   */
  getIncidentDetails(incidentId: string): Observable<EngineerIncidentDetails> {
    return this.get<EngineerIncidentDetails>(`/dashboard/engineer/details/${incidentId}`);
  }

  /**
   * GET /dashboard/engineer/logs/raw
   * Logs bruts filtrables par plateforme et niveau
   */
  getRawLogs(
    platform?: string,
    level?: string,
    limit = 100,
  ): Observable<RawLogsResponse> {
    return this.get<RawLogsResponse>('/dashboard/engineer/logs/raw', {
      platform, level, limit,
    });
  }
}