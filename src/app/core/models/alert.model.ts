// ───────────────────────────────────────────────────────────────────────────────
// MODELS / alert.model.ts
// ───────────────────────────────────────────────────────────────────────────────

import { SeverityLabel } from "./incident.model";

 
export type AlertType    = 'PLATFORM' | 'ANOMALY' | 'SYSTEM' | 'EMAIL';
export type AlertStatus  = 'new' | 'acknowledged' | 'resolved';
 
export interface AlertMetadata {
  platform?:            string;
  incident_severity?:   SeverityLabel;
  related_root_causes?: [string, number][];
  propagation_risk?:    string;
  [key: string]:        any;
}
 
export interface Alert {
  _id:                     string;
  type:                    AlertType;
  severity:                SeverityLabel;
  message:                 string;
  created_at:              string;
  status:                  AlertStatus;
  source:                  string;
  metadata?:               AlertMetadata;
  // Email tracking
  email_channel?:          string;
  email_recipients?:       string[];
  email_recipient_count?:  number;
  email_configured?:       boolean;
  email_tracking_status?:  string;
  // Enrichi côté front
  immediate_actions?:      string[];
  time_ago?:               string;
}
 
export interface AlertStats {
  total_alerts:            number;
  critical_or_high_alerts: number;
  new_alerts:              number;
  severity_breakdown:      { _id: SeverityLabel; count: number }[];
  type_breakdown:          { _id: AlertType; count: number }[];
}
 
/** Actions immédiates recommandées par plateforme */
export const PLATFORM_IMMEDIATE_ACTIONS: Record<string, string[]> = {
  MMG:   ['Vérifier connectivité MMG', 'Activer load balancing'],
  SMSC:  ['Vérifier capacité queue SMSC', 'Analyser sessions SMPP actives'],
  SMPPS: ['Redémarrer sessions SMPP', 'Augmenter timeout'],
  SMPPC: ['Vérifier connexions sortantes', 'Analyser les retries'],
  DMC:   ['Scaler workers DMC', 'Vérifier backlog'],
};