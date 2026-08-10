export type SeverityLabel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type IncidentStatus = 'open' | 'resolved' | 'acknowledged' | 'WAITING_HUMAN_VALIDATION';
 
export interface RootCauseKeyword {
  keyword: string;
  count:   number;
}
 
export interface PlatformCount {
  platform: string;
  count:    number;
}
 
export interface CascadeStep {
  step:   string;
  valid:  boolean;
  reason: string;
}
 
export interface CascadeValidation {
  cascade:         string[];
  coherence_score: number;
  valid_steps:     number;
  invalid_steps:   number;
  steps:           CascadeStep[];
  verdict:         'VALID_CASCADE' | 'PARTIAL_CASCADE' | 'INVALID_CASCADE';
}
 
export interface PlatformCandidate {
  platform:          string;
  criticality:       string;
  dependency_count:  number;
  known_failures:    string[];
  recovery_minutes:  number;
}
 
export interface RootPlatformAnalysis {
  root_platform: string;
  confidence:    'HIGH' | 'MEDIUM' | 'LOW';
  candidates:    PlatformCandidate[];
}
 
export interface RootCause {
  root_causes:           [string, number][];
  raw_root_causes?:      [string, number][];
  count:                 number;
  affected_platforms?:   string[];
  platform_counts?:      [string, number][];
  root_platform_analysis?: RootPlatformAnalysis;
  cascade_validation?:   CascadeValidation;
  weighted_causal_links?: any[];
}
 
export interface IncidentTimeline {
  timeline:            string[];
  summary:             string;
  topology_aware?:     boolean;
  cascade_validation?: CascadeValidation;
  root_platform_analysis?: RootPlatformAnalysis;
  weighted_causal_links?: any[];
}
 
export interface IncidentSeverityExplanation {
  severity: SeverityLabel;
  reasons:  string[];
}
 
export interface IncidentSeverity {
  label:           SeverityLabel;
  score:           number;
  explanation?:    IncidentSeverityExplanation;
  recommendations: string[];
}
 
export interface IncidentImpact {
  affected_platforms:       string[];
  severity:                 SeverityLabel;
  sms_delivery_degradation: 'HIGH' | 'MEDIUM' | 'LOW';
  propagation_risk:         'HIGH' | 'MEDIUM' | 'LOW';
}
 
export interface IncidentIntelligence {
  summary:                  string;
  timeline:                 string[];
  topology_aware?:          boolean;
  cascade_validation?:      CascadeValidation;
  root_platform_analysis?:  RootPlatformAnalysis;
  severity_label:           SeverityLabel;
  severity_score:           number;
  severity_reasons:         string[];
  recommended_actions:      string[];
  affected_platforms:       string[];
  sms_delivery_degradation: string;
  propagation_risk:         string;
  cluster_count:            number;
  causal_relation_count:    number;
  top_root_causes:          [string, number][];
  total_logs?:              number;
  total_anomalies?:         number;
  timestamp?:               string;
}
 
export interface Incident {
  _id:                  string;
  created_at:           string;
  status:               IncidentStatus;
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
  recommended_actions?: string[];
}
 
export interface IncidentHistoryResponse {
  incidents:              Incident[];
  intelligence_snapshots: IncidentIntelligence[];
  incident_count:         number;
  snapshot_count:         number;
}
 
/** Helper : extrait la liste ordonnée de plateformes depuis un incident */
export function getIncidentTimeline(incident: Incident): string[] {
  return incident.timeline?.timeline
    ?? incident.incident_intelligence?.timeline
    ?? incident.platforms
    ?? [];
}
 
/** Helper : index de la plateforme racine dans la cascade */
export function getRootPlatformIndex(incident: Incident): number {
  const root = incident.root_cause?.root_platform_analysis?.root_platform;
  if (!root) return 0;
  const tl = getIncidentTimeline(incident);
  const idx = tl.findIndex(p => p.toUpperCase() === root.toUpperCase());
  return idx >= 0 ? idx : 0;
}
 
