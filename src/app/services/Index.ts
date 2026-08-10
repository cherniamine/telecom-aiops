// ═══════════════════════════════════════════════════════════════════════════════
// services/index.ts  — barrel exports
// Importer depuis : import { DashboardService, FeedbackService } from '../services'
// ═══════════════════════════════════════════════════════════════════════════════

// Base
export { BaseApiService } from './Base api.service';

// Auth
export { AuthService }    from './Auth.service';
export type { AuthUser, LoginResponse } from './Auth.service';

// Dashboard
export { DashboardService } from './Dashboard.service';
export type {
  OverviewData, Anomaly, RcaData, ImpactData, DurationData,
  EvolutionData, RemediationData, ThresholdReport, SystemStatus,
  DashboardOverview,
} from './Dashboard.service';

// Incidents
export { IncidentService } from './Incident.service';
export type {
  Incident, IncidentIntelligence, IncidentHistoryResponse,
  RootCause, CascadeValidation, RootPlatformAnalysis,
} from './Incident.service';

// Alerts
export { AlertService } from './alert.service';
export type { Alert, AlertStats } from './alert.service';

// FAISS
export { FaissService } from './faiss.service';
export type {
  FaissStats, FaissBuildStatus, SimilarLog,
  SimilarLogsResponse, SimilarIncident, SimilarIncidentsResponse,
} from './faiss.service';

// What-If
export { WhatIfService } from './whatif.service';
export type {
  WhatIfAction, SimulationResult, CompareResponse, BestActionResponse,
  SimulationBefore, SimulationAfter, SimulationRisk,
} from './whatif.service';

// Feedback
export { FeedbackService } from './feedback.service';
export type {
  FeedbackLabel, FeedbackRequest, FeedbackResponse,
  FeedbackStats, PendingAnomaly, FeedbackHistoryItem, RetrainResult,
} from './feedback.service';

// Drift
export { DriftService } from './drift.service';
export type {
  DriftReference, DriftReport, DriftOverview, DriftTestResult,
} from './drift.service';

// Copilot
export { CopilotService } from './copilot.service';
export type {
  ExplainResponse, CopilotAskResponse,
} from './copilot.service';

// NOC
export { NocService } from './noc.service';
export type {
  NocAlert, NocAlertsResponse, NocQueueItem, NocQueueResponse,
  PlatformRealtimeStatus, NocRealtimeResponse,
} from './noc.service';

// Manager
export { ManagerService } from './manager.service';
export type {
  ManagerKpis, ManagerTrends, ManagerSlaReport,
  DailyTrendPoint, PlatformTrendPoint, SlaResult,
} from './manager.service';

// Engineer
export { EngineerService } from './engineer.service';
export type {
  EngineerMlMetrics, EngineerIncidentDetails,
  RawLog, RawLogsResponse, ModelInfo,
} from './engineer.service';
