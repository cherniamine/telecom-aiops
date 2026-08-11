import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from bson import ObjectId
from pymongo import MongoClient
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import MinMaxScaler

from monitoring.model_drift_detector import ModelDriftDetector


FEEDBACK_LABELS = {
    "true_positive": (
        "Confirmed anomaly - model detection is correct"
    ),
    "false_positive": (
        "False alarm - normal log incorrectly flagged"
    ),
    "uncertain": (
        "Needs more investigation"
    ),
    "corrected_cause": (
        "Operator corrected the root cause"
    ),
}

SEVERITY_LABELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class AnomalyFeedbackEngine:

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
        self.col_feedback = self.db["anomaly_feedback"]
        self.col_anomalies = self.db["anomalies"]
        self.col_retrain_log = self.db["retrain_log"]
        self.dataset_path = Path("data/processed/ml_dataset.parquet")

        self._ensure_indexes()

    def submit_feedback(
        self,
        anomaly_id: str,
        label: str,
        operator_id: str = "noc_operator",
        corrected_cause: Optional[str] = None,
        corrected_severity: Optional[str] = None,
        comment: Optional[str] = None,
    ) -> dict:
        normalized_label = str(label or "").strip().lower()

        if normalized_label not in FEEDBACK_LABELS:
            return {
                "error": f"Invalid label: {label}",
                "valid_labels": list(FEEDBACK_LABELS.keys()),
            }

        if (
            corrected_severity
            and str(corrected_severity).upper()
            not in SEVERITY_LABELS
        ):
            return {
                "error": (
                    "Invalid severity. Valid values: "
                    + ", ".join(SEVERITY_LABELS)
                )
            }

        anomaly_object_id = self._to_object_id(anomaly_id)
        anomaly = None

        if anomaly_object_id is not None:
            anomaly = self.col_anomalies.find_one(
                {"_id": anomaly_object_id}
            )

        if anomaly is None:
            return {
                "error": f"Anomaly {anomaly_id} not found"
            }

        now = datetime.now(timezone.utc)
        snapshot = self._build_anomaly_snapshot(anomaly)
        feedback_document = {
            "anomaly_id": str(anomaly["_id"]),
            "label": normalized_label,
            "label_description": FEEDBACK_LABELS[normalized_label],
            "operator_id": operator_id,
            "platform": snapshot.get("platform"),
            "corrected_cause": corrected_cause,
            "corrected_severity": (
                str(corrected_severity).upper()
                if corrected_severity
                else None
            ),
            "comment": comment,
            "anomaly_snapshot": snapshot,
            "used_for_training": False,
            "created_at": now,
            "updated_at": now,
        }

        existing_feedback = self.col_feedback.find_one(
            {"anomaly_id": str(anomaly["_id"])}
        )

        if existing_feedback:
            self.col_feedback.update_one(
                {"_id": existing_feedback["_id"]},
                {
                    "$set": {
                        **feedback_document,
                        "created_at": existing_feedback.get(
                            "created_at",
                            now,
                        ),
                    }
                },
            )
            action = "updated"
        else:
            self.col_feedback.insert_one(feedback_document)
            action = "created"

        self.col_anomalies.update_one(
            {"_id": anomaly["_id"]},
            {
                "$set": {
                    "feedback_label": normalized_label,
                    "feedback_at": now,
                    "feedback_operator": operator_id,
                    "corrected_cause": corrected_cause,
                    "corrected_severity": (
                        str(corrected_severity).upper()
                        if corrected_severity
                        else None
                    ),
                }
            },
        )

        stats = self.get_feedback_stats()

        return self._serialize_value(
            {
                "action": action,
                "anomaly_id": str(anomaly["_id"]),
                "label": normalized_label,
                "description": FEEDBACK_LABELS[normalized_label],
                "operator_id": operator_id,
                "timestamp": now,
                "global_stats": stats,
                "retrain_ready": stats.get("retrain_ready", False),
            }
        )

    def submit_batch_feedback(self, feedbacks: list) -> dict:
        results = {
            "success": 0,
            "errors": 0,
            "details": [],
        }

        for feedback in feedbacks or []:
            result = self.submit_feedback(
                anomaly_id=feedback.get("anomaly_id"),
                label=feedback.get("label"),
                operator_id=feedback.get(
                    "operator_id",
                    "noc_operator",
                ),
                corrected_cause=feedback.get("corrected_cause"),
                corrected_severity=feedback.get(
                    "corrected_severity"
                ),
                comment=feedback.get("comment"),
            )

            if "error" in result:
                results["errors"] += 1
            else:
                results["success"] += 1

            results["details"].append(result)

        stats = self.get_feedback_stats()
        results["retrain_ready"] = stats.get(
            "retrain_ready",
            False,
        )

        return self._serialize_value(results)

    def get_feedback_stats(
        self,
        platform: Optional[str] = None,
    ) -> dict:
        match_stage = {}

        if platform:
            match_stage["platform"] = {
                "$regex": f"^{re.escape(str(platform).upper())}$",
                "$options": "i",
            }

        pipeline = []

        if match_stage:
            pipeline.append({"$match": match_stage})

        pipeline.append(
            {
                "$group": {
                    "_id": "$label",
                    "count": {"$sum": 1},
                }
            }
        )

        label_counts = {
            item["_id"]: item["count"]
            for item in self.col_feedback.aggregate(pipeline)
        }
        total_feedbacks = int(sum(label_counts.values()))
        true_positives = int(
            label_counts.get("true_positive", 0)
        )
        false_positives = int(
            label_counts.get("false_positive", 0)
        )
        uncertain = int(label_counts.get("uncertain", 0))
        corrected = int(
            label_counts.get("corrected_cause", 0)
        )
        labeled_total = true_positives + false_positives
        precision = (
            round(true_positives / labeled_total, 4)
            if labeled_total > 0
            else None
        )

        unused_query = {"used_for_training": False}

        if platform:
            unused_query["platform"] = {
                "$regex": f"^{re.escape(str(platform).upper())}$",
                "$options": "i",
            }

        return self._serialize_value(
            {
                "total_feedbacks": total_feedbacks,
                "true_positives": true_positives,
                "false_positives": false_positives,
                "uncertain": uncertain,
                "corrected_causes": corrected,
                "model_precision": precision,
                "precision_pct": (
                    f"{precision * 100:.1f}%"
                    if precision is not None
                    else "N/A"
                ),
                "unused_for_training": (
                    self.col_feedback.count_documents(
                        unused_query
                    )
                ),
                "retrain_threshold": 50,
                "retrain_ready": false_positives >= 50,
            }
        )

    def get_training_data(
        self,
        min_samples: int = 50,
    ) -> Optional[dict]:
        feedbacks = list(
            self.col_feedback.find(
                {"used_for_training": False}
            )
        )

        if len(feedbacks) < min_samples:
            return None

        true_positive_ids = []
        false_positive_ids = []
        false_positive_log_indices = []

        for feedback in feedbacks:
            anomaly_id = feedback.get("anomaly_id")
            label = feedback.get("label")
            snapshot = feedback.get("anomaly_snapshot", {})
            log_index = snapshot.get("log_index")

            if label == "true_positive":
                true_positive_ids.append(anomaly_id)
            elif label == "false_positive":
                false_positive_ids.append(anomaly_id)

                if log_index is not None:
                    false_positive_log_indices.append(
                        int(log_index)
                    )

        return {
            "true_positive_ids": true_positive_ids,
            "false_positive_ids": false_positive_ids,
            "false_positive_log_indices": list(
                dict.fromkeys(false_positive_log_indices)
            ),
            "total_samples": len(feedbacks),
            "feedback_ids": [
                feedback["_id"]
                for feedback in feedbacks
            ],
        }

    def retrain_with_feedback(self) -> dict:
        training_data = self.get_training_data(min_samples=50)

        if not training_data:
            return {
                "status": "SKIPPED",
                "reason": (
                    "Not enough unused feedbacks "
                    "(minimum 50 required)"
                ),
                "current": self.col_feedback.count_documents(
                    {"used_for_training": False}
                ),
            }

        if not self.dataset_path.exists():
            return {
                "status": "ERROR",
                "error": (
                    f"Dataset not found: {self.dataset_path}"
                ),
            }

        try:
            dataframe = pd.read_parquet(self.dataset_path)
            dataframe = dataframe.groupby("platform").sample(
                100000,
                replace=True,
            )

            false_positive_indices = set(
                training_data["false_positive_log_indices"]
            )

            if false_positive_indices:
                dataframe = dataframe.loc[
                    ~dataframe.index.isin(false_positive_indices)
                ].copy()

            base_features = [
                "message_length",
                "hour",
                "weekday",
                "is_error",
                "is_warning",
            ]
            platforms = [
                "smsc",
                "smpps",
                "smppc",
                "dmc",
                "mmg",
            ]

            for platform in platforms:
                dataframe[f"platform_{platform}"] = (
                    dataframe["platform"] == platform
                ).astype(int)

            features = base_features + [
                f"platform_{platform}"
                for platform in platforms
            ]
            x_train = dataframe[features]
            stats = self.get_feedback_stats()
            precision = stats.get("model_precision")

            if precision is None:
                precision = 0.95

            new_contamination = max(
                0.01,
                min(0.15, 1 - float(precision)),
            )
            iso_model = IsolationForest(
                contamination=new_contamination,
                random_state=42,
                n_estimators=150,
            )
            iso_model.fit(x_train)
            lof_model = LocalOutlierFactor(novelty=True)
            lof_model.fit(x_train.values)
            iso_scores = iso_model.decision_function(x_train)
            lof_scores = lof_model.decision_function(
                x_train.values
            )
            iso_scaler = MinMaxScaler()
            lof_scaler = MinMaxScaler()
            iso_scaler.fit(iso_scores.reshape(-1, 1))
            lof_scaler.fit(lof_scores.reshape(-1, 1))

            joblib.dump(
                iso_model,
                "ml/models/isolation_forest.pkl",
            )
            joblib.dump(
                lof_model,
                "ml/models/lof.pkl",
            )
            joblib.dump(
                iso_scaler,
                "ml/models/iso_scaler.pkl",
            )
            joblib.dump(
                lof_scaler,
                "ml/models/lof_scaler.pkl",
            )
            joblib.dump(features, "ml/models/features.pkl")

            reference_scores = (
                0.5
                * (1 - iso_scores)
                + 0.5
                * (1 - lof_scores)
            )
            detector = ModelDriftDetector()
            detector.set_reference(
                scores=reference_scores.tolist(),
                texts=(
                    dataframe["message"].astype(str).tolist()
                    if "message" in dataframe.columns
                    else None
                ),
                anomaly_rate=float(
                    np.mean(
                        reference_scores
                        > np.percentile(reference_scores, 95)
                    )
                ),
                metadata={
                    "source": "feedback_retrain",
                    "false_positive_log_indices": len(
                        false_positive_indices
                    ),
                },
            )

            now = datetime.now(timezone.utc)
            self.col_feedback.update_many(
                {
                    "_id": {
                        "$in": training_data["feedback_ids"]
                    }
                },
                {
                    "$set": {
                        "used_for_training": True,
                        "trained_at": now,
                    }
                },
            )
            self.col_retrain_log.insert_one(
                {
                    "timestamp": now,
                    "samples_used": training_data[
                        "total_samples"
                    ],
                    "false_positives_excluded": len(
                        false_positive_indices
                    ),
                    "new_contamination": new_contamination,
                    "model_precision_before": precision,
                    "status": "SUCCESS",
                }
            )

            return self._serialize_value(
                {
                    "status": "SUCCESS",
                    "samples_used": training_data[
                        "total_samples"
                    ],
                    "false_positives_excluded": len(
                        false_positive_indices
                    ),
                    "new_contamination": round(
                        float(new_contamination),
                        4,
                    ),
                    "timestamp": now,
                }
            )
        except Exception as error:
            return {
                "status": "ERROR",
                "error": str(error),
            }

    def get_operator_history(
        self,
        operator_id: str,
        limit: int = 50,
    ) -> list:
        documents = list(
            self.col_feedback.find(
                {"operator_id": operator_id}
            )
            .sort("created_at", -1)
            .limit(limit)
        )

        return self._serialize_value(documents)

    def get_pending_validation(
        self,
        platform: Optional[str] = None,
        limit: int = 20,
    ) -> list:
        query = {"feedback_label": {"$exists": False}}

        if platform:
            query["platform"] = {
                "$regex": f"^{re.escape(str(platform))}$",
                "$options": "i",
            }

        pipeline = [
            {"$match": query},
            {
                "$addFields": {
                    "sort_score": {
                        "$ifNull": [
                            "$anomaly_score",
                            "$model.score",
                        ]
                    }
                }
            },
            {"$sort": {"sort_score": -1, "created_at": -1}},
            {"$limit": int(limit)},
            {
                "$project": {
                    "platform": 1,
                    "message": 1,
                    "timestamp": 1,
                    "log_index": 1,
                    "status": 1,
                    "anomaly_score": {
                        "$ifNull": [
                            "$anomaly_score",
                            "$model.score",
                        ]
                    },
                    "threshold_used": 1,
                    "threshold_type": 1,
                }
            },
        ]

        documents = list(
            self.col_anomalies.aggregate(pipeline)
        )

        return self._serialize_value(documents)

    def _build_anomaly_snapshot(self, anomaly: dict) -> dict:
        model_data = anomaly.get("model", {})

        if not isinstance(model_data, dict):
            model_data = {}

        nested_log = anomaly.get("log", {})

        if not isinstance(nested_log, dict):
            nested_log = {}

        score = anomaly.get("anomaly_score")

        if score is None:
            score = model_data.get("score")

        platform = str(
            anomaly.get("platform")
            or nested_log.get("platform")
            or "UNKNOWN"
        ).upper()
        message = (
            anomaly.get("message")
            or nested_log.get("message")
            or ""
        )

        return {
            "log_index": anomaly.get("log_index"),
            "platform": platform,
            "message": str(message)[:200],
            "anomaly_score": score,
            "score": score,
            "threshold_used": anomaly.get("threshold_used"),
            "threshold_type": anomaly.get("threshold_type"),
            "detected_at": (
                anomaly.get("timestamp")
                or anomaly.get("created_at")
            ),
        }

    def _ensure_indexes(self):
        try:
            self.col_feedback.create_index("anomaly_id")
            self.col_feedback.create_index("label")
            self.col_feedback.create_index("created_at")
            self.col_feedback.create_index("operator_id")
            self.col_feedback.create_index("used_for_training")
        except Exception:
            pass

    def _to_object_id(self, value):
        try:
            return ObjectId(str(value))
        except Exception:
            return None

    def _serialize_value(self, value):
        if isinstance(value, dict):
            return {
                key: self._serialize_value(item)
                for key, item in value.items()
            }

        if isinstance(value, list):
            return [self._serialize_value(item) for item in value]

        if isinstance(value, ObjectId):
            return str(value)

        if isinstance(value, datetime):
            return value.isoformat()

        return value
