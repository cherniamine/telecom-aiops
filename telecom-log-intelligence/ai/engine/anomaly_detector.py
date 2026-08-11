import pandas as pd
from sklearn.ensemble import IsolationForest

from ai.engine.anomaly_threshold_engine import AnomalyThresholdEngine


class AnomalyDetector:

    def __init__(self):
        self.model = IsolationForest(
            contamination=0.01,
            random_state=42,
        )
        self.threshold_engine = AnomalyThresholdEngine()

    def fit(self, vectors):
        self.model.fit(vectors)

    def detect(self, vectors, batch_size=None):
        if isinstance(vectors, pd.DataFrame):
            return self.detect_dataframe(vectors)

        if batch_size is None:
            scores = self.model.decision_function(vectors)
            predictions = self.model.predict(vectors)
            return self._collect_anomalies(scores, predictions, offset=0)

        anomalies = []

        for start in range(0, len(vectors), batch_size):
            end = min(start + batch_size, len(vectors))
            batch_vectors = vectors[start:end]
            scores = self.model.decision_function(batch_vectors)
            predictions = self.model.predict(batch_vectors)
            anomalies.extend(
                self._collect_anomalies(scores, predictions, offset=start)
            )

        return anomalies

    def detect_dataframe(self, df):
        if df is None or df.empty:
            return []

        working_df = df.copy()

        if "anomaly_score" not in working_df.columns:
            if "score" in working_df.columns:
                working_df["anomaly_score"] = working_df["score"]
            else:
                raise ValueError(
                    "DataFrame detection requires 'anomaly_score' or 'score'."
                )

        if "platform" not in working_df.columns:
            working_df["platform"] = "UNKNOWN"

        if "hour" not in working_df.columns:
            working_df["hour"] = 0

        if "weekday" not in working_df.columns:
            working_df["weekday"] = 0

        platform_series = (
            working_df["platform"].fillna("UNKNOWN").astype(str)
        )
        platform_counts = platform_series.value_counts()
        anomalies = []

        for _, row in working_df.iterrows():
            platform = str(row.get("platform", "UNKNOWN"))
            score = float(row["anomaly_score"])
            threshold = self.threshold_engine.get_threshold(
                platform=platform,
                hour=int(row.get("hour", 0) or 0),
                weekday=int(row.get("weekday", 0) or 0),
                log_volume=int(platform_counts.get(platform, 1)),
            )

            if score > threshold:
                anomaly = dict(row.to_dict())
                anomaly["threshold_used"] = threshold
                anomaly["threshold_type"] = "dynamic"
                anomalies.append(anomaly)

        for platform in platform_series.unique():
            platform_scores = working_df.loc[
                platform_series == platform,
                "anomaly_score",
            ].tolist()
            self.threshold_engine.update_score_history(
                platform,
                platform_scores,
            )

        return anomalies

    def _collect_anomalies(self, scores, predictions, offset):
        anomalies = []

        for index, prediction in enumerate(predictions):
            if prediction == -1:
                anomalies.append(
                    {
                        "index": offset + index,
                        "score": float(scores[index]),
                    }
                )

        return anomalies
