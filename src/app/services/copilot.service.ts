

// ═══════════════════════════════════════════════════════════════════════════════
// copilot.service.ts
// Endpoints : explain, copilot/ask

import { Injectable } from "@angular/core";
import { BaseApiService } from "./Base api.service";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable } from "rxjs";

// ═══════════════════════════════════════════════════════════════════════════════
export interface ExplainResponse {
  incident_id:           string;
  manager_summary:       string;
  technical_explanation: string;
  recommended_action:    string;
  source:                string;
  model:                 string;
  used_fallback:         boolean;
  warning?:              string;
  response_time_ms?:     number;
  timestamp?:            string;
}

export interface CopilotAskResponse {
  question:          string;
  answer:            string;
  source:            string;
  used_fallback:     boolean;
  model:             string;
  question_type?:    string;
  response_time_ms?: number;
  timestamp?:        string;
  from_cache?:       boolean;
  warning?:          string;
}

// copilot.service.ts
@Injectable({ providedIn: 'root' })
export class CopilotService extends BaseApiService {
  public modelName$: BehaviorSubject<string> = new BehaviorSubject<string>('chargement...');
  
  constructor(http: HttpClient) { 
    super(http); 
    this.loadModelConfig();
  }
  
  private loadModelConfig(): void {
    this.http.get<any>('/dashboard/copilot/model').subscribe({
      next: (config) => {
        this.modelName$.next(config.model);
        console.log(`🤖 Copilot using model: ${config.model}`);
      },
      error: () => {
        this.modelName$.next('phi3:mini');
        console.warn('Could not load model config, using default: phi3:mini');
      }
    });
  }


  /**
   * POST /dashboard/explain
   * Génère une explication LLM de l'incident (manager + technique + action)
   */
  explain(
    incidentId?: string | null,
    incidentData?: Record<string, any> | null,
  ): Observable<ExplainResponse> {
    return this.post<ExplainResponse>('/dashboard/explain', {
      incident_id:   incidentId ?? null,
      incident_data: incidentData ?? null,
    });
  }

  /**
   * POST /dashboard/copilot/ask
   * Pose une question libre au copilote IA sur un incident
   */
  ask(
    question: string,
    incidentId?: string | null,
    incidentData?: Record<string, any> | null,
  ): Observable<CopilotAskResponse> {
    return this.post<CopilotAskResponse>('/dashboard/copilot/ask', {
      question,
      incident_id:   incidentId ?? null,
      incident_data: incidentData ?? null,
    });
  }


}