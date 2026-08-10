// ═══════════════════════════════════════════════════════════════════════════════
// dashboard.service.ts
// Endpoints publics : overview, anomalies, RCA, timeline, heatmap,
//                     impact, duration, evolution, remediation, thresholds
// ═══════════════════════════════════════════════════════════════════════════════
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { BaseApiService } from './Base api.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OverviewData {
  total_logs:                  number;
  total_anomalies:             number;
  total_incidents:             number;
  total_alerts:                number;
  total_evolution_predictions: number;
  total_remediations:          number;
  total_similar_incidents:     number;
  latest_severity:             string | null;
}

export type DashboardOverview = OverviewData;

export interface Anomaly {
  _id:                          string;
  timestamp:                    string;
  platform:                     string;
  message:                      string;
  anomaly_score:                number;
  threshold_used:               number;
  threshold_type:               string;
  severity?:                    string;
  rca?:                         string;
  action?:                      string;
  impact?:                      string;
  predicted_resolution_minutes?: number;
  propagation_stage?:            number;
}

export interface RcaData {
  timestamp?:         string;
  summary?:           string;
  root_causes:        [string, number][];
  severity_label?:    string;
  affected_platforms?: string[];
}

export interface ImpactData {
  severity_label?:           string;
  affected_platforms?:       string[];
  sms_delivery_degradation?: string;
  propagation_risk?:         string;
  customer_impact?:          string;
  spread_score?:             number;
}

export interface DurationData {
  estimated_resolution_minutes?: number;
  recovery_complexity?:          string;
  incident_stability?:           string;
  escalation_probability?:       string;
  confidence_score?:             number;
}

export interface EvolutionData {
  severity?:                   string;
  risk_score?:                 number;
  will_spread_more?:           boolean;
  will_touch_new_platform?:    boolean;
  severity_likely_to_increase?: boolean;
  more_anomalies_expected?:    boolean;
  next_possible_platform?:     string;
  propagation_path?:           string[];
}

export interface RemediationData {
  recommended_actions: string[];
  severity?:           string;
  affected_platforms?: string[];
  action_count?:       number;
}

export interface ThresholdReport {
  platform:          string;
  hour:              number;
  weekday:           number;
  period:            string;
  day_type:          string;
  base_threshold:    number;
  hour_modifier:     number;
  weekday_modifier:  number;
  volume_modifier:   number;
  final_threshold:   number;
  percentile_95:     number | null;
  recommendation:    string;
}

export interface SystemStatus {
  api_status:                         string;
  mongo_status:                       string;
  email_alerting_status:              string;
  watched_collections:                Record<string, number>;
  latest_incident_severity:           string | null;
  latest_customer_impact:             string | null;
  latest_estimated_resolution_minutes: number | null;
  checked_at:                         string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DashboardService extends BaseApiService {

  constructor(http: HttpClient) { super(http); }

  /** GET /dashboard/intelligence */
getIntelligence(): Observable<any> {
  return this.get<any>('/dashboard/intelligence');
}

  /** GET /dashboard/overview */
  getOverview(): Observable<OverviewData> {
    return this.get<OverviewData>('/dashboard/overview');
  }

  /** GET /dashboard/anomalies */
  getAnomalies(): Observable<Anomaly[]> {
    return this.get<Anomaly[]>('/dashboard/anomalies');
  }

  /** GET /dashboard/rca */
  getRca(): Observable<RcaData[]> {
    return this.get<RcaData[]>('/dashboard/rca');
  }

  /** GET /dashboard/timeline */
  getTimeline(): Observable<any[]> {
    return this.get<any[]>('/dashboard/timeline');
  }

  /** GET /dashboard/heatmap */
  getHeatmap(): Observable<{ _id: string; count: number }[]> {
    return this.get<{ _id: string; count: number }[]>('/dashboard/heatmap');
  }

  /** GET /dashboard/impact */
  getImpact(): Observable<ImpactData> {
    return this.get<ImpactData>('/dashboard/impact');
  }

  /** GET /dashboard/duration */
  getDuration(): Observable<DurationData> {
    return this.get<DurationData>('/dashboard/duration');
  }

  /** GET /dashboard/evolution */
  getEvolution(): Observable<EvolutionData> {
    return this.get<EvolutionData>('/dashboard/evolution');
  }

  /** GET /dashboard/remediation */
  getRemediation(): Observable<RemediationData> {
    return this.get<RemediationData>('/dashboard/remediation');
  }

  /** GET /dashboard/predictions */
  getPredictions(): Observable<{ duration_prediction: DurationData; impact_prediction: ImpactData }> {
    return this.get('/dashboard/predictions');
  }

  /** GET /dashboard/thresholds/:platform */
  getThresholdInfo(
    platform: string,
    hour?: number,
    weekday?: number,
    logVolume?: number,
  ): Observable<ThresholdReport> {
    return this.get<ThresholdReport>(`/dashboard/thresholds/${platform}`, {
      hour, weekday, log_volume: logVolume,
    });
  }

  /** GET /dashboard/system-status */
  getSystemStatus(): Observable<SystemStatus> {
    return this.get<SystemStatus>('/dashboard/system-status');
  }

  /** GET /dashboard/email-alerts */
  getEmailAlerts(): Observable<any> {
    return this.get('/dashboard/email-alerts');
  }
}
