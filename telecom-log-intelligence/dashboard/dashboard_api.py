import os
import socket
import sys
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import uvicorn

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from ai.engine.what_if_engine import WhatIfEngine
from agent.incident_response_agent import IncidentResponseAgent
from agent.schemas import InvestigationReport, InvestigationRequest
from dashboard.copilot_panel import build_copilot_panel_html
from dashboard.multi_role_dashboard import require_role, router as multi_role_router
from dashboard.dashboard_service import DashboardService
from llm.explainer import IncidentExplainer
from llm.telecom_ai_copilot import TelecomAICopilot
from services.anomaly_feedback_engine import AnomalyFeedbackEngine


# ============================================================
# Services (initialisés avant lifespan pour être accessibles)
# ============================================================

dashboard_service  = DashboardService()
feedback_engine    = AnomalyFeedbackEngine()
whatif_engine      = WhatIfEngine()
incident_explainer = IncidentExplainer()
telecom_copilot    = TelecomAICopilot(explainer=incident_explainer)
incident_response_agent = IncidentResponseAgent(
    dashboard_service=dashboard_service,
    copilot=telecom_copilot,
)


# ============================================================
# LIFESPAN — Préchargement FAISS au démarrage
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── DÉMARRAGE : PRELOAD FAISS ──────────────────────────
    print("\n" + "="*60)
    print("🚀 TELECOM AI DASHBOARD - INITIALIZATION")
    print("="*60)
    
    # 🔥 LA LIGNE MAGIQUE - Charge FAISS immédiatement
    try:
        print("🔄 Loading FAISS index into memory...")
        dashboard_service._get_faiss_engine()._ensure_index_loaded()
        
        faiss_engine = dashboard_service._get_faiss_engine()
        print(f"✅ FAISS ready — {faiss_engine.total_logs:,} vectors loaded")
        print(f"   Index type: {type(faiss_engine.index).__name__}")
    except Exception as e:
        print(f"⚠️ FAISS not available at startup: {e}")
    
    print("="*60)
    print("✅ API ready to serve requests")
    print("="*60 + "\n")
    
    yield
    
    # ── ARRÊT PROPRE ───────────────────────────────────────
    print("\n🛑 Shutting down Telecom AI Dashboard...")

# Puis associer ce lifespan à l'application
app = FastAPI(
    title="Telecom AI Incident Intelligence Dashboard API",
    description="AIOps Dashboard Backend for Telecom Incident Monitoring",
    version="1.0.0",
    lifespan=lifespan,  # ← CRUCIAL : lier le lifespan
)


# ============================================================
# Pydantic models
# ============================================================

class TextSearchRequest(BaseModel):
    query: str
    k: int = 5
    platform_filter: str | None = None


class EmbeddingSearchRequest(BaseModel):
    embedding: list[float]
    k: int = 5
    platform_filter: str | None = None


class DriftAnalysisRequest(BaseModel):
    scores: list[float]
    texts: list[str] | None = None
    window_label: str | None = None


class DriftReferenceRequest(BaseModel):
    scores: list[float]
    texts: list[str] | None = None
    anomaly_rate: float = 0.05


class FeedbackRequest(BaseModel):
    label: str
    operator_id: str = "noc_operator"
    corrected_cause: str | None = None
    corrected_severity: str | None = None
    comment: str | None = None


class BatchFeedbackItem(BaseModel):
    anomaly_id: str
    label: str
    operator_id: str = "noc_operator"
    corrected_cause: str | None = None
    corrected_severity: str | None = None
    comment: str | None = None


class BatchFeedbackRequest(BaseModel):
    feedbacks: list[BatchFeedbackItem]


class SimulateRequest(BaseModel):
    incident_id: str
    action_id: str
    parameters: dict | None = None


class CompareRequest(BaseModel):
    incident_id: str
    action_ids: list[str] | None = None


class ExplainIncidentRequest(BaseModel):
    incident_id: str | None = None
    incident_data: dict | None = None


class CopilotRequest(BaseModel):
    question: str
    incident_id: str | None = None
    incident_data: dict | None = None


class ResolveIncidentRequest(BaseModel):
    resolved_by: str = "operator"
    resolution_note: str | None = None
    resolution_method: str = "manual"


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(multi_role_router)


# ============================================================
# HEALTHCHECK
# ============================================================

@app.get("/health")
def health():
    faiss_engine = dashboard_service._get_faiss_engine()
    return {
        "status":       "ok",
        "service":      "telecom-ai-dashboard-api",
        "faiss_loaded": faiss_engine.index is not None,   # ← bonus: visible dans /health
    }


# ============================================================
# OVERVIEW SUMMARY
# ============================================================

@app.get("/dashboard/overview")
def get_overview():
    return dashboard_service.get_overview()


# ============================================================
# ANOMALIES
# ============================================================

@app.get("/dashboard/anomalies")
def get_anomalies():
    return dashboard_service.get_anomalies()


# ============================================================
# ROOT CAUSE ANALYSIS
# ============================================================

@app.get("/dashboard/rca")
def get_rca():
    return dashboard_service.get_rca()


# ============================================================
# INCIDENT TIMELINE PROPAGATION
# ============================================================

@app.get("/dashboard/timeline")
def get_timeline():
    return dashboard_service.get_timeline()


# ============================================================
# HEATMAP PLATFORM DISTRIBUTION
# ============================================================

@app.get("/dashboard/heatmap")
def get_heatmap():
    return dashboard_service.get_heatmap()


# ============================================================
# IMPACT ESTIMATION ENGINE OUTPUT
# ============================================================

@app.get("/dashboard/impact")
def get_impact_estimation():
    return dashboard_service.get_impact_estimation()


# ============================================================
# INCIDENT DURATION PREDICTION
# ============================================================

@app.get("/dashboard/duration")
def get_duration_prediction():
    return dashboard_service.get_duration_prediction()


# ============================================================
# INCIDENT EVOLUTION PREDICTION
# ============================================================

@app.get("/dashboard/evolution")
def get_evolution_prediction():
    return dashboard_service.get_evolution_prediction()


# ============================================================
# AUTO REMEDIATION
# ============================================================

@app.get("/dashboard/remediation")
def get_remediation():
    return dashboard_service.get_remediation()


# ============================================================
# SIMILAR INCIDENTS
# ============================================================

@app.get("/dashboard/similar-incidents")
def get_similar_incidents(
    incident_id: str = Query(default=None),
    k: int = Query(default=3, ge=1, le=10),
):
    if incident_id:
        try:
            return dashboard_service.get_similar_incidents_by_id(
                incident_id=incident_id, k=k,
            )
        except Exception as error:
            raise HTTPException(status_code=500, detail=str(error)) from error

    return dashboard_service.get_similar_incidents()


@app.get("/dashboard/similar-logs/{log_index}")
def get_similar_logs_by_index(
    log_index: int,
    k: int = Query(default=5, ge=1, le=20),
    platform: str = Query(default=None),
):
    try:
        return dashboard_service.get_similar_logs_by_index(
            log_index=log_index, k=k, platform=platform,
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/dashboard/similar-logs/search")
def search_similar_logs_by_text(request: TextSearchRequest):
    try:
        return dashboard_service.search_similar_logs_by_text(
            query=request.query, k=request.k,
            platform_filter=request.platform_filter,
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/dashboard/similar-logs/embedding")
def search_similar_logs_by_embedding(request: EmbeddingSearchRequest):
    try:
        return dashboard_service.search_similar_logs_by_embedding(
            embedding=request.embedding, k=request.k,
            platform_filter=request.platform_filter,
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/dashboard/similar-incidents/{incident_id}")
def get_similar_incidents_by_id(
    incident_id: str,
    k: int = Query(default=3, ge=1, le=10),
):
    try:
        return dashboard_service.get_similar_incidents_by_id(
            incident_id=incident_id, k=k,
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


# ============================================================
# FAISS
# ============================================================

@app.get("/dashboard/faiss/stats")
def get_faiss_stats():
    try:
        return dashboard_service.get_faiss_stats()
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/dashboard/faiss/build-status")
def get_faiss_build_status():
    try:
        return dashboard_service.get_faiss_build_status()
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/dashboard/faiss/build")
def build_faiss_index(
    force_rebuild: bool = Query(default=False),
    background: bool = Query(default=True),
):
    try:
        return dashboard_service.build_faiss_index(
            force_rebuild=force_rebuild, background=background,
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


# ============================================================
# MODEL DRIFT
# ============================================================

@app.get("/dashboard/model-drift")
def get_model_drift_overview():
    return dashboard_service.get_model_drift_overview()


@app.get("/dashboard/model-drift/latest")
def get_latest_model_drift():
    return dashboard_service.get_latest_model_drift()


@app.get("/dashboard/model-drift/history")
def get_model_drift_history():
    return dashboard_service.get_model_drift_history()


@app.post("/dashboard/model-drift/analyze")
def analyze_model_drift(request: DriftAnalysisRequest):
    return dashboard_service.analyze_model_drift(
        scores=request.scores, texts=request.texts,
        window_label=request.window_label,
    )


@app.post("/dashboard/model-drift/set-reference")
def set_model_drift_reference(request: DriftReferenceRequest):
    return dashboard_service.set_model_drift_reference(
        scores=request.scores, texts=request.texts,
        anomaly_rate=request.anomaly_rate,
    )


# ============================================================
# INCIDENT INTELLIGENCE SNAPSHOT
# ============================================================

@app.get("/dashboard/intelligence")
def get_incident_intelligence():
    return dashboard_service.get_incident_intelligence()


# ============================================================
# GLOBAL PREDICTIONS ENDPOINT
# ============================================================

@app.get("/dashboard/predictions")
def get_predictions():
    return dashboard_service.get_predictions()


# ============================================================
# ACTIVE INCIDENTS LIST
# ============================================================

@app.get("/dashboard/incidents")
def get_incidents():
    return dashboard_service.get_incidents()


@app.post("/dashboard/incidents/{incident_id}/resolve")
def resolve_incident(incident_id: str, request: ResolveIncidentRequest):
    try:
        return dashboard_service.resolve_incident(
            incident_id=incident_id,
            resolved_by=request.resolved_by,
            resolution_note=request.resolution_note,
            resolution_method=request.resolution_method,
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


# ============================================================
# ALERTS STREAM
# ============================================================

@app.get("/dashboard/alerts")
def get_alerts():
    return dashboard_service.get_alerts()


# ============================================================
# ALERT STATISTICS
# ============================================================

@app.get("/dashboard/alerts/stats")
def get_alert_statistics():
    return dashboard_service.get_alert_statistics()


# ============================================================
# INCIDENT HISTORY ANALYTICS
# ============================================================

@app.get("/dashboard/incidents/history")
def get_incident_history():
    return dashboard_service.get_incident_history()


# ============================================================
# EMAIL ALERT TRACKING
# ============================================================

@app.get("/dashboard/email-alerts")
def get_email_alerts():
    return dashboard_service.get_email_alerts()


# ============================================================
# SYSTEM STATUS MONITORING
# ============================================================

@app.get("/dashboard/system-status")
def get_system_status():
    return dashboard_service.get_system_status()


# ============================================================
# DYNAMIC ANOMALY THRESHOLDS
# ============================================================

@app.get("/dashboard/thresholds/{platform}")
def get_threshold_info(
    platform: str,
    hour: int = None,
    weekday: int = None,
    log_volume: int = None,
):
    return dashboard_service.get_threshold_info(
        platform=platform, hour=hour,
        weekday=weekday, log_volume=log_volume,
    )


# ============================================================
# LLM EXPLAIN + COPILOT
# ============================================================

@app.post("/dashboard/explain")
def explain_incident(request: ExplainIncidentRequest):
    incident_data = (
        request.incident_data
        or dashboard_service.get_incident_context(request.incident_id)
    )
    if not incident_data:
        raise HTTPException(status_code=404, detail="No incident context available")
    return incident_explainer.explain_incident(incident_data)


@app.post("/dashboard/copilot/ask")
def ask_incident_copilot(request: CopilotRequest):
    incident_data = (
        request.incident_data
        or dashboard_service.get_incident_context(request.incident_id)
    )
    if not incident_data:
        raise HTTPException(status_code=404, detail="No incident context available")
    return telecom_copilot.ask(
        question=request.question,
        incident_data=incident_data,
    )


@app.post("/agent/investigate", response_model=InvestigationReport)
def investigate_incident(
    request: InvestigationRequest,
    user: dict = Depends(require_role("noc", "manager", "engineer")),
):
    """Investigate an alert with existing MongoDB, FAISS, RCA and copilot services."""
    del user
    report = incident_response_agent.investigate(request)
    try:
        dashboard_service.save_agent_investigation(
            request.model_dump(mode="json"), report.model_dump(mode="json")
        )
    except Exception:
        if "history" not in report.degraded_components:
            report.degraded_components.append("history")
        if report.status == "investigated":
            report.status = "degraded"
    return report


@app.get("/agent/investigations/{incident_id}")
def get_agent_investigations(
    incident_id: str,
    limit: int = 20,
    user: dict = Depends(require_role("noc", "manager", "engineer")),
):
    """Return read-only audit snapshots produced by the incident response agent."""
    del user
    try:
        history = dashboard_service.get_agent_investigation_history(incident_id, limit)
        if history["count"] == 0 and not dashboard_service.incident_exists(incident_id):
            raise HTTPException(status_code=404, detail="Incident not found")
        return history
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Investigation history unavailable",
        ) from error


@app.get("/agent/investigations/{incident_id}/compare")
def compare_agent_investigations(
    incident_id: str,
    baseline_id: str,
    candidate_id: str,
    user: dict = Depends(require_role("noc", "manager", "engineer")),
):
    """Compare two recorded investigations for the same incident."""
    del user
    if baseline_id == candidate_id:
        raise HTTPException(
            status_code=400,
            detail="Select two distinct investigation snapshots",
        )
    try:
        comparison = dashboard_service.compare_agent_investigations(
            incident_id, baseline_id, candidate_id
        )
        if comparison is None:
            raise HTTPException(status_code=404, detail="Investigation snapshot not found")
        return comparison
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Investigation comparison unavailable",
        ) from error


@app.get("/dashboard/copilot/panel", response_class=HTMLResponse)
def get_copilot_panel():
    return build_copilot_panel_html()

@app.get("/dashboard/copilot/model")
def get_copilot_model():
    """Retourne le modèle Ollama actuellement utilisé"""
    return {
        "model": telecom_copilot.model_name if hasattr(telecom_copilot, 'model_name') else "mistral",
        "ollama_url": os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
    }

# ============================================================
# WHAT-IF SIMULATOR
# ============================================================

@app.get("/dashboard/what-if")
def get_what_if_overview():
    return whatif_engine.get_overview()


@app.get("/dashboard/what-if/actions")
def list_what_if_actions():
    return {"actions": whatif_engine.list_available_actions()}


@app.post("/dashboard/what-if/simulate")
def simulate_what_if_action(request: SimulateRequest):
    incident = whatif_engine.get_incident_by_id(request.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {request.incident_id} not found")
    result = whatif_engine.simulate(
        action_id=request.action_id,
        incident_data=incident,
        parameters=request.parameters,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/dashboard/what-if/compare")
def compare_what_if_actions(request: CompareRequest):
    incident = whatif_engine.get_incident_by_id(request.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {request.incident_id} not found")
    return whatif_engine.compare_actions(
        incident_data=incident, action_ids=request.action_ids,
    )


@app.get("/dashboard/what-if/best-action/{incident_id}")
def get_what_if_best_action(incident_id: str):
    if str(incident_id).lower() == "latest":
        incident = dashboard_service.get_incident_context()
    else:
        incident = whatif_engine.get_incident_by_id(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return whatif_engine.get_best_action(incident_data=incident)


@app.get("/dashboard/what-if/history/{incident_id}")
def get_what_if_history(
    incident_id: str,
    limit: int = Query(default=10, ge=1, le=50),
):
    return whatif_engine.get_simulation_history(
        incident_id=incident_id, limit=limit,
    )


# ============================================================
# FEEDBACK LOOP
# ============================================================

@app.post("/dashboard/feedback/anomaly/batch")
def submit_batch_feedback(request: BatchFeedbackRequest):
    return feedback_engine.submit_batch_feedback(
        [item.dict() for item in request.feedbacks]
    )


@app.post("/dashboard/feedback/anomaly/{anomaly_id}")
def submit_feedback(anomaly_id: str, request: FeedbackRequest):
    result = feedback_engine.submit_feedback(
        anomaly_id=anomaly_id,
        label=request.label,
        operator_id=request.operator_id,
        corrected_cause=request.corrected_cause,
        corrected_severity=request.corrected_severity,
        comment=request.comment,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/dashboard/feedback/stats")
def get_feedback_stats(platform: str = Query(default=None)):
    return feedback_engine.get_feedback_stats(platform=platform)


@app.get("/dashboard/feedback/pending")
def get_pending_anomalies(
    platform: str = Query(default=None),
    limit: int = Query(default=20, ge=1, le=200),
):
    anomalies = feedback_engine.get_pending_validation(
        platform=platform, limit=limit,
    )
    return {"pending_count": len(anomalies), "anomalies": anomalies}


@app.post("/dashboard/feedback/retrain")
def trigger_feedback_retrain():
    result = feedback_engine.retrain_with_feedback()
    if result.get("status") == "ERROR":
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/dashboard/feedback/history/{operator_id}")
def get_feedback_history(
    operator_id: str,
    limit: int = Query(default=50, ge=1, le=500),
):
    history = feedback_engine.get_operator_history(
        operator_id=operator_id, limit=limit,
    )
    return {"operator_id": operator_id, "feedbacks": history, "count": len(history)}


# ============================================================
# PORT AUTO-DETECTION
# ============================================================

def _find_available_port(host, preferred_port, max_attempts=10):
    for port in range(preferred_port, preferred_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if sock.connect_ex((host, port)) != 0:
                return port
    raise RuntimeError(
        f"No available port found between {preferred_port} and {preferred_port + max_attempts}"
    )


# ============================================================
# MAIN ENTRYPOINT
# ============================================================

def main():
    host = os.getenv("DASHBOARD_API_HOST", "127.0.0.1")
    preferred_port = int(os.getenv("DASHBOARD_API_PORT", "8000"))
    port = _find_available_port(host, preferred_port)

    print("\nStarting Telecom AI Dashboard API")
    print(f"Running on http://{host}:{port}")
    print(f"Swagger docs: http://{host}:{port}/docs\n")

    uvicorn.run(
        "dashboard.dashboard_api:app",
        host=host,
        port=port,
        reload=False,
    )


if __name__ == "__main__":
    main()
