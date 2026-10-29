from fastapi.testclient import TestClient
import dashboard.dashboard_api as dashboard_api_module
import dashboard.multi_role_dashboard as multi_role_module
from dashboard.dashboard_api import app
from dashboard.dashboard_service import DashboardService
from agent.schemas import InvestigationReport


client = TestClient(app)


def _agent_headers(username="noc_operator", password="noc123"):
    response = client.post(
        "/auth/login", json={"username": username, "password": password}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _agent_report() -> InvestigationReport:
    return InvestigationReport(
        incident_id="INC-1",
        root_cause="[('timeout', 3)]",
        confidence=0.6,
        evidence=[],
        recommended_action="Investigate manually",
        status="insufficient_data",
    )


def test_agent_investigation_persists_audit_snapshot(monkeypatch):
    saved = []
    monkeypatch.setattr(dashboard_api_module.incident_response_agent, "investigate", lambda request: _agent_report())
    monkeypatch.setattr(dashboard_api_module.dashboard_service, "save_agent_investigation", lambda request, report: saved.append((request, report)))

    response = client.post("/agent/investigate", json={
        "incident_id": "INC-1", "service": "SMSC", "alert": "timeout", "severity": "high",
    }, headers=_agent_headers())

    assert response.status_code == 200
    assert saved[0][0]["incident_id"] == "INC-1"
    assert saved[0][1]["root_cause"] == "[('timeout', 3)]"


def test_agent_investigation_degrades_when_history_write_fails(monkeypatch):
    report = _agent_report().model_copy(update={"status": "investigated"})
    monkeypatch.setattr(dashboard_api_module.incident_response_agent, "investigate", lambda request: report)
    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "save_agent_investigation",
        lambda request, report: (_ for _ in ()).throw(RuntimeError("Mongo unavailable")),
    )

    response = client.post("/agent/investigate", json={
        "incident_id": "INC-1", "service": "SMSC", "alert": "timeout", "severity": "high",
    }, headers=_agent_headers())

    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert "history" in response.json()["degraded_components"]


def test_agent_investigation_history_returns_persisted_snapshots(monkeypatch):
    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "get_agent_investigation_history",
        lambda incident_id, limit: {
            "incident_id": incident_id,
            "investigations": [{"_id": "snapshot-1", "incident_id": incident_id}],
            "count": 1,
        },
    )

    response = client.get("/agent/investigations/INC-1?limit=5", headers=_agent_headers())

    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["investigations"][0]["_id"] == "snapshot-1"


def test_agent_investigation_comparison_returns_backend_changes(monkeypatch):
    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "compare_agent_investigations",
        lambda incident_id, baseline_id, candidate_id: {
            "incident_id": incident_id,
            "baseline": {"_id": baseline_id},
            "candidate": {"_id": candidate_id},
            "changes": {"confidence_delta": 0.1, "root_cause_changed": False},
        },
    )

    response = client.get(
        "/agent/investigations/INC-1/compare?baseline_id=snapshot-1&candidate_id=snapshot-2",
        headers=_agent_headers(),
    )

    assert response.status_code == 200
    assert response.json()["changes"]["confidence_delta"] == 0.1


def test_agent_investigation_comparison_returns_not_found_for_unknown_snapshot(monkeypatch):
    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "compare_agent_investigations",
        lambda incident_id, baseline_id, candidate_id: None,
    )

    response = client.get(
        "/agent/investigations/INC-1/compare?baseline_id=missing&candidate_id=other",
        headers=_agent_headers(),
    )

    assert response.status_code == 404


def test_agent_history_requires_authentication():
    response = client.get("/agent/investigations/INC-1")

    assert response.status_code == 401


def test_agent_investigation_requires_authentication():
    response = client.post("/agent/investigate", json={
        "incident_id": "INC-1", "service": "SMSC", "alert": "timeout", "severity": "high",
    })

    assert response.status_code == 401


def test_agent_history_rejects_authenticated_role_without_access(monkeypatch):
    token = multi_role_module._encode_token({"sub": "viewer", "role": "viewer"})
    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "get_agent_investigation_history",
        lambda incident_id, limit: (_ for _ in ()).throw(AssertionError("must not query history")),
    )

    response = client.get(
        "/agent/investigations/INC-1",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_agent_history_accepts_all_roles_allowed_by_incident_page(monkeypatch):
    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "get_agent_investigation_history",
        lambda incident_id, limit: {
            "incident_id": incident_id, "investigations": [], "count": 0,
        },
    )
    monkeypatch.setattr(dashboard_api_module.dashboard_service, "incident_exists", lambda incident_id: True)

    response = client.get(
        "/agent/investigations/INC-1",
        headers=_agent_headers("manager_demo", "mgr123"),
    )

    assert response.status_code == 200
    assert response.json()["count"] == 0


def test_agent_history_returns_not_found_for_unknown_incident(monkeypatch):
    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "get_agent_investigation_history",
        lambda incident_id, limit: {
            "incident_id": incident_id, "investigations": [], "count": 0,
        },
    )
    monkeypatch.setattr(dashboard_api_module.dashboard_service, "incident_exists", lambda incident_id: False)

    response = client.get("/agent/investigations/unknown", headers=_agent_headers())

    assert response.status_code == 404


def test_agent_history_reports_mongodb_failure(monkeypatch):
    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "get_agent_investigation_history",
        lambda incident_id, limit: (_ for _ in ()).throw(RuntimeError("Mongo unavailable")),
    )

    response = client.get("/agent/investigations/INC-1", headers=_agent_headers())

    assert response.status_code == 503


def test_agent_comparison_rejects_a_single_snapshot_selection():
    response = client.get(
        "/agent/investigations/INC-1/compare?baseline_id=snapshot-1&candidate_id=snapshot-1",
        headers=_agent_headers(),
    )

    assert response.status_code == 400


def test_agent_comparison_reports_mongodb_failure(monkeypatch):
    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "compare_agent_investigations",
        lambda incident_id, baseline_id, candidate_id: (_ for _ in ()).throw(RuntimeError("Mongo unavailable")),
    )

    response = client.get(
        "/agent/investigations/INC-1/compare?baseline_id=snapshot-1&candidate_id=snapshot-2",
        headers=_agent_headers(),
    )

    assert response.status_code == 503


def test_history_comparison_uses_persisted_values_and_marks_missing_data():
    service = DashboardService.__new__(DashboardService)
    documents = {
        "baseline": {
            "_id": "baseline",
            "incident_id": "INC-1",
            "report": {
                "confidence": 0.4,
                "root_cause": "timeout",
                "evidence": [{"reference": "log-1"}],
                "degraded_components": ["llm"],
            },
        },
        "candidate": {
            "_id": "candidate",
            "incident_id": "INC-1",
            "report": {
                "confidence": 0.7,
                "root_cause": "connection_pool",
                "evidence": [{"reference": "log-2"}],
                "degraded_components": [],
            },
        },
        "incomplete": {"_id": "incomplete", "incident_id": "INC-1", "report": {}},
    }
    service._find_agent_investigation = lambda incident_id, snapshot_id: documents.get(snapshot_id)
    service._serialize_value = lambda value: value

    result = service.compare_agent_investigations("INC-1", "baseline", "candidate")
    incomplete = service.compare_agent_investigations("INC-1", "baseline", "incomplete")

    assert result["changes"]["confidence_delta"] == 0.3
    assert result["changes"]["root_cause_changed"] is True
    assert result["changes"]["new_evidence_references"] == ["log-2"]
    assert result["changes"]["removed_evidence_references"] == ["log-1"]
    assert result["changes"]["recovered_components"] == ["llm"]
    assert incomplete["changes"]["confidence_delta"] is None
    assert "confidence" in incomplete["changes"]["missing_data"]


def test_history_persistence_redacts_credential_like_values():
    service = DashboardService.__new__(DashboardService)

    redacted = service._redact_investigation_history_value({
        "access_token": "secret-value",
        "detail": "Authorization: Bearer abc.def-123",
        "nested": {"password": "not-for-history"},
    })

    assert redacted["access_token"] == "[REDACTED]"
    assert redacted["nested"]["password"] == "[REDACTED]"
    assert "abc.def-123" not in redacted["detail"]


def test_dashboard_overview():

    response = client.get("/dashboard/overview")

    assert response.status_code == 200


def test_dashboard_timeline():

    response = client.get("/dashboard/timeline")

    assert response.status_code == 200


def test_dashboard_faiss_stats():

    response = client.get("/dashboard/faiss/stats")

    assert response.status_code == 200


def test_dashboard_faiss_build_status(monkeypatch):

    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "get_faiss_build_status",
        lambda: {
            "status": "idle",
            "progress_pct": 0.0,
            "index_exists": False,
        },
    )

    response = client.get("/dashboard/faiss/build-status")

    assert response.status_code == 200
    assert response.json()["status"] == "idle"


def test_dashboard_faiss_build_async(monkeypatch):

    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "build_faiss_index",
        lambda force_rebuild=False, background=True: {
            "status": "running",
            "message": "FAISS build started in background.",
            "progress_pct": 0.0,
            "index_exists": False,
            "background": background,
        },
    )

    response = client.post("/dashboard/faiss/build?force_rebuild=false")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "running"
    assert body["background"] is True


def test_dashboard_model_drift_overview():

    response = client.get("/dashboard/model-drift")

    assert response.status_code == 200


def test_dashboard_feedback_stats():

    response = client.get("/dashboard/feedback/stats")

    assert response.status_code == 200


def test_dashboard_feedback_pending():

    response = client.get("/dashboard/feedback/pending")

    assert response.status_code == 200


def test_dashboard_what_if_overview():

    response = client.get("/dashboard/what-if")

    assert response.status_code == 200


def test_dashboard_what_if_actions():

    response = client.get("/dashboard/what-if/actions")

    assert response.status_code == 200


def test_auth_login_returns_token():

    response = client.post(
        "/auth/login",
        json={
            "username": "noc_operator",
            "password": "noc123",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "noc"
    assert body["access_token"]


def test_dashboard_me_returns_role_dashboard():

    login_response = client.post(
        "/auth/login",
        json={
            "username": "engineer_demo",
            "password": "eng123",
        },
    )

    token = login_response.json()["access_token"]
    response = client.get(
        "/dashboard/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "engineer"
    assert body["dashboard_url"] == "/dashboard/engineer/ml-metrics"
    assert "GET /dashboard/what-if/best-action/{incident_id}" in body[
        "available_endpoints"
    ]


def test_dashboard_what_if_best_action(monkeypatch):

    monkeypatch.setattr(
        dashboard_api_module.whatif_engine,
        "get_incident_by_id",
        lambda incident_id: {"_id": incident_id, "platforms": ["SMSC"]},
    )
    monkeypatch.setattr(
        dashboard_api_module.whatif_engine,
        "get_best_action",
        lambda incident_data: {
            "incident_id": incident_data["_id"],
            "incident_mttr_baseline": 104,
            "actions_compared": 3,
            "best_action": {
                "action_id": "combined_recovery",
                "action_label": "Combined recovery plan",
                "mttr_after": 36,
                "mttr_reduction_pct": 65.4,
            },
            "top_actions": [],
            "timestamp": "2026-04-03T00:00:00+00:00",
        },
    )

    response = client.get("/dashboard/what-if/best-action/inc-001")

    assert response.status_code == 200
    body = response.json()
    assert body["incident_id"] == "inc-001"
    assert body["best_action"]["action_id"] == "combined_recovery"


def test_dashboard_what_if_best_action_latest(monkeypatch):

    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "get_incident_context",
        lambda incident_id=None: {
            "_id": "latest-inc",
            "platforms": ["SMSC", "SMPPS"],
            "severity": {"label": "CRITICAL"},
        },
    )
    monkeypatch.setattr(
        dashboard_api_module.whatif_engine,
        "get_best_action",
        lambda incident_data: {
            "incident_id": incident_data["_id"],
            "incident_mttr_baseline": 90,
            "actions_compared": 4,
            "best_action": {
                "action_id": "increase_smsc_queue",
                "action_label": "Increase SMSC queue capacity",
                "mttr_after": 37,
                "mttr_reduction_pct": 58.9,
            },
            "top_actions": [],
            "timestamp": "2026-04-03T00:00:00+00:00",
        },
    )

    response = client.get("/dashboard/what-if/best-action/latest")

    assert response.status_code == 200
    body = response.json()
    assert body["incident_id"] == "latest-inc"
    assert body["best_action"]["action_id"] == "increase_smsc_queue"


def test_dashboard_explain(monkeypatch):

    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "get_incident_context",
        lambda incident_id=None: {"_id": incident_id or "latest"},
    )
    monkeypatch.setattr(
        dashboard_api_module.incident_explainer,
        "explain_incident",
        lambda incident_data: {
            "incident_id": incident_data["_id"],
            "manager_summary": "Incident critique mais contenu.",
            "technical_explanation": "Propagation MMG vers SMSC detectee.",
            "recommended_action": "Augmenter la capacite queue SMSC.",
            "source": "heuristic",
            "used_fallback": True,
        },
    )

    response = client.post(
        "/dashboard/explain",
        json={"incident_id": "inc-002"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["incident_id"] == "inc-002"
    assert "manager_summary" in body
    assert "recommended_action" in body


def test_dashboard_copilot_ask(monkeypatch):

    monkeypatch.setattr(
        dashboard_api_module.dashboard_service,
        "get_incident_context",
        lambda incident_id=None: {"_id": incident_id or "latest"},
    )
    monkeypatch.setattr(
        dashboard_api_module.telecom_copilot,
        "ask",
        lambda question, incident_data: {
            "question": question,
            "answer": "La cause racine probable est timeout.",
            "source": "heuristic",
            "used_fallback": True,
        },
    )

    response = client.post(
        "/dashboard/copilot/ask",
        json={
            "incident_id": "inc-003",
            "question": "What is the root cause?",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["question"] == "What is the root cause?"
    assert "answer" in body


def test_dashboard_copilot_panel():

    response = client.get("/dashboard/copilot/panel")

    assert response.status_code == 200
    assert "Explain. Root Cause. Best Action." in response.text


def test_engineer_ml_metrics_prefers_historical_logs(monkeypatch):

    counts = {
        "logs": 8485,
        "log_features": 7224549,
        "anomalies": 47278,
        "clusters": 0,
    }

    monkeypatch.setattr(
        multi_role_module,
        "_safe_count",
        lambda collection_name, query=None: counts.get(collection_name, 0),
    )
    monkeypatch.setattr(
        multi_role_module,
        "_collection_exists",
        lambda collection_name: collection_name == "clusters",
    )
    monkeypatch.setattr(
        multi_role_module,
        "_safe_find_one",
        lambda *args, **kwargs: {},
    )
    monkeypatch.setattr(
        multi_role_module,
        "_get_feedback_summary",
        lambda: {
            "total": 2,
            "true_positives": 1,
            "false_positives": 1,
            "precision_pct": "50.0%",
            "false_positive_rate": "50.0%",
            "retrain_ready": False,
            "unused_for_training": 2,
        },
    )

    login_response = client.post(
        "/auth/login",
        json={
            "username": "engineer_demo",
            "password": "eng123",
        },
    )
    token = login_response.json()["access_token"]

    response = client.get(
        "/dashboard/engineer/ml-metrics",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["dataset"]["total_logs"] == 7224549
    assert body["dataset"]["historical_logs"] == 7224549
    assert body["dataset"]["realtime_logs"] == 8485
    assert body["dataset"]["anomaly_rate_pct"] < 1
