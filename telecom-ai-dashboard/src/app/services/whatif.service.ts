
// ═══════════════════════════════════════════════════════════════════════════════
// whatif.service.ts
// Endpoints : overview, actions, simulate, compare, best-action, history

import { Injectable } from "@angular/core";
import { BaseApiService } from "./Base api.service";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

// ═══════════════════════════════════════════════════════════════════════════════
export interface WhatIfAction {
  id:          string;
  label:       string;
  description: string;
  targets:     string[];
  parameters:  Record<string, { type: string; default: number | string; min?: number; max?: number }>;
}

export interface SimulationBefore {
  mttr_minutes:       number;
  severity:           string;
  anomaly_count:      number;
  affected_platforms: string[];
  sms_degradation:    string;
}

export interface SimulationAfter {
  mttr_minutes:           number;
  mttr_reduction:         number;
  mttr_reduction_pct:     number;
  expected_severity:      string;
  anomaly_reduction_pct:  number;
  sms_recovery_pct:       number;
  platforms_recovered:    string[];
}

export interface SimulationRisk {
  level:       string;
  description: string;
  mitigation:  string;
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
  confidence_label:   string;
  confidence_reason:  string;
  risks:              SimulationRisk[];
  risk_level:         string;
  recommendation:     string;
  top_alternatives:   { action_id: string; action_label: string; mttr_after: number; mttr_reduction_pct: number }[];
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

@Injectable({ providedIn: 'root' })
export class WhatIfService extends BaseApiService {

  constructor(http: HttpClient) { super(http); }

  /** GET /dashboard/what-if */
  getOverview(): Observable<any> {
    return this.get('/dashboard/what-if');
  }

  /** GET /dashboard/what-if/actions */
  getActions(): Observable<{ actions: WhatIfAction[] }> {
    return this.get<{ actions: WhatIfAction[] }>('/dashboard/what-if/actions');
  }

  /**
   * POST /dashboard/what-if/simulate
   * Simule l'impact d'une action sur un incident
   */
  simulate(
    incidentId: string,
    actionId:   string,
    parameters?: Record<string, any>,
  ): Observable<SimulationResult> {
    return this.post<SimulationResult>('/dashboard/what-if/simulate', {
      incident_id: incidentId,
      action_id:   actionId,
      parameters:  parameters ?? null,
    });
  }

  /**
   * POST /dashboard/what-if/compare
   * Compare plusieurs actions sur un incident
   */
  compare(
    incidentId: string,
    actionIds?: string[],
  ): Observable<CompareResponse> {
    return this.post<CompareResponse>('/dashboard/what-if/compare', {
      incident_id: incidentId,
      action_ids:  actionIds ?? null,
    });
  }

  /**
   * GET /dashboard/what-if/best-action/:incidentId
   * Meilleure action pour un incident (ou "latest")
   */
  getBestAction(incidentId: string | 'latest'): Observable<BestActionResponse> {
    return this.get<BestActionResponse>(`/dashboard/what-if/best-action/${incidentId}`);
  }

  /**
   * GET /dashboard/what-if/history/:incidentId
   * Historique des simulations pour un incident
   */
  getHistory(incidentId: string, limit = 10): Observable<any> {
    return this.get(`/dashboard/what-if/history/${incidentId}`, { limit });
  }
}
