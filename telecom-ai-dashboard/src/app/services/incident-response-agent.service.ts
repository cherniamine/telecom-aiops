import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseApiService } from './Base api.service';

export type InvestigationSeverity = 'low' | 'medium' | 'high' | 'critical';
export type EvidenceType = 'log' | 'metric' | 'similar_incident' | 'rca_signal';

export interface InvestigationRequest {
  incident_id: string;
  service: string;
  alert: string;
  severity: InvestigationSeverity;
  started_at?: string | null;
}

export interface InvestigationEvidence {
  type: EvidenceType;
  source: string;
  reference: string;
  detail: string;
  timestamp?: string | null;
  content?: string | null;
  relevance?: number | null;
}

export interface ConfidenceComponent {
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface ConfidenceBreakdown {
  signals: ConfidenceComponent[];
  penalties: ConfidenceComponent[];
  raw_score: number;
  final_score: number;
}

export interface LlmReasoning {
  proposed_explanation: string;
  supporting_evidence_references: string[];
  uncertainty: string;
  unsupported_claims: string[];
  source: 'ollama' | 'heuristic';
}

export interface InvestigationReport {
  incident_id: string;
  root_cause: string;
  confidence: number;
  evidence: InvestigationEvidence[];
  recommended_action: string;
  requires_approval: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  status: 'investigated' | 'degraded' | 'insufficient_data';
  degraded_components: string[];
  llm_reasoning?: LlmReasoning | null;
  confidence_breakdown?: ConfidenceBreakdown | null;
}

export interface InvestigationSnapshot {
  _id: string;
  incident_id: string;
  request: InvestigationRequest;
  report: InvestigationReport;
  created_at: string;
}

export interface InvestigationHistoryResponse {
  incident_id: string;
  investigations: InvestigationSnapshot[];
  count: number;
}

export interface InvestigationComparison {
  incident_id: string;
  baseline: InvestigationSnapshot;
  candidate: InvestigationSnapshot;
  changes: {
    confidence_delta: number | null;
    root_cause_changed: boolean | null;
    evidence_count_delta: number | null;
    new_evidence_references: string[];
    removed_evidence_references: string[];
    new_degraded_components: string[];
    recovered_components: string[];
    missing_data: string[];
  };
}

@Injectable({ providedIn: 'root' })
export class IncidentResponseAgentService extends BaseApiService {
  constructor(http: HttpClient) { super(http); }

  /** POST /agent/investigate — read-only investigation, never remediation. */
  investigate(request: InvestigationRequest): Observable<InvestigationReport> {
    return this.post<InvestigationReport>('/agent/investigate', request);
  }

  getHistory(incidentId: string, limit = 20): Observable<InvestigationHistoryResponse> {
    return this.get<InvestigationHistoryResponse>(`/agent/investigations/${incidentId}`, { limit });
  }

  compareHistory(
    incidentId: string, baselineId: string, candidateId: string,
  ): Observable<InvestigationComparison> {
    return this.get<InvestigationComparison>(`/agent/investigations/${incidentId}/compare`, {
      baseline_id: baselineId,
      candidate_id: candidateId,
    });
  }
}
