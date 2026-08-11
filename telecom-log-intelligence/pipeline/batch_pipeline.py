import gc
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from ai.engine.embedding_engine import EmbeddingEngine
from ai.engine.anomaly_threshold_engine import AnomalyThresholdEngine
from ai.engine.clustering_engine import ClusteringEngine
from ai.engine.causal_inference_engine import CausalInferenceEngine
from ai.engine.rca_engine import RCAEngine
from monitoring.model_drift_detector import ModelDriftDetector
from ml.incident.impact_estimator import IncidentImpactEstimator
from ml.incident.recommendation_engine import IncidentRecommendationEngine
from ml.incident.severity_engine import IncidentSeverityEngine
from ml.incident.severity_explainer import IncidentSeverityExplainer
from ml.incident.timeline_engine import IncidentTimelineEngine
from ml.training.hybrid_model import HybridAnomalyDetector
from pipeline.report_generator import IncidentReportGenerator
from pipeline.save_incident_report import IncidentReportSaver


class BatchPipeline:

    def __init__(
        self,
        dataset_path="data/processed/ml_dataset.parquet",
        cache_dir="data/cache",
        embedding_batch_size=256,
        detection_batch_size=10000,
        numeric_batch_size=50000,
        reuse_cached_embeddings=True,
        hybrid_threshold=0.65,
        enable_drift_monitoring=True,
        drift_sample_size=50000,
        drift_text_sample_size=10000,
        **_ignored,
    ):

        print("Initializing AI engines...")

        self.dataset_path = Path(dataset_path)
        self.cache_dir = Path(cache_dir)

        self.embedding_batch_size = embedding_batch_size
        self.detection_batch_size = detection_batch_size
        self.numeric_batch_size = numeric_batch_size
        self.hybrid_threshold = float(hybrid_threshold)
        self.enable_drift_monitoring = bool(enable_drift_monitoring)
        self.drift_sample_size = int(drift_sample_size)
        self.drift_text_sample_size = int(drift_text_sample_size)

        self.reuse_cached_embeddings = reuse_cached_embeddings

        self.embedding_engine = EmbeddingEngine()
        self.hybrid_detector = HybridAnomalyDetector()
        self.threshold_engine = AnomalyThresholdEngine()
        self.clustering_engine = ClusteringEngine()
        self.causal_engine = CausalInferenceEngine()
        self.rca_engine = RCAEngine()
        self.timeline_engine = IncidentTimelineEngine()
        self.report_saver = IncidentReportSaver()  
        self.severity_engine = IncidentSeverityEngine()
        self.severity_explainer = IncidentSeverityExplainer()
        self.recommendation_engine = IncidentRecommendationEngine()
        self.report_generator = IncidentReportGenerator()
        self.impact_estimator = IncidentImpactEstimator()

        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self.last_embeddings_file = None
        self.latest_detection_scores = []
        self.latest_detection_texts = []
        self.current_run_limit = None


    def run(self, limit=None, drift_window_label=None):
        self.current_run_limit = limit

        print("Loading dataset metadata...")

        parquet_file = pq.ParquetFile(self.dataset_path)

        total_logs = self._resolve_total_rows(parquet_file, limit)

        print("Dataset size:", total_logs)

        print("Generating embeddings (streaming mode)...")

        vectors, root_cause = self._generate_embeddings_to_disk(
            parquet_file,
            total_logs,
            limit=limit,
        )

        print("Embeddings shape:", vectors.shape)

        print("Detecting anomalies with HybridAnomalyDetector...")

        anomalies = self._detect_anomalies_with_hybrid_model(
            parquet_file,
            limit=limit,
        )
        drift_report = self._run_model_drift_analysis(
            drift_window_label=drift_window_label,
        )

        print("Total anomalies:", len(anomalies))

        anomaly_indices = [a["index"] for a in anomalies]

        print("Clustering anomalies...")

        if anomaly_indices:

            anomaly_vectors = np.asarray(
                vectors[anomaly_indices],
                dtype=np.float32
            )

            clusters = self.clustering_engine.cluster(anomaly_vectors)

        else:

            clusters = {}

        print("Clusters found:", len(clusters))

        print("Performing causal inference...")

        numeric_columns = self._get_numeric_columns(parquet_file)

        causal_links = self.causal_engine.compute_causality_from_batches(
            self._iter_numeric_batches(
                parquet_file,
                numeric_columns,
                limit=limit,
            )
        )

        print("Causal links:", len(causal_links))

        print("Running root cause analysis...")

        print("Root cause:", root_cause)

        print("Reconstructing incident timeline...")

        anomaly_details_df = self._load_anomaly_dataframe(
            parquet_file,
            anomaly_indices,
            limit=limit,
            requested_columns=[
                "platform",
                "timestamp",
                "message",
                "hour",
                "weekday",
                "is_error",
                "is_warning",
            ],
        )

        timeline = self.timeline_engine.reconstruct_timeline(
            anomaly_details_df,
            causal_links=causal_links,
            root_causes=root_cause,
        )

        severity_label, severity_score = (
            self.severity_engine.compute_severity(
                anomalies_count=len(anomalies),
                cascade=timeline["timeline"],
                causal_links=causal_links,
                root_causes=root_cause,
            )
        )

        impact = self.impact_estimator.estimate(
            timeline=timeline["timeline"],
            severity_label=severity_label,
            total_anomalies=len(anomalies),
            causal_links=len(causal_links),
        )

        severity_explanation = self.severity_explainer.explain(
            anomalies_count=len(anomalies),
            cascade=timeline["timeline"],
            causal_links=causal_links,
            root_causes=root_cause,
            severity_label=severity_label,
        )

        recommendations = self.recommendation_engine.recommend(root_cause)
        incident_intelligence = self._build_incident_intelligence(
            timeline=timeline,
            severity_label=severity_label,
            severity_score=severity_score,
            severity_explanation=severity_explanation,
            recommendations=recommendations,
            impact=impact,
            root_cause=root_cause,
            causal_links=causal_links,
            clusters=clusters,
        )

        print("\nINCIDENT TIMELINE")

        print(timeline["summary"])
        print("Incident severity:", severity_label)
        print("Incident severity score:", severity_score)
        print("Incident impact:", impact)
        print("Incident intelligence:", incident_intelligence["summary"])
        results = {

            "total_logs": total_logs,
            "total_anomalies": len(anomalies),
            "clusters": clusters,
            "causal_links": causal_links,
            "root_cause": root_cause,
            "incident_timeline": timeline,
            "impact": impact,
            "incident_intelligence": incident_intelligence,
            "model_drift": drift_report,
            "severity": {
                "label": severity_label,
                "score": severity_score,
                "explanation": severity_explanation,
                "recommendations": recommendations,

            },

        }

        print("Batch pipeline completed")
        saved_documents = self.report_saver.save_report(results)
        anomaly_documents = self._build_anomaly_documents(
            anomaly_details_df,
            anomalies,
        )
        self.report_saver.save_anomalies(
            anomaly_documents,
            incident_id=saved_documents.get("incident_id"),
        )
        self.report_generator.generate(results)

        return results

    def _build_incident_intelligence(
        self,
        timeline,
        severity_label,
        severity_score,
        severity_explanation,
        recommendations,
        impact,
        root_cause,
        causal_links,
        clusters,
    ):

        root_cause_items = root_cause.get("root_causes", [])

        return {
            "summary": timeline["summary"],
            "timeline": timeline["timeline"],
            "topology_aware": timeline.get("topology_aware", False),
            "cascade_validation": timeline.get(
                "cascade_validation",
                {},
            ),
            "weighted_causal_links": timeline.get(
                "weighted_causal_links",
                [],
            ),
            "root_platform_analysis": timeline.get(
                "root_platform_analysis",
                {},
            ),
            "severity_label": severity_label,
            "severity_score": severity_score,
            "severity_reasons": severity_explanation.get("reasons", []),
            "recommended_actions": recommendations,
            "affected_platforms": impact.get("affected_platforms", []),
            "sms_delivery_degradation": impact.get("sms_delivery_degradation"),
            "propagation_risk": impact.get("propagation_risk"),
            "cluster_count": len(clusters),
            "causal_relation_count": len(causal_links),
            "top_root_causes": root_cause_items[:10],
        }

    def _detect_anomalies_with_hybrid_model(
        self,
        parquet_file,
        limit=None,
    ):
        anomalies = []
        absolute_index = 0
        self.latest_detection_scores = []
        self.latest_detection_texts = []

        for batch_df in self._iter_detection_batches(
            parquet_file,
            limit=limit,
        ):
            batch_df = batch_df.reset_index(drop=True)
            batch_size = len(batch_df)

            if batch_size == 0:
                continue

            scores, confidence = self.hybrid_detector.predict_with_confidence(
                batch_df
            )
            self._update_drift_buffers(
                scores=scores,
                texts=batch_df["message"].tolist(),
            )
            normalized_platforms = (
                batch_df["platform"]
                .fillna("unknown")
                .astype(str)
                .str.upper()
            )
            platform_counts = normalized_platforms.value_counts()

            for local_index, row in batch_df.iterrows():
                platform = normalized_platforms.iloc[local_index]
                threshold = self.threshold_engine.get_threshold(
                    platform=platform,
                    hour=int(row.get("hour", 0) or 0),
                    weekday=int(row.get("weekday", 0) or 0),
                    log_volume=int(platform_counts.get(platform, 1)),
                )

                if float(scores[local_index]) <= threshold:
                    continue

                anomalies.append(
                    {
                        "index": absolute_index + local_index,
                        "score": float(scores[local_index]),
                        "confidence": float(confidence[local_index]),
                        "threshold_used": threshold,
                        "threshold_type": "dynamic",
                    }
                )

            for platform in normalized_platforms.unique():
                platform_scores = scores[
                    normalized_platforms == platform
                ].tolist()
                self.threshold_engine.update_score_history(
                    platform,
                    platform_scores,
                )

            absolute_index += batch_size

        return anomalies

    def _run_model_drift_analysis(self, drift_window_label=None):
        if not self.enable_drift_monitoring:
            return {
                "enabled": False,
                "message": "Model drift monitoring is disabled",
            }

        if not self.latest_detection_scores:
            return {
                "enabled": True,
                "message": "No detection scores available for drift analysis",
            }

        detector = ModelDriftDetector()
        anomaly_rate = float(
            np.mean(
                np.asarray(
                    self.latest_detection_scores,
                    dtype=np.float32,
                ) > self.hybrid_threshold
            )
        )

        if not detector.reference:
            reference = detector.set_reference(
                scores=self.latest_detection_scores,
                texts=self.latest_detection_texts,
                anomaly_rate=anomaly_rate,
                metadata={
                    "source": "batch_pipeline",
                    "window_label": drift_window_label,
                },
            )
            print("\nMODEL DRIFT")
            print("Drift reference created from current batch.")

            return {
                "reference_created": True,
                "timestamp": reference.get("timestamp"),
                "n_samples": reference.get("n_samples"),
                "anomaly_rate": reference.get("anomaly_rate"),
            }

        label = drift_window_label or (
            "batch_"
            + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        )
        report = detector.run_full_drift_analysis(
            current_scores=self.latest_detection_scores,
            current_texts=self.latest_detection_texts,
            window_label=label,
            anomaly_threshold=self.hybrid_threshold,
            metadata={
                "source": "batch_pipeline",
                "limit": self.current_run_limit,
            },
        )

        print("\nMODEL DRIFT")
        print(
            "Drift severity:",
            report.get("drift_severity"),
        )
        print(
            "Drift verdict:",
            report.get("verdict"),
        )

        return report

    def _update_drift_buffers(self, scores, texts):
        if len(self.latest_detection_scores) < self.drift_sample_size:
            remaining = self.drift_sample_size - len(
                self.latest_detection_scores
            )
            self.latest_detection_scores.extend(
                [
                    float(score)
                    for score in np.asarray(scores).tolist()[:remaining]
                ]
            )

        if len(self.latest_detection_texts) < self.drift_text_sample_size:
            remaining = self.drift_text_sample_size - len(
                self.latest_detection_texts
            )
            self.latest_detection_texts.extend(
                [str(text) for text in texts[:remaining]]
            )


    def _resolve_total_rows(self, parquet_file, limit=None):

        total_rows = parquet_file.metadata.num_rows

        if limit is None:
            return total_rows

        return min(int(limit), total_rows)


    def _prepare_embeddings_file(self):

        if (
            self.last_embeddings_file
            and self.last_embeddings_file.exists()
        ):
            self.last_embeddings_file.unlink()


    def _generate_embeddings_to_disk(
        self,
        parquet_file,
        total_logs,
        limit=None
    ):

        embedding_dim = self.embedding_engine.embedding_dimension

        embeddings_file = self._get_embeddings_file(
            total_logs,
            embedding_dim
        )

        self.last_embeddings_file = embeddings_file

        root_cause_counter = self.rca_engine.create_counter()

        if total_logs == 0:

            empty_vectors = np.empty(
                (0, embedding_dim),
                dtype=np.float32
            )

            return (
                empty_vectors,
                self.rca_engine.summarize(root_cause_counter)
            )

        if self._can_reuse_embeddings_cache(
            embeddings_file,
            total_logs,
            embedding_dim
        ):

            print(f"Reusing cached embeddings from {embeddings_file}")

            self._update_root_cause_from_stream(
                parquet_file,
                root_cause_counter,
                limit=limit,
            )

            readonly_vectors = np.memmap(
                embeddings_file,
                dtype=np.float32,
                mode="r",
                shape=(total_logs, embedding_dim),
            )

            return (
                readonly_vectors,
                self.rca_engine.summarize(root_cause_counter)
            )


        self._prepare_embeddings_file()


        vectors = np.memmap(
            embeddings_file,
            dtype=np.float32,
            mode="w+",
            shape=(total_logs, embedding_dim),
        )

        write_index = 0


        for batch_logs in self._iter_message_batches(
            parquet_file,
            limit=limit
        ):

            batch_end = write_index + len(batch_logs)

            print(f"Embedding batch {write_index} -> {batch_end}")

            batch_vectors = self.embedding_engine.embed_batch(
                batch_logs,
                batch_size=self.embedding_batch_size,
            )

            vectors[write_index:batch_end] = batch_vectors

            write_index = batch_end

            vectors.flush()

            del batch_vectors

            gc.collect()


        vectors.flush()

        del vectors

        gc.collect()


        readonly_vectors = np.memmap(
            embeddings_file,
            dtype=np.float32,
            mode="r",
            shape=(total_logs, embedding_dim),
        )

        self._update_root_cause_from_stream(
            parquet_file,
            root_cause_counter,
            limit=limit,
        )

        return (
            readonly_vectors,
            self.rca_engine.summarize(root_cause_counter)
        )


    def _get_embeddings_file(
        self,
        total_logs,
        embedding_dim
    ):

        return self.cache_dir / f"embeddings_{total_logs}_{embedding_dim}.memmap"


    def _can_reuse_embeddings_cache(
        self,
        embeddings_file,
        total_logs,
        embedding_dim
    ):

        if (
            not self.reuse_cached_embeddings
            or not embeddings_file.exists()
        ):
            return False

        expected_size = (
            total_logs
            * embedding_dim
            * np.dtype(np.float32).itemsize
        )

        return embeddings_file.stat().st_size == expected_size


    def _update_root_cause_from_stream(
        self,
        parquet_file,
        counter,
        limit=None
    ):

        for batch_logs in self._iter_rca_batches(
            parquet_file,
            limit=limit
        ):
            self.rca_engine.update_counter(batch_logs, counter)

    def _iter_rca_batches(
        self,
        parquet_file,
        limit=None,
    ):
        available_columns = set(parquet_file.schema_arrow.names)
        selected_columns = [
            column
            for column in ["message", "platform"]
            if column in available_columns
        ]

        remaining = self._resolve_total_rows(
            parquet_file,
            limit,
        )

        for record_batch in parquet_file.iter_batches(
            batch_size=self.embedding_batch_size,
            columns=selected_columns or None,
        ):
            if remaining <= 0:
                break

            current_size = min(
                record_batch.num_rows,
                remaining,
            )
            batch_df = record_batch.slice(0, current_size).to_pandas()
            remaining -= current_size

            if "message" not in batch_df.columns:
                batch_df["message"] = ""

            if "platform" not in batch_df.columns:
                batch_df["platform"] = None

            yield batch_df[
                ["message", "platform"]
            ].to_dict("records")


    def _iter_message_batches(
        self,
        parquet_file,
        limit=None
    ):

        remaining = self._resolve_total_rows(
            parquet_file,
            limit
        )

        for record_batch in parquet_file.iter_batches(
            batch_size=self.embedding_batch_size,
            columns=["message"],
        ):

            if remaining <= 0:
                break

            current_size = min(
                record_batch.num_rows,
                remaining
            )

            message_column = record_batch.column(0).slice(
                0,
                current_size
            )

            batch_logs = []

            for value in message_column.to_pylist():

                if value is None:
                    batch_logs.append("")

                elif isinstance(value, str):
                    batch_logs.append(value)

                else:
                    batch_logs.append(str(value))

            remaining -= current_size

            yield batch_logs


    def _get_numeric_columns(self, parquet_file):

        numeric_columns = []

        for field in parquet_file.schema_arrow:

            if (
                pa.types.is_integer(field.type)
                or pa.types.is_floating(field.type)
                or pa.types.is_timestamp(field.type)
            ):
                numeric_columns.append(field.name)

        return numeric_columns


    def _iter_numeric_batches(
        self,
        parquet_file,
        numeric_columns,
        limit=None
    ):

        if not numeric_columns:
            return

        remaining = self._resolve_total_rows(
            parquet_file,
            limit
        )

        for record_batch in parquet_file.iter_batches(
            batch_size=self.numeric_batch_size,
            columns=numeric_columns,
        ):

            if remaining <= 0:
                break

            current_size = min(
                record_batch.num_rows,
                remaining
            )

            batch_frame = record_batch.slice(
                0,
                current_size
            ).to_pandas()

            remaining -= current_size

            yield batch_frame

    def _iter_detection_batches(
        self,
        parquet_file,
        limit=None,
    ):
        required_columns = [
            "message",
            "message_length",
            "platform",
            "timestamp",
            "hour",
            "weekday",
            "is_error",
            "is_warning",
        ]
        available_columns = set(parquet_file.schema_arrow.names)
        selected_columns = [
            column
            for column in required_columns
            if column in available_columns
        ]

        remaining = self._resolve_total_rows(
            parquet_file,
            limit,
        )

        for record_batch in parquet_file.iter_batches(
            batch_size=self.detection_batch_size,
            columns=selected_columns or None,
        ):
            if remaining <= 0:
                break

            current_size = min(
                record_batch.num_rows,
                remaining,
            )
            batch_df = record_batch.slice(0, current_size).to_pandas()

            remaining -= current_size

            yield self._prepare_detection_batch(batch_df)

    def _prepare_detection_batch(self, batch_df):
        detection_df = batch_df.copy()

        if "message" not in detection_df.columns:
            detection_df["message"] = ""

        detection_df["message"] = (
            detection_df["message"]
            .fillna("")
            .astype(str)
        )

        lowered_message = detection_df["message"].str.lower()

        if "platform" not in detection_df.columns:
            detection_df["platform"] = "unknown"

        detection_df["platform"] = (
            detection_df["platform"]
            .fillna("unknown")
            .astype(str)
            .str.lower()
        )

        if "message_length" in detection_df.columns:
            message_length = pd.to_numeric(
                detection_df["message_length"],
                errors="coerce",
            )
            detection_df["message_length"] = message_length.fillna(
                detection_df["message"].str.len()
            ).astype(int)
        else:
            detection_df["message_length"] = (
                detection_df["message"].str.len().astype(int)
            )

        if "timestamp" in detection_df.columns:
            timestamp_series = pd.to_datetime(
                detection_df["timestamp"],
                errors="coerce",
            )
        else:
            timestamp_series = pd.Series(
                pd.NaT,
                index=detection_df.index,
            )

        detection_df["hour"] = self._fill_detection_numeric_feature(
            detection_df,
            "hour",
            timestamp_series.dt.hour.fillna(0),
        )
        detection_df["weekday"] = self._fill_detection_numeric_feature(
            detection_df,
            "weekday",
            timestamp_series.dt.dayofweek.fillna(0),
        )
        detection_df["is_error"] = self._fill_detection_numeric_feature(
            detection_df,
            "is_error",
            lowered_message.str.contains(
                "error|fail|exception",
                regex=True,
                na=False,
            ).astype(int),
        )
        detection_df["is_warning"] = self._fill_detection_numeric_feature(
            detection_df,
            "is_warning",
            lowered_message.str.contains(
                "warn|warning",
                regex=True,
                na=False,
            ).astype(int),
        )

        return detection_df[
            [
                "message",
                "message_length",
                "hour",
                "weekday",
                "is_error",
                "is_warning",
                "platform",
            ]
        ]

    def _fill_detection_numeric_feature(
        self,
        detection_df,
        column_name,
        fallback_values,
    ):
        if column_name in detection_df.columns:
            numeric_values = pd.to_numeric(
                detection_df[column_name],
                errors="coerce",
            )
            return numeric_values.fillna(fallback_values).astype(int)

        return fallback_values.astype(int)


    def _load_anomaly_dataframe(
        self,
        parquet_file,
        anomaly_indices,
        limit=None,
        requested_columns=None,
    ):

        if not anomaly_indices:
            return pd.DataFrame()

        if requested_columns is None:
            requested_columns = [
                "platform",
                "timestamp",
                "hour",
                "is_error",
                "is_warning",
            ]

        available_columns = set(parquet_file.schema_arrow.names)
        selected_columns = [
            column
            for column in requested_columns
            if column in available_columns
        ]

        if not selected_columns:
            return pd.DataFrame(columns=requested_columns)

        target_indices = sorted(
            int(index)
            for index in anomaly_indices
            if index >= 0
        )

        collected_frames = []
        current_target = 0
        absolute_start = 0
        remaining = self._resolve_total_rows(parquet_file, limit)

        for record_batch in parquet_file.iter_batches(
            batch_size=self.numeric_batch_size,
            columns=selected_columns,
        ):
            if remaining <= 0 or current_target >= len(target_indices):
                break

            current_size = min(record_batch.num_rows, remaining)
            batch_end = absolute_start + current_size
            local_positions = []

            while current_target < len(target_indices):
                target_index = target_indices[current_target]

                if target_index >= batch_end:
                    break

                if target_index >= absolute_start:
                    local_positions.append(target_index - absolute_start)

                current_target += 1

            if local_positions:
                batch_df = record_batch.slice(0, current_size).to_pandas()
                collected_frames.append(batch_df.iloc[local_positions].copy())

            absolute_start = batch_end
            remaining -= current_size

        if not collected_frames:
            return pd.DataFrame(columns=selected_columns)

        anomaly_df = pd.concat(collected_frames, ignore_index=True)

        for column in requested_columns:
            if column not in anomaly_df.columns:
                anomaly_df[column] = None

        return anomaly_df[requested_columns]

    def _build_anomaly_documents(
        self,
        anomaly_df,
        anomalies,
    ):
        if anomaly_df.empty or not anomalies:
            return []

        anomaly_metrics = {
            int(anomaly["index"]): {
                "score": float(anomaly["score"]),
                "confidence": float(anomaly.get("confidence", 0.0)),
                "threshold_used": anomaly.get("threshold_used"),
                "threshold_type": anomaly.get("threshold_type"),
            }
            for anomaly in anomalies
        }
        anomaly_documents = []

        for row_position, dataset_index in enumerate(sorted(anomaly_metrics)):
            row = anomaly_df.iloc[row_position]
            metrics = anomaly_metrics[dataset_index]
            message = self._normalize_cell(row.get("message"))
            is_error = self._coerce_flag(
                row.get("is_error"),
                message,
                fallback_keywords=("error", "fail"),
            )
            is_warning = self._coerce_flag(
                row.get("is_warning"),
                message,
                fallback_keywords=("warn", "warning"),
            )

            anomaly_documents.append(
                {
                    "log_index": dataset_index,
                    "timestamp": self._normalize_cell(row.get("timestamp")),
                    "platform": self._normalize_cell(row.get("platform")),
                    "message": message,
                    "features": {
                        "hour": self._normalize_cell(row.get("hour")),
                        "weekday": self._normalize_cell(row.get("weekday")),
                        "is_error": is_error,
                        "is_warning": is_warning,
                    },
                    "model": {
                        "score": metrics["score"],
                        "confidence": metrics["confidence"],
                        "model": "hybrid_anomaly_v2",
                    },
                    "threshold_used": metrics.get("threshold_used"),
                    "threshold_type": metrics.get("threshold_type"),
                    "rca": None,
                    "action": None,
                    "status": "open",
                    "source": "batch_pipeline",
                }
            )

        return anomaly_documents

    def _normalize_cell(self, value):
        if value is None:
            return None

        if pd.isna(value):
            return None

        if hasattr(value, "to_pydatetime"):
            return value.to_pydatetime()

        if isinstance(value, np.generic):
            return value.item()

        return value

    def _coerce_flag(
        self,
        value,
        message,
        fallback_keywords,
    ):
        normalized_value = self._normalize_cell(value)

        if normalized_value is not None:
            return int(bool(normalized_value))

        if isinstance(message, str):
            lowered_message = message.lower()
            return int(
                any(keyword in lowered_message for keyword in fallback_keywords)
            )

        return 0


if __name__ == "__main__":

    pipeline = BatchPipeline()

    results = pipeline.run()

    print("\n===== RESULTS =====")

    print("Logs:", results["total_logs"])

    print("Anomalies:", results["total_anomalies"])

    print("Clusters:", len(results["clusters"]))

    print("Causal links:", len(results["causal_links"]))

    print("Root cause:", results["root_cause"])

    print("\nSeverity explanation:")

    for reason in results["severity"]["explanation"]["reasons"]:
        print("-", reason)

    print("\nRecommendations actions:")

    for action in results["severity"]["recommendations"]:
        print("-", action)
