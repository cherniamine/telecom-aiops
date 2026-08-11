from ai.engine.anomaly_detector import AnomalyDetector


def test_anomaly_detection():

    detector = AnomalyDetector()

    vectors = [
        [0.1, 0.2],
        [0.15, 0.22],
        [0.12, 0.21],
        [5.0, 5.1]  # anomalie
    ]

    detector.fit(vectors)

    anomalies = detector.detect(vectors)

    assert len(anomalies) >= 1