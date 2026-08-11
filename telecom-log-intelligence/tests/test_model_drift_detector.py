import numpy as np

from monitoring.model_drift_detector import ModelDriftDetector


def test_windowed_drift_supports_generic_windows(tmp_path):
    detector = ModelDriftDetector()
    detector.REFERENCE_PATH = tmp_path / "drift_reference.json"
    detector.HISTORY_PATH = tmp_path / "drift_history.json"

    report = detector.analyze_windowed_drift(
        {
            "batch_a": np.random.normal(0.2, 0.05, 500).tolist(),
            "batch_b": np.random.normal(0.5, 0.08, 500).tolist(),
        },
        window_type="batch",
    )

    assert report["window_type"] == "batch"
    assert len(report["windows_analyzed"]) == 2
    assert "drift_detected" in report


def test_full_drift_analysis_returns_severity(tmp_path):
    detector = ModelDriftDetector()
    detector.REFERENCE_PATH = tmp_path / "drift_reference.json"
    detector.HISTORY_PATH = tmp_path / "drift_history.json"

    reference_scores = np.random.normal(
        0.20,
        0.05,
        1000,
    ).tolist()
    detector.set_reference(
        scores=reference_scores,
        anomaly_rate=0.05,
    )

    current_scores = np.random.normal(
        0.55,
        0.10,
        1000,
    ).tolist()
    report = detector.run_full_drift_analysis(
        current_scores=current_scores,
        window_label="test_batch",
    )

    assert "drift_severity" in report
    assert "drift_results" in report
