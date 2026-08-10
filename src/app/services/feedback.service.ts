// ═══════════════════════════════════════════════════════════════════════════════
// feedback.service.ts
// Endpoints : submit, batch, stats, pending, retrain, history
// ═══════════════════════════════════════════════════════════════════════════════
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { BaseApiService } from './Base api.service';

export type FeedbackLabel =
  | 'true_positive'
  | 'false_positive'
  | 'uncertain'
  | 'corrected_cause';

export interface FeedbackRequest {
  label:               FeedbackLabel;
  operator_id?:        string;
  corrected_cause?:    string | null;
  corrected_severity?: string | null;
  comment?:            string | null;
}

export interface FeedbackResponse {
  action:      'created' | 'updated';
  anomaly_id:  string;
  label:       FeedbackLabel;
  description: string;
  operator_id: string;
  timestamp:   string;
  global_stats: FeedbackStats;
  retrain_ready: boolean;
}

export interface FeedbackStats {
  total_feedbacks:      number;
  true_positives:       number;
  false_positives:      number;
  uncertain:            number;
  corrected_causes:     number;
  model_precision:      number | null;
  precision_pct:        string;
  unused_for_training:  number;
  retrain_threshold:    number;
  retrain_ready:        boolean;
}

export interface PendingAnomaly {
  _id:             string;
  log_index?:      number;
  timestamp:       string;
  platform:        string;
  message:         string;
  anomaly_score:   number;
  threshold_used?: number;
  threshold_type?: string;
  status:          string;
  urgency?:        string;
}

export interface FeedbackHistoryItem {
  _id:                string;
  anomaly_id:         string;
  label:              FeedbackLabel;
  label_description:  string;
  operator_id:        string;
  platform?:          string;
  corrected_cause:    string | null;
  corrected_severity: string | null;
  comment:            string | null;
  anomaly_snapshot:   any;
  used_for_training:  boolean;
  created_at:         string;
  updated_at:         string;
}

export interface RetrainResult {
  status:                     string;
  reason?:                    string;
  current?:                   number;
  samples_used?:              number;
  false_positives_excluded?:  number;
  new_contamination?:         number;
  timestamp?:                 string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService extends BaseApiService {

  constructor(http: HttpClient) { super(http); }

  /**
   * POST /dashboard/feedback/anomaly/:id
   * Soumet le feedback d'un opérateur sur une anomalie
   */
  submitFeedback(
    anomalyId: string,
    feedback: FeedbackRequest,
  ): Observable<FeedbackResponse> {
    return this.post<FeedbackResponse>(
      `/dashboard/feedback/anomaly/${anomalyId}`,
      {
        label:               feedback.label,
        operator_id:         feedback.operator_id ?? 'noc_operator',
        corrected_cause:     feedback.corrected_cause ?? null,
        corrected_severity:  feedback.corrected_severity ?? null,
        comment:             feedback.comment ?? null,
      },
    );
  }

  /**
   * POST /dashboard/feedback/anomaly/batch
   * Soumet plusieurs feedbacks en une seule requête
   */
  submitBatch(
    feedbacks: Array<{ anomaly_id: string } & FeedbackRequest>,
  ): Observable<any> {
    return this.post('/dashboard/feedback/anomaly/batch', { feedbacks });
  }

  /** GET /dashboard/feedback/stats */
  getStats(platform?: string): Observable<FeedbackStats> {
    return this.get<FeedbackStats>('/dashboard/feedback/stats', { platform });
  }

  /**
   * GET /dashboard/feedback/pending
   * Anomalies en attente de validation (triées par score desc)
   */
  getPending(platform?: string, limit = 20): Observable<{ pending_count: number; anomalies: PendingAnomaly[] }> {
    return this.get('/dashboard/feedback/pending', { platform, limit });
  }

  /**
   * POST /dashboard/feedback/retrain
   * Déclenche un ré-entraînement avec les feedbacks accumulés
   */
  retrain(): Observable<RetrainResult> {
    return this.post<RetrainResult>('/dashboard/feedback/retrain');
  }

  /**
   * GET /dashboard/feedback/history/:operatorId
   */
  getOperatorHistory(
    operatorId: string,
    limit = 50,
  ): Observable<{ operator_id: string; feedbacks: FeedbackHistoryItem[]; count: number }> {
    return this.get(`/dashboard/feedback/history/${operatorId}`, { limit });
  }
}
