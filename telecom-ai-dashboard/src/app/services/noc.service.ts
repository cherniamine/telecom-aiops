// ═══════════════════════════════════════════════════════════════════════════════
// noc.service.ts
// Endpoints rôle NOC : alerts, queue, realtime status
// ═══════════════════════════════════════════════════════════════════════════════
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { BaseApiService } from './Base api.service';

export interface NocAlert {
  _id:               string;
  type:              string;
  severity:          string;
  message:           string;
  created_at:        string;
  status:            string;
  source:            string;
  metadata?:         { 
    platform?: string; 
    incident_severity?: string; 
    propagation_risk?: string;
    predicted_resolution_minutes?: number;  
    alert_rank_score?: number;              
    operator_priority?: string;             
  };
  immediate_actions: string[];
  time_ago:          string;
}

export interface NocAlertsResponse {
  role:           string;
  generated_at:   string;
  active_alerts:  number;
  critical_count: number;
  high_count:     number;
  alerts:         NocAlert[];
}

export interface NocQueueItem {
  _id:            string;
  timestamp:      string;
  platform:       string | null;
  message:        string;
  anomaly_score:  number;
  threshold_used?: number;
  threshold_type?: string;
  status:         string;
  urgency:        'URGENT' | 'HIGH' | 'NORMAL' | null;
  feedback_labels?: string[];
  model?:         { score: number; confidence: number; model: string };
}

export interface NocQueueResponse {
  role:          string;
  pending_count: number;
  urgent_count:  number;
  queue:         NocQueueItem[];
}

export interface PlatformRealtimeStatus {
  platform:      string;
  status:        'OK' | 'WARNING' | 'DEGRADED' | 'CRITICAL';
  anomalies_1h:  number;
  active_alerts: number;
  last_checked:  string;
}

export interface NocRealtimeResponse {
  role:           string;
  overall_status: string;
  platforms:      PlatformRealtimeStatus[];
  generated_at:   string;
}

@Injectable({ providedIn: 'root' })
export class NocService extends BaseApiService {

  constructor(http: HttpClient) { super(http); }

  /**
   * GET /dashboard/noc/alerts
   * Alertes CRITICAL et HIGH temps réel avec actions immédiates
   */
  getAlerts(limit = 20, platform?: string): Observable<NocAlertsResponse> {
    return this.get<NocAlertsResponse>('/dashboard/noc/alerts', { limit, platform });
  }

  /**
   * GET /dashboard/noc/queue
   * File d'anomalies en attente de validation par l'opérateur NOC
   */
  getQueue(limit = 30): Observable<NocQueueResponse> {
    return this.get<NocQueueResponse>('/dashboard/noc/queue', { limit });
  }

  /**
   * GET /dashboard/noc/realtime
   * Statut temps réel de toutes les plateformes (MMG/SMSC/SMPPS/SMPPC/DMC)
   */
  getRealtime(): Observable<NocRealtimeResponse> {
    return this.get<NocRealtimeResponse>('/dashboard/noc/realtime');
  }
}
