import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
from pymongo import MongoClient
from scipy import stats


class ModelDriftDetector:

    DRIFT_THRESHOLDS = {
        "score_mean_drift": 0.30,
        "score_std_drift": 0.40,
        "anomaly_rate_drift": 0.35,
        "ks_pvalue_threshold": 0.05,
        "vocabulary_drift": 0.25,
    }

    REFERENCE_PATH = Path("data/cache/drift_reference.json")
    HISTORY_PATH = Path("data/cache/drift_history.json")

    def __init__(
        self,
        mongo_uri: Optional[str] = None,
        db_name: Optional[str] = None,
    ):
        self.mongo = MongoClient(
            mongo_uri or os.getenv(
                "MONGO_URI",
                "mongodb://localhost:27017/",
            ),
            serverSelectionTimeoutMS=5000,
        )
        self.db = self.mongo[
            db_name or os.getenv("DATABASE_NAME", "telecom_logs")
        ]
        self.iso_model = self._safe_load_model(
            "ml/models/isolation_forest.pkl"
        )
        self.lof_model = self._safe_load_model(
            "ml/models/lof.pkl"
        )
        self.tfidf = self._safe_load_model("ml/models/tfidf.pkl")
        self.reference = self._load_reference()
        self.history = self._load_history()

    def set_reference(
        self,
        scores: list,
        texts: Optional[list] = None,
        anomaly_rate: Optional[float] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        scores_arr = self._to_score_array(scores)

        if scores_arr.size == 0:
            raise ValueError("Reference scores cannot be empty.")

        rng = np.random.default_rng(42)
        sample_size = min(5000, scores_arr.size)
        sample_indices = rng.choice(
            scores_arr.size,
            size=sample_size,
            replace=False,
        )
        reference = {
            "timestamp": self._now_iso(),
            "n_samples": int(scores_arr.size),
            "mean": float(np.mean(scores_arr)),
            "std": float(np.std(scores_arr)),
            "median": float(np.median(scores_arr)),
            "p5": float(np.percentile(scores_arr, 5)),
            "p25": float(np.percentile(scores_arr, 25)),
            "p75": float(np.percentile(scores_arr, 75)),
            "p95": float(np.percentile(scores_arr, 95)),
            "anomaly_rate": float(
                anomaly_rate
                if anomaly_rate is not None
                else np.mean(scores_arr > 0.65)
            ),
            "score_sample": scores_arr[sample_indices].tolist(),
            "metadata": metadata or {},
        }

        if texts and self.tfidf is not None:
            reference["vocabulary_size"] = int(
                len(getattr(self.tfidf, "vocabulary_", {}))
            )
            reference["top_terms"] = self._get_top_tfidf_terms(
                texts,
                n=100,
            )

        self.REFERENCE_PATH.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with self.REFERENCE_PATH.open(
            "w",
            encoding="utf-8",
        ) as file_handle:
            json.dump(reference, file_handle, indent=2)

        self.reference = reference

        return reference

    def run_full_drift_analysis(
        self,
        current_scores: list,
        current_texts: Optional[list] = None,
        window_label: Optional[str] = None,
        anomaly_threshold: float = 0.65,
        metadata: Optional[dict] = None,
    ) -> dict:
        if not self.reference:
            return {
                "error": (
                    "Drift reference is not defined yet. "
                    "Call set_reference() first."
                )
            }

        current_arr = self._to_score_array(current_scores)

        if current_arr.size == 0:
            return {
                "error": "Current scores are empty."
            }

        reference_sample = np.asarray(
            self.reference.get("score_sample", []),
            dtype=np.float32,
        )
        drift_results = {
            "score_mean": self._test_mean_drift(current_arr),
            "score_std": self._test_std_drift(current_arr),
            "anomaly_rate": self._test_anomaly_rate_drift(
                current_arr,
                threshold=anomaly_threshold,
            ),
            "distribution_ks": self._test_ks(
                current_arr,
                reference_sample,
            ),
        }

        if (
            current_texts
            and self.tfidf is not None
            and self.reference.get("top_terms")
        ):
            drift_results["vocabulary"] = (
                self._test_vocabulary_drift(current_texts)
            )

        drifted_tests = [
            name
            for name, result in drift_results.items()
            if result.get("drifted")
        ]
        severity = self._compute_drift_severity(
            drifted_tests,
            drift_results,
        )
        report = {
            "window_label": window_label
            or f"window_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
            "timestamp": self._now_iso(),
            "n_current_samples": int(current_arr.size),
            "n_reference_samples": int(
                self.reference.get("n_samples", 0)
            ),
            "drift_results": drift_results,
            "drifted_tests": drifted_tests,
            "drift_severity": severity["label"],
            "drift_score": severity["score"],
            "verdict": severity["verdict"],
            "recommendations": severity["recommendations"],
            "retrain_required": severity["label"] in [
                "HIGH",
                "CRITICAL",
            ],
            "metadata": metadata or {},
        }

        self._save_to_history(report)
        self._save_to_mongo(report)

        return report

    def analyze_weekly_drift(
        self,
        scores_by_week: dict,
        anomaly_threshold: float = 0.65,
    ) -> dict:
        return self.analyze_windowed_drift(
            scores_by_window=scores_by_week,
            window_type="week",
            anomaly_threshold=anomaly_threshold,
        )

    def analyze_windowed_drift(
        self,
        scores_by_window: dict,
        window_type: str = "window",
        anomaly_threshold: float = 0.65,
    ) -> dict:
        window_labels = sorted(scores_by_window.keys())

        if len(window_labels) < 2:
            return {
                "error": (
                    "At least two windows are required for "
                    "windowed drift analysis."
                )
            }

        window_stats = []

        for label in window_labels:
            values = self._to_score_array(scores_by_window[label])

            if values.size == 0:
                continue

            window_stats.append(
                {
                    "label": label,
                    "window_type": window_type,
                    "n_samples": int(values.size),
                    "mean": round(float(np.mean(values)), 4),
                    "std": round(float(np.std(values)), 4),
                    "anomaly_rate": round(
                        float(np.mean(values > anomaly_threshold)),
                        4,
                    ),
                    "p95": round(
                        float(np.percentile(values, 95)),
                        4,
                    ),
                }
            )

        if len(window_stats) < 2:
            return {
                "error": "Not enough non-empty windows to analyze."
            }

        first_label = window_labels[0]
        last_label = window_labels[-1]
        first_scores = self._to_score_array(
            scores_by_window[first_label]
        )
        last_scores = self._to_score_array(
            scores_by_window[last_label]
        )

        overall_mean_drift = abs(
            float(np.mean(last_scores)) - float(np.mean(first_scores))
        ) / (abs(float(np.mean(first_scores))) + 1e-9)
        ks_result = self._test_ks(last_scores, first_scores)
        drift_detected = (
            overall_mean_drift
            > self.DRIFT_THRESHOLDS["score_mean_drift"]
            or ks_result.get("drifted", False)
        )

        return {
            "window_type": window_type,
            "windows_analyzed": window_labels,
            "window_stats": window_stats,
            "overall_mean_drift": round(
                float(overall_mean_drift),
                4,
            ),
            "ks_statistic": ks_result.get("ks_statistic"),
            "ks_pvalue": ks_result.get("p_value"),
            "drift_detected": drift_detected,
            "recommendation": (
                "Window drift detected between the first and "
                "latest periods - retraining recommended"
                if drift_detected
                else "Distribution remains stable across analyzed windows"
            ),
        }

    def get_drift_trend(self) -> list:
        try:
            reports = list(
                self.db.model_drift_reports.find().sort(
                    "created_at",
                    -1,
                ).limit(50)
            )

            if reports:
                return list(reversed(reports))
        except Exception:
            pass

        return self.history

    def get_latest_report(self) -> dict:
        try:
            mongo_report = self.db.model_drift_reports.find_one(
                sort=[("created_at", -1)]
            )

            if mongo_report:
                return mongo_report
        except Exception:
            pass

        if not self.history:
            return {}

        return self.history[-1]

    def get_reference_summary(self) -> dict:
        if not self.reference:
            return {
                "available": False,
            }

        return {
            "available": True,
            "timestamp": self.reference.get("timestamp"),
            "n_samples": self.reference.get("n_samples"),
            "mean": self.reference.get("mean"),
            "std": self.reference.get("std"),
            "anomaly_rate": self.reference.get("anomaly_rate"),
            "vocabulary_size": self.reference.get(
                "vocabulary_size"
            ),
        }

    def _test_mean_drift(self, current: np.ndarray) -> dict:
        reference_mean = float(self.reference.get("mean", 0.0))
        current_mean = float(np.mean(current))
        drift_ratio = abs(current_mean - reference_mean) / (
            abs(reference_mean) + 1e-9
        )
        drifted = drift_ratio > self.DRIFT_THRESHOLDS[
            "score_mean_drift"
        ]

        return {
            "reference_mean": round(reference_mean, 4),
            "current_mean": round(current_mean, 4),
            "drift_ratio": round(float(drift_ratio), 4),
            "threshold": self.DRIFT_THRESHOLDS[
                "score_mean_drift"
            ],
            "drifted": drifted,
            "interpretation": (
                "Mean score drift exceeded threshold"
                if drifted
                else "Mean score remains stable"
            ),
        }

    def _test_std_drift(self, current: np.ndarray) -> dict:
        reference_std = float(self.reference.get("std", 0.0))
        current_std = float(np.std(current))
        drift_ratio = abs(current_std - reference_std) / (
            abs(reference_std) + 1e-9
        )
        drifted = drift_ratio > self.DRIFT_THRESHOLDS[
            "score_std_drift"
        ]

        return {
            "reference_std": round(reference_std, 4),
            "current_std": round(current_std, 4),
            "drift_ratio": round(float(drift_ratio), 4),
            "drifted": drifted,
            "interpretation": (
                "Score variance drift detected"
                if drifted
                else "Score variance remains stable"
            ),
        }

    def _test_anomaly_rate_drift(
        self,
        current: np.ndarray,
        threshold: float = 0.65,
    ) -> dict:
        reference_rate = float(
            self.reference.get("anomaly_rate", 0.0)
        )
        current_rate = float(np.mean(current > threshold))
        drift_ratio = abs(current_rate - reference_rate) / (
            abs(reference_rate) + 1e-9
        )
        drifted = drift_ratio > self.DRIFT_THRESHOLDS[
            "anomaly_rate_drift"
        ]

        return {
            "reference_rate": round(reference_rate, 4),
            "current_rate": round(current_rate, 4),
            "drift_ratio": round(float(drift_ratio), 4),
            "threshold": threshold,
            "drifted": drifted,
            "interpretation": (
                "Anomaly rate drift detected"
                if drifted
                else "Anomaly rate remains stable"
            ),
        }

    def _test_ks(
        self,
        current: np.ndarray,
        reference: np.ndarray,
    ) -> dict:
        if current.size == 0 or reference.size == 0:
            return {
                "ks_statistic": None,
                "p_value": None,
                "drifted": False,
                "interpretation": (
                    "KS test skipped because one sample is empty"
                ),
            }

        rng = np.random.default_rng(42)
        current_sample = current[
            rng.choice(
                current.size,
                size=min(5000, current.size),
                replace=False,
            )
        ]
        reference_sample = reference[
            rng.choice(
                reference.size,
                size=min(5000, reference.size),
                replace=False,
            )
        ]
        ks_statistic, p_value = stats.ks_2samp(
            current_sample,
            reference_sample,
        )
        drifted = (
            float(p_value)
            < self.DRIFT_THRESHOLDS["ks_pvalue_threshold"]
        )

        return {
            "ks_statistic": round(float(ks_statistic), 4),
            "p_value": round(float(p_value), 6),
            "drifted": drifted,
            "interpretation": (
                "Distribution drift detected by KS test"
                if drifted
                else "Distribution remains consistent with reference"
            ),
        }

    def _test_vocabulary_drift(
        self,
        current_texts: list,
    ) -> dict:
        reference_terms = set(
            self.reference.get("top_terms", [])
        )
        current_terms = set(
            self._get_top_tfidf_terms(current_texts, n=100)
        )

        if not reference_terms:
            return {
                "drifted": False,
                "interpretation": (
                    "Vocabulary reference is not available"
                ),
            }

        new_terms = current_terms - reference_terms
        missing_terms = reference_terms - current_terms
        drift_ratio = len(new_terms) / (
            len(reference_terms) + 1e-9
        )
        drifted = drift_ratio > self.DRIFT_THRESHOLDS[
            "vocabulary_drift"
        ]

        return {
            "reference_vocab_size": len(reference_terms),
            "current_vocab_size": len(current_terms),
            "new_terms_count": len(new_terms),
            "missing_terms_count": len(missing_terms),
            "new_terms_sample": list(sorted(new_terms))[:10],
            "drift_ratio": round(float(drift_ratio), 4),
            "drifted": drifted,
            "interpretation": (
                "Vocabulary drift detected"
                if drifted
                else "Vocabulary remains stable"
            ),
        }

    def _get_top_tfidf_terms(
        self,
        texts: list,
        n: int = 100,
    ) -> list:
        if self.tfidf is None or not texts:
            return []

        try:
            matrix = self.tfidf.transform(texts[:10000])
            scores = np.asarray(
                matrix.mean(axis=0)
            ).flatten()
            top_indices = scores.argsort()[-n:][::-1]
            inverse_vocab = {
                value: key
                for key, value in self.tfidf.vocabulary_.items()
            }

            return [
                inverse_vocab[index]
                for index in top_indices
                if index in inverse_vocab
            ]
        except Exception:
            return []

    def _compute_drift_severity(
        self,
        drifted_tests: list,
        drift_results: dict,
    ) -> dict:
        count = len(drifted_tests)

        if count == 0:
            return {
                "label": "NONE",
                "score": 0,
                "verdict": (
                    "No model drift detected - monitoring only"
                ),
                "recommendations": [
                    "Continue periodic drift monitoring"
                ],
            }

        if count == 1:
            return {
                "label": "LOW",
                "score": 1,
                "verdict": (
                    f"Minor drift detected on {drifted_tests[0]}"
                ),
                "recommendations": [
                    "Monitor drift trend over the next few runs",
                    "No immediate retraining required",
                ],
            }

        if count == 2:
            return {
                "label": "MEDIUM",
                "score": 2,
                "verdict": (
                    "Moderate drift detected across multiple tests"
                ),
                "recommendations": [
                    "Plan model retraining this week",
                    "Inspect recent logs for new behavior patterns",
                    "Increase monitoring frequency",
                ],
            }

        if count == 3:
            return {
                "label": "HIGH",
                "score": 3,
                "verdict": (
                    "Significant drift detected - retraining recommended"
                ),
                "recommendations": [
                    "Retrain the anomaly models within 48 hours",
                    "Review recent infrastructure or traffic changes",
                    "Refresh the drift reference after retraining",
                ],
            }

        return {
            "label": "CRITICAL",
            "score": 4,
            "verdict": (
                "Critical model drift detected - manual supervision required"
            ),
            "recommendations": [
                "Start urgent model retraining",
                "Temporarily increase manual supervision",
                "Investigate infrastructure and vocabulary changes",
                "Refresh baseline reference after validation",
            ],
        }

    def _load_reference(self) -> dict:
        if not self.REFERENCE_PATH.exists():
            return {}

        with self.REFERENCE_PATH.open(
            "r",
            encoding="utf-8",
        ) as file_handle:
            return json.load(file_handle)

    def _load_history(self) -> list:
        if not self.HISTORY_PATH.exists():
            return []

        with self.HISTORY_PATH.open(
            "r",
            encoding="utf-8",
        ) as file_handle:
            return json.load(file_handle)

    def _save_to_history(self, report: dict):
        history_entry = {
            "window_label": report["window_label"],
            "timestamp": report["timestamp"],
            "drift_severity": report["drift_severity"],
            "drift_score": report["drift_score"],
            "drifted_tests": report["drifted_tests"],
            "retrain_required": report["retrain_required"],
            "verdict": report["verdict"],
        }
        self.history.append(history_entry)
        self.HISTORY_PATH.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with self.HISTORY_PATH.open(
            "w",
            encoding="utf-8",
        ) as file_handle:
            json.dump(self.history[-50:], file_handle, indent=2)

    def _save_to_mongo(self, report: dict):
        try:
            self.db.model_drift_reports.insert_one(
                {
                    **report,
                    "created_at": datetime.now(timezone.utc),
                }
            )
        except Exception:
            pass

    def _safe_load_model(self, path: str):
        try:
            return joblib.load(path)
        except Exception:
            return None

    def _to_score_array(self, scores) -> np.ndarray:
        values = np.asarray(scores, dtype=np.float32)
        values = values[np.isfinite(values)]

        return values

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()


if __name__ == "__main__":
    detector = ModelDriftDetector()
    rng = np.random.default_rng(42)
    reference_scores = rng.normal(
        loc=0.25,
        scale=0.08,
        size=5000,
    ).tolist()
    detector.set_reference(reference_scores, anomaly_rate=0.05)
    drift_scores = rng.normal(
        loc=0.55,
        scale=0.14,
        size=5000,
    ).tolist()
    print(
        detector.run_full_drift_analysis(
            drift_scores,
            window_label="demo_window",
        )
    )
