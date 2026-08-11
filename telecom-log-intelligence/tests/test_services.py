from services.anomaly_service import AnomalyService
from services.anomaly_feedback_engine import AnomalyFeedbackEngine
from services.rca_service import RCAService


def test_anomaly_service():

    service = AnomalyService()

    result = service.analyze_log("ERROR MMG overload")

    assert "anomaly_score" in result


def test_rca_service():

    service = RCAService()

    logs = [
        "ERROR MMG queue overflow",
        "ERROR MMG session failure"
    ]

    result = service.analyze(logs)

    assert "root_causes" in result


def test_feedback_engine_rejects_invalid_label():

    engine = AnomalyFeedbackEngine()

    result = engine.submit_feedback(
        anomaly_id="507f1f77bcf86cd799439011",
        label="bad_label",
    )

    assert "error" in result
