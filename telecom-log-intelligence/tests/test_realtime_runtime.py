import ai.orchestrator.telecom_ai_orchestrator as orchestrator_module
import services.anomaly_service as anomaly_service_module


def test_anomaly_service_reuses_shared_model(monkeypatch):

    class FakeHybridDetector:
        instances = 0

        def __init__(self):
            FakeHybridDetector.instances += 1

    monkeypatch.setattr(
        anomaly_service_module,
        "HybridAnomalyDetector",
        FakeHybridDetector,
    )
    anomaly_service_module.AnomalyService._shared_model = None

    first_service = anomaly_service_module.AnomalyService()
    second_service = anomaly_service_module.AnomalyService()

    assert FakeHybridDetector.instances == 1
    assert first_service.model is second_service.model


def test_resolve_primary_root_causes_uses_telecom_rca_when_simple_rca_empty():

    result = {
        "rca": {"root_causes": []},
        "telecom_rca": {
            "root_causes": [("timeout", 3.0)],
            "count": 1,
        },
    }

    resolved = orchestrator_module._resolve_primary_root_causes(
        result,
        logs=[],
        propagation_path=["SMPPS"],
    )

    assert resolved == [("timeout", 3.0)]
    assert result["rca"]["root_causes"] == [("timeout", 3.0)]


def test_resolve_primary_root_causes_falls_back_to_platform_hints():

    result = {
        "rca": {"root_causes": []},
        "telecom_rca": {"root_causes": []},
    }

    resolved = orchestrator_module._resolve_primary_root_causes(
        result,
        logs=[{"message": "Packet dump len 77", "platform": "smpps"}],
        propagation_path=["SMPPS", "DMC"],
    )

    assert resolved
    assert result["rca"]["root_causes"]
    assert resolved[0][0] in {"timeout", "routing"}


def test_runtime_copilot_is_reused(monkeypatch):

    class FakeExplainer:
        instances = 0

        def __init__(self):
            FakeExplainer.instances += 1

    class FakeCopilot:
        instances = 0

        def __init__(self, explainer):
            FakeCopilot.instances += 1
            self.explainer = explainer

    monkeypatch.setattr(
        orchestrator_module,
        "LogExplainer",
        FakeExplainer,
    )
    monkeypatch.setattr(
        orchestrator_module,
        "TelecomAICopilot",
        FakeCopilot,
    )
    orchestrator_module._RUNTIME_EXPLAINER = None
    orchestrator_module._RUNTIME_COPILOT = None

    first = orchestrator_module._get_runtime_copilot()
    second = orchestrator_module._get_runtime_copilot()

    assert FakeExplainer.instances == 1
    assert FakeCopilot.instances == 1
    assert first is second


def test_save_orchestration_alerts_uses_alert_service_factory(monkeypatch):

    captured = {}

    class FakeAlertService:

        def should_send_incident_alert(self, **kwargs):
            captured["policy"] = kwargs
            return True

        def save_orchestration_alerts(self, **kwargs):
            captured["payload"] = kwargs
            return [{"type": "INCIDENT", "severity": "HIGH"}]

    monkeypatch.setattr(
        orchestrator_module,
        "AlertService",
        FakeAlertService,
    )

    result = {
        "anomalies": [{"is_anomaly": True}],
        "clusters": [{"cluster_id": 1}],
        "telecom_rca": {"propagation_path": ["SMPPS", "DMC", "SMPPC"]},
        "rca": {"root_causes": [("authorization", 2.0)]},
    }
    impact = {
        "severity_label": "MEDIUM",
        "propagation_risk": "MEDIUM",
        "customer_impact": "HIGH",
        "sms_delivery_degradation": "LOW",
        "incident_spread_score": 32,
    }

    alerts = orchestrator_module._save_orchestration_alerts(
        result,
        impact=impact,
    )

    assert alerts == [{"type": "INCIDENT", "severity": "HIGH"}]
    assert captured["payload"]["spread_score"] == 32
    assert captured["payload"]["customer_impact"] == "HIGH"
    assert result["alerts"] == alerts
