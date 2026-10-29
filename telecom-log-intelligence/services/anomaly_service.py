from datetime import datetime, timezone

import pandas as pd

from ai.engine.anomaly_threshold_engine import AnomalyThresholdEngine
from ml.training.hybrid_model import HybridAnomalyDetector


class AnomalyService:

    _shared_model = None

    def __init__(self):
        if self.__class__._shared_model is None:
            self.__class__._shared_model = HybridAnomalyDetector()

        self.model = self.__class__._shared_model
        self.model_type = "runtime_hybrid_v2"
        self.threshold_engine = AnomalyThresholdEngine()

    def analyze_log(self, log):
        results = self.analyze_batch([log])

        if not results:
            return {
                "timestamp": datetime.now(timezone.utc),
                "log": self._normalize_log(log),
                "anomaly_score": 0.0,
                "confidence": 0.0,
                "threshold_used": None,
                "threshold_type": "dynamic",
                "is_anomaly": False,
                "anomaly": False,
                "model": self.model_type,
            }

        return results[0]

    def analyze_batch(self, logs):
        if not logs:
            return []

        normalized_logs = [
            self._normalize_log(log)
            for log in logs
        ]
        feature_frame = self._build_feature_frame(normalized_logs)
        if not hasattr(self.model, "predict_with_confidence"):
            self.__class__._shared_model = HybridAnomalyDetector()
            self.model = self.__class__._shared_model
        scores, confidence = self.model.predict_with_confidence(
            feature_frame
        )

        platform_series = (
            feature_frame["platform"]
            .fillna("unknown")
            .astype(str)
            .str.upper()
        )
        platform_counts = platform_series.value_counts()
        results = []

        for index, normalized_log in enumerate(normalized_logs):
            platform = platform_series.iloc[index]
            hour = int(feature_frame.iloc[index]["hour"])
            weekday = int(feature_frame.iloc[index]["weekday"])
            threshold = self.threshold_engine.get_threshold(
                platform=platform,
                hour=hour,
                weekday=weekday,
                log_volume=int(platform_counts.get(platform, 1)),
            )
            score = float(scores[index])
            confidence_score = float(confidence[index])
            is_anomaly = score > threshold

            results.append(
                {
                    "timestamp": datetime.now(timezone.utc),
                    "log": normalized_log,
                    "anomaly_score": score,
                    "confidence": confidence_score,
                    "threshold_used": threshold,
                    "threshold_type": "dynamic",
                    "is_anomaly": is_anomaly,
                    "anomaly": is_anomaly,
                    "model": self.model_type,
                }
            )

        for platform in platform_series.unique():
            platform_scores = scores[
                platform_series == platform
            ].tolist()
            self.threshold_engine.update_score_history(
                platform,
                platform_scores,
            )

        return results

    def _normalize_log(self, log):
        if isinstance(log, dict):
            normalized_log = dict(log)
        else:
            normalized_log = {"message": str(log)}

        normalized_log.setdefault("message", "")
        normalized_log.setdefault("platform", "unknown")
        return normalized_log

    def _build_feature_frame(self, logs):
        rows = []

        for log in logs:
            message = str(log.get("message", ""))
            timestamp = pd.to_datetime(
                log.get("timestamp"),
                errors="coerce",
            )
            lowered_message = message.lower()

            hour = log.get("hour")
            if hour is None:
                hour = int(timestamp.hour) if pd.notna(timestamp) else 0

            weekday = log.get("weekday")
            if weekday is None:
                weekday = int(timestamp.dayofweek) if pd.notna(timestamp) else 0

            is_error = log.get("is_error")
            if is_error is None:
                is_error = int(
                    any(
                        keyword in lowered_message
                        for keyword in ["error", "fail", "exception"]
                    )
                )

            is_warning = log.get("is_warning")
            if is_warning is None:
                is_warning = int(
                    any(
                        keyword in lowered_message
                        for keyword in ["warn", "warning"]
                    )
                )

            rows.append(
                {
                    "message": message,
                    "message_length": len(message),
                    "hour": int(hour),
                    "weekday": int(weekday),
                    "is_error": int(is_error),
                    "is_warning": int(is_warning),
                    "platform": str(
                        log.get("platform", "unknown")
                    ).lower(),
                }
            )

        return pd.DataFrame(rows)
