// ═══════════════════════════════════════════════════════════════════════════════
// manager.service.ts
// Endpoints rôle Manager : KPIs, trends, SLA report

import { Observable } from "rxjs";
import { BaseApiService } from "./Base api.service";
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";

// ═══════════════════════════════════════════════════════════════════════════════
export interface ManagerKpis {
  role:         string;
  period:       string;
  generated_at: string;
  incidents: {
    total:    number;
    critical: number;
    high:     number;
  };
  performance: {
    mttr_avg_minutes:    number;
    mttr_target_minutes: number;
    sla_compliance_pct:  number;
    sla_status:          string;
  };
  financial: {
    baseline_mttr_minutes: number;
    estimated_savings_eur: number;
  };
  ai_quality: {
    model_precision_pct:    string;
    false_positive_rate:    string;
    feedbacks_collected:    number;
    anomaly_detection_rate: string;
  };
  platforms_health: {
    healthy:  number;
    degraded: number;
    critical: number;
  };
}
 
export interface DailyTrendPoint {
  date:     string;
  total:    number;
  critical: number;
}
 
export interface PlatformTrendPoint {
  platform: string;
  count:    number;
}
 
export interface ManagerTrends {
  role:                    string;
  period_days:             number;
  daily_incidents:         DailyTrendPoint[];
  anomalies_by_platform:   PlatformTrendPoint[];
  generated_at:            string;
}
 
export interface SlaResult {
  incident_id: string;
  severity:    string;
  sla_target:  number;
  actual_mttr: number;
  sla_met:     boolean;
  platforms:   string[];
}
 
export interface ManagerSlaReport {
  role:            string;
  sla_compliance:  number;
  total_incidents: number;
  sla_met:         number;
  sla_missed:      number;
  by_severity:     Record<string, { count: number; met: number }>;
  details:         SlaResult[];
  generated_at:    string;
}
 
@Injectable({ providedIn: 'root' })
export class ManagerService extends BaseApiService {
 
  constructor(http: HttpClient) { super(http); }
 
  /**
   * GET /dashboard/manager/kpis
   * KPIs synthétiques : MTTR, SLA, économies, qualité IA
   */
  getKpis(): Observable<ManagerKpis> {
    return this.get<ManagerKpis>('/dashboard/manager/kpis');
  }
 
  /**
   * GET /dashboard/manager/trends?days=30
   * Tendances incidents/anomalies sur N jours
   */
  getTrends(days = 30): Observable<ManagerTrends> {
    return this.get<ManagerTrends>('/dashboard/manager/trends', { days });
  }
 
  /**
   * GET /dashboard/manager/sla-report
   * Rapport SLA mensuel détaillé par sévérité
   */
  getSlaReport(): Observable<ManagerSlaReport> {
    return this.get<ManagerSlaReport>('/dashboard/manager/sla-report');
  }
}