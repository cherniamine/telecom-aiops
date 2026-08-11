// ───────────────────────────────────────────────────────────────────────────────
// MODELS / whatif.model.ts
// ───────────────────────────────────────────────────────────────────────────────

import { SeverityLabel } from "./incident.model";

 
export interface WhatIfActionParam {
  type:     'float' | 'int' | 'str';
  default:  number | string;
  min?:     number;
  max?:     number;
}
 
export interface WhatIfAction {
  id:          string;
  label:       string;
  description: string;
  targets:     string[];
  parameters:  Record<string, WhatIfActionParam>;
}
 
export interface SimulationBefore {
  mttr_minutes:       number;
  severity:           SeverityLabel;
  anomaly_count:      number;
  affected_platforms: string[];
  sms_degradation:    string;
}
 
export interface SimulationAfter {
  mttr_minutes:            number;
  mttr_reduction:          number;
  mttr_reduction_pct:      number;
  expected_severity:       SeverityLabel;
  anomaly_reduction_pct:   number;
  sms_recovery_pct:        number;
  platforms_recovered:     string[];
  platforms_protected?:    string[];
}
 
export interface SimulationRisk {
  level:       'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  mitigation:  string;
}
 
export interface SimulationAlternative {
  action_id:           string;
  action_label:        string;
  mttr_after:          number;
  mttr_reduction_pct:  number;
}
 
export interface SimulationResult {
  simulation_id:      string;
  action_id:          string;
  action_label:       string;
  parameters_used:    Record<string, any>;
  timestamp:          string;
  before:             SimulationBefore;
  after:              SimulationAfter;
  confidence:         number;
  confidence_label:   'HIGH' | 'MEDIUM' | 'LOW' | 'FAIBLE' | 'MOYENNE' | 'HAUTE';
  confidence_reason:  string;
  risks:              SimulationRisk[];
  risk_level:         'LOW' | 'MEDIUM' | 'HIGH';
  recommendation:     string;
  top_alternatives:   SimulationAlternative[];
  incident_id?:       string;
  created_at?:        string;
}
 
export interface ComparisonRow {
  action_id:           string;
  action_label:        string;
  mttr_before:         number;
  mttr_after:          number;
  mttr_reduction_pct:  number;
  confidence:          number;
  confidence_label:    string;
  risk_level:          string;
  recommendation:      string;
}
 
export interface CompareResponse {
  incident_mttr_baseline: number;
  actions_compared:       number;
  best_action:            ComparisonRow | null;
  comparison_table:       ComparisonRow[];
  timestamp:              string;
}
 
export interface BestActionResponse {
  incident_id:            string;
  incident_mttr_baseline: number;
  actions_compared:       number;
  best_action:            ComparisonRow;
  top_actions:            ComparisonRow[];
  timestamp:              string;
}
 
/** Couleur Tailwind selon le niveau de risque */
export function getRiskColor(level: string): string {
  const map: Record<string, string> = {
    LOW:    '#22c55e',
    MEDIUM: '#f59e0b',
    HIGH:   '#ef4444',
  };
  return map[level?.toUpperCase()] ?? '#94a3b8';
}
 
/** Calcule la réduction MTTR en pourcentage formaté */
export function formatMttrReduction(before: number, after: number): string {
  if (!before) return '0%';
  const pct = Math.round(((before - after) / before) * 100);
  return `−${pct}%`;
}