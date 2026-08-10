// ═══════════════════════════════════════════════════════════════════════════════
// faiss.service.ts
// Endpoints : stats, build-status, search by text, by index, by embedding,
//             similar incidents by id

import { Injectable } from "@angular/core";
import { BaseApiService } from "./Base api.service";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

// ═══════════════════════════════════════════════════════════════════════════════
export interface FaissStats {
  available:           boolean;
  dimension:           number;
  embeddings_path:     string;
  embeddings_exists:   boolean;
  dataset_path:        string;
  dataset_exists:      boolean;
  index_path:          string;
  index_exists:        boolean;
  total_vectors:       number;
  index_loaded:        boolean;
  index_type:          string | null;
  nprobe:              number | null;
  index_size_mb:       number | null;
  build_status:        string;
  build_progress_pct:  number;
  processed_vectors:   number;
}

export interface FaissBuildStatus {
  status:           string;
  message:          string | null;
  error:            string | null;
  started_at:       string | null;
  finished_at:      string | null;
  progress_pct:     number;
  processed_vectors: number;
  total_vectors:    number;
  index_exists:     boolean;
}

export interface SimilarLog {
  log_index:         number;
  distance:          number;
  similarity_score:  number;
  platform:          string;
  message:           string;
  timestamp:         string | null;
  level:             string;
  is_anomaly:        boolean;
  incident_id:       string | null;
  source_collection: string;
}

export interface SimilarLogsResponse {
  query?:            string;
  results:           SimilarLog[];
  count:             number;
  search_timestamp:  string;
}

export interface SimilarIncident {
  incident_id:  string;
  created_at:   string | null;
  severity:     string;
  timeline:     string[];
  top_causes:   [string, number][];
  similarity:   number;
}

export interface SimilarIncidentsResponse {
  current_incident_id: string;
  similar_incidents:   SimilarIncident[];
  count:               number;
  search_timestamp:    string;
}

@Injectable({ providedIn: 'root' })
export class FaissService extends BaseApiService {

  constructor(http: HttpClient) { super(http); }

  /** GET /dashboard/faiss/stats */
  getStats(): Observable<FaissStats> {
    return this.get<FaissStats>('/dashboard/faiss/stats');
  }

  /** GET /dashboard/faiss/build-status */
  getBuildStatus(): Observable<FaissBuildStatus> {
    return this.get<FaissBuildStatus>('/dashboard/faiss/build-status');
  }

  /** POST /dashboard/faiss/build */
  buildIndex(forceRebuild = false, background = true): Observable<any> {
    return this.post('/dashboard/faiss/build', null);
  }

  /**
   * POST /dashboard/similar-logs/search
   * Recherche sémantique par texte libre (Google-like)
   */
  searchByText(
    query: string,
    k = 5,
    platformFilter?: string,
  ): Observable<SimilarLogsResponse> {
    return this.post<SimilarLogsResponse>('/dashboard/similar-logs/search', {
      query,
      k,
      platform_filter: platformFilter ?? null,
    });
  }

  /**
   * GET /dashboard/similar-logs/:logIndex
   * Logs similaires à un index existant
   */
  searchByIndex(
    logIndex: number,
    k = 5,
    platform?: string,
  ): Observable<SimilarLogsResponse> {
    return this.get<SimilarLogsResponse>(
      `/dashboard/similar-logs/${logIndex}`,
      { k, platform },
    );
  }

  /**
   * POST /dashboard/similar-logs/embedding
   * Recherche par vecteur d'embedding brut
   */
  searchByEmbedding(
    embedding: number[],
    k = 5,
    platformFilter?: string,
  ): Observable<SimilarLogsResponse> {
    return this.post<SimilarLogsResponse>('/dashboard/similar-logs/embedding', {
      embedding,
      k,
      platform_filter: platformFilter ?? null,
    });
  }

  /**
   * GET /dashboard/similar-incidents/:incidentId
   * Incidents similaires à un incident donné
   */
  getSimilarIncidents(
    incidentId?: string,
    k = 3,
  ): Observable<SimilarIncidentsResponse | any> {
    if (!incidentId) {
      return this.get('/dashboard/similar-incidents', { k });
    }

    return this.get<SimilarIncidentsResponse>(
      `/dashboard/similar-incidents/${incidentId}`,
      { k },
    );
  }
}
