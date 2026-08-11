// ═══════════════════════════════════════════════════════════════════════════════
// incident.service.ts
// Endpoints : incidents list, intelligence snapshot, history
// ═══════════════════════════════════════════════════════════════════════════════
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { BaseApiService } from './Base api.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RootCause {
  root_causes:            [string, number][];
  count:                  number;
  affected_platforms?:    string[];
  platform_counts?:       [string, number][];
  root_platform_analysis?: RootPlatformAnalysis;
  cascade_validation?:    CascadeValidation;
}

export interface RootPlatformAnalysis {
  root_platform: string;
  confidence:    string;
  candidates:    PlatformCandidate[];
}

export interface PlatformCandidate {
  platform:          string;
  criticality:       string;
  dependency_count:  number;
  known_failures:    string[];
  recovery_minutes:  number;
}

export interface CascadeValidation {
  cascade:         string[];
  coherence_score: number;
  valid_steps:     number;
  invalid_steps:   number;
  steps:           { step: string; valid: boolean; reason: string }[];
  verdict:         string;
}

export interface IncidentTimeline {
  timeline:            string[];
  summary:             string;
  topology_aware?:     boolean;
  cascade_validation?: CascadeValidation;
}

export interface IncidentSeverity {
  label:           string;
  score:           number;
  explanation?:    { severity: string; reasons: string[] };
  recommendations: string[];
}

export interface IncidentImpact {
  affected_platforms:       string[];
  severity:                 string;
  sms_delivery_degradation: string;
  propagation_risk:         string;
}

export interface IncidentIntelligence {
  summary:                  string;
  timeline:                 string[];
  topology_aware?:          boolean;
  severity_label:           string;
  severity_score:           number;
  severity_reasons:         string[];
  recommended_actions:      string[];
  affected_platforms:       string[];
  sms_delivery_degradation: string;
  propagation_risk:         string;
  cluster_count:            number;
  causal_relation_count:    number;
  top_root_causes:          [string, number][];
}

export interface Incident {
  _id:                  string;
  created_at:           string;
  status:               string;
  resolved_at:          string | null;
  resolved_by?:         string | null;
  resolution_note?:     string | null;
  resolution_method?:   string | null;
  total_logs:           number;
  total_anomalies:      number;
  clusters:             number;
  causal_links:         number;
  platforms:            string[];
  root_cause:           RootCause;
  timeline:             IncidentTimeline;
  impact:               IncidentImpact;
  severity:             IncidentSeverity;
  incident_intelligence?: IncidentIntelligence;
}

export interface IncidentHistoryResponse {
  incidents:               Incident[];
  intelligence_snapshots:  IncidentIntelligence[];
  incident_count:          number;
  snapshot_count:          number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class IncidentService extends BaseApiService {

  constructor(http: HttpClient) { super(http); }

  /** GET /dashboard/incidents — liste des incidents actifs */
  getIncidents(): Observable<Incident[]> {
    return this.get<Incident[]>('/dashboard/incidents');
  }

  /** GET /dashboard/intelligence — snapshot d'intelligence */
  getIntelligence(): Observable<IncidentIntelligence> {
    return this.get<IncidentIntelligence>('/dashboard/intelligence');
  }

  /** GET /dashboard/incidents/history — historique + snapshots */
  getHistory(): Observable<IncidentHistoryResponse> {
    return this.get<IncidentHistoryResponse>('/dashboard/incidents/history');
  }

  /** POST /dashboard/incidents/:id/resolve — résolution manuelle */
  resolveIncident(
    incidentId: string,
    payload: {
      resolved_by?: string;
      resolution_note?: string | null;
      resolution_method?: string;
    } = {},
  ): Observable<Incident> {
    return this.post<Incident>(
      `/dashboard/incidents/${incidentId}/resolve`,
      {
        resolved_by: payload.resolved_by ?? 'operator',
        resolution_note: payload.resolution_note ?? null,
        resolution_method: payload.resolution_method ?? 'manual',
      },
    );
  }
}
