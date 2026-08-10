// ───────────────────────────────────────────────────────────────────────────────
// MODELS / anomaly.model.ts
// ───────────────────────────────────────────────────────────────────────────────

import { SeverityLabel } from "./incident.model";

 
export type FeedbackLabel =
  | 'true_positive'
  | 'false_positive'
  | 'uncertain'
  | 'corrected_cause';
 
export interface AnomalyModel {
  score:      number;
  confidence: number;
  model:      string;
}
 
export interface Anomaly {
  _id:                           string;
  log_index?:                    number;
  timestamp:                     string;
  platform:                      string;
  message:                       string;
  anomaly_score:                 number;
  threshold_used?:               number;
  threshold_type?:               string;
  status:                        'open' | 'resolved' | 'acknowledged';
  model?:                        AnomalyModel;
  // Champs enrichis par DashboardService.getAnomalies()
  severity?:                     SeverityLabel;
  rca?:                          string;
  root_cause?:                   string;
  action?:                       string;
  recommended_action?:           string;
  impact?:                       string;
  impact_level?:                 string;
  predicted_resolution_minutes?: number;
  propagation_stage?:            number;
  // Feedback
  feedback_label?:               FeedbackLabel;
  feedback_at?:                  string;
  feedback_operator?:            string;
  // Urgency (calculé côté front)
  urgency?:                      'URGENT' | 'HIGH' | 'NORMAL';
}
 
export interface AnomalyFeedbackSnapshot {
  log_index?:     number;
  platform:       string;
  message:        string;
  anomaly_score:  number;
  score?:         number;
  threshold_used?: number;
  threshold_type?: string;
  detected_at?:   string;
}
 
export interface AnomalyFeedback {
  _id:                string;
  anomaly_id:         string;
  label:              FeedbackLabel;
  label_description:  string;
  operator_id:        string;
  platform?:          string;
  corrected_cause:    string | null;
  corrected_severity: string | null;
  comment:            string | null;
  anomaly_snapshot:   AnomalyFeedbackSnapshot;
  used_for_training:  boolean;
  created_at:         string;
  updated_at:         string;
}
 
/** Calcule l'urgence d'une anomalie selon son score */
export function getAnomalyUrgency(score: number): 'URGENT' | 'HIGH' | 'NORMAL' {
  if (score >= 0.85) return 'URGENT';
  if (score >= 0.70) return 'HIGH';
  return 'NORMAL';
}
 
/** Formate le score en pourcentage lisible */
export function formatAnomalyScore(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}
 