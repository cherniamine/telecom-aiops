// ═══════════════════════════════════════════════════════════════════════════════
// alert.service.ts
// GET /dashboard/alerts  +  /dashboard/alerts/stats
// ═══════════════════════════════════════════════════════════════════════════════
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { BaseApiService } from './Base api.service';

export interface Alert {
  _id:        string;
  type:       string;
  severity:   string;
  message:    string;
  created_at: string;
  status:     string;
  source:     string;
  metadata?:  {
    platform?:                    string;
    incident_severity?:           string;
    related_root_causes?:         [string, number][];
    propagation_risk?:            string;
    immediate_actions?:           string[];
    predicted_resolution_minutes?: number;
    operator_priority?:           string;
  };
  email_configured?:       boolean;
  email_recipients?:       string[];
  email_tracking_status?:  string;
}

export interface AlertStats {
  total_alerts:          number;
  critical_or_high_alerts: number;
  new_alerts:            number;
  severity_breakdown:    { _id: string; count: number }[];
  type_breakdown:        { _id: string; count: number }[];
}

@Injectable({ providedIn: 'root' })
export class AlertService extends BaseApiService {

  constructor(http: HttpClient) { super(http); }

  /** GET /dashboard/alerts */
  getAlerts(): Observable<Alert[]> {
    return this.get<Alert[]>('/dashboard/alerts');
  }

  /** GET /dashboard/alerts/stats */
  getAlertStats(): Observable<AlertStats> {
    return this.get<AlertStats>('/dashboard/alerts/stats');
  }
}
