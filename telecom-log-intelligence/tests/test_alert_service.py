from datetime import timezone

from services.alert_service import AlertService
from services.alert_service import compute_alert_rank_score
from services.alert_service import escalate_severity


class _FakeInsertResult:

    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class _FakeCollection:

    def __init__(self):
        self.documents = []

    def insert_one(self, document):
        stored = document.copy()
        stored["_id"] = f"fake-{len(self.documents) + 1}"
        self.documents.append(stored)
        return _FakeInsertResult(stored["_id"])

    def find_one(self, query):
        fingerprint = query["metadata.dedup_fingerprint"]
        cutoff = query["created_at"]["$gte"]
        alert_type = query["type"]

        for document in self.documents:
            if (
                document.get("type") == alert_type
                and document.get("metadata", {}).get("dedup_fingerprint")
                == fingerprint
                and document.get("created_at") >= cutoff
            ):
                return document

        return None


def _build_service():
    service = AlertService.__new__(AlertService)
    service.collection = _FakeCollection()
    service.dedup_window_seconds = 60
    return service


def test_compute_alert_rank_score_clamps_to_100():

    rank_score = compute_alert_rank_score(
        severity="CRITICAL",
        spread_score=45,
        anomaly_count=20,
        cascade_length=4,
        customer_impact="HIGH",
        propagation_risk="HIGH",
    )

    assert rank_score == 100


def test_escalate_severity_raises_but_never_decreases():

    assert escalate_severity("MEDIUM", "HIGH", "MEDIUM", 32) == "HIGH"
    assert escalate_severity("HIGH", "HIGH", "LOW", 10) == "HIGH"
    assert escalate_severity("HIGH", "HIGH", "HIGH", 45) == "CRITICAL"


def test_create_incident_alert_enriches_message_and_metadata():

    service = _build_service()

    alert = service.create_incident_alert(
        anomaly_count=20,
        cluster_count=2,
        propagation_path=["SMPPS", "DMC", "SMPPC"],
        base_severity="MEDIUM",
        customer_impact="HIGH",
        propagation_risk="MEDIUM",
        sms_delivery_degradation="LOW",
        spread_score=32,
        root_causes=[("authorization", 2.0)],
    )

    assert alert is not None
    assert alert["type"] == "INCIDENT"
    assert alert["severity"] == "HIGH"
    assert "Cascade detectee" in alert["message"]
    assert alert["metadata"]["alert_rank_score"] > 0
    assert alert["metadata"]["operator_priority"] in {
        "IMMEDIATE ACTION",
        "URGENT",
        "HIGH",
        "NORMAL",
    }
    assert alert["metadata"]["recommended_actions"]
    assert alert["metadata"]["dedup_fingerprint"]
    assert alert["created_at"].tzinfo == timezone.utc


def test_create_incident_alert_suppresses_duplicate_within_window():

    service = _build_service()
    first = service.create_incident_alert(
        anomaly_count=20,
        cluster_count=2,
        propagation_path=["SMPPS", "DMC", "SMPPC"],
        base_severity="MEDIUM",
        customer_impact="HIGH",
        propagation_risk="MEDIUM",
        spread_score=32,
        root_causes=[("authorization", 2.0)],
    )
    second = service.create_incident_alert(
        anomaly_count=20,
        cluster_count=2,
        propagation_path=["SMPPS", "DMC", "SMPPC"],
        base_severity="MEDIUM",
        customer_impact="HIGH",
        propagation_risk="MEDIUM",
        spread_score=32,
        root_causes=[("authorization", 2.0)],
    )

    assert first is not None
    assert second is None


def test_create_platform_alert_adds_priority_and_actions():

    service = _build_service()

    alert = service.create_platform_alert(
        platform="SMPPS",
        incident_severity="HIGH",
        propagation_path=["SMPPS", "DMC", "SMPPC"],
        propagation_risk="MEDIUM",
        spread_score=32,
        anomaly_count=20,
        customer_impact="HIGH",
        root_causes=[("timeout", 1.0)],
    )

    assert alert is not None
    assert alert["type"] == "PLATFORM"
    assert alert["metadata"]["cascade_position"] == 1
    assert alert["metadata"]["cascade_length"] == 3
    assert alert["metadata"]["immediate_actions"]
    assert alert["metadata"]["alert_rank_score"] > 0
