from ai.engine.anomaly_threshold_engine import AnomalyThresholdEngine
from ai.engine.anomaly_detector import AnomalyDetector
import pandas as pd


def test_peak_hour_threshold_is_lower_than_night_for_smsc():
    engine = AnomalyThresholdEngine()

    peak_threshold = engine.get_threshold(
        platform="SMSC",
        hour=14,
        weekday=0,
        log_volume=15000,
    )
    night_threshold = engine.get_threshold(
        platform="SMSC",
        hour=2,
        weekday=1,
        log_volume=5000,
    )

    assert peak_threshold < night_threshold


def test_dataframe_detection_adds_dynamic_threshold_traceability():
    detector = AnomalyDetector()

    anomalies = detector.detect_dataframe(
        pd.DataFrame(
            [
                {
                    "platform": "smsc",
                    "hour": 14,
                    "weekday": 0,
                    "anomaly_score": 0.95,
                }
            ]
        )
    )

    assert len(anomalies) == 1
    assert "threshold_used" in anomalies[0]
    assert anomalies[0]["threshold_type"] == "dynamic"
