from fastapi.testclient import TestClient
import dashboard.dashboard_api as dashboard_api_module
import dashboard.multi_role_dashboard as multi_role_module
from dashboard.dashboard_api import app


client = TestClient(app)


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
