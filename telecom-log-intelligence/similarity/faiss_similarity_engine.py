import os
import gc
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
from pymongo import MongoClient
from bson import ObjectId

try:
    import faiss  # type: ignore
except ImportError:  # pragma: no cover
    faiss = None

try:
    import pyarrow.parquet as pq  # type: ignore
except ImportError:  # pragma: no cover
    pq = None


class FaissSimilarityEngine:

    DEFAULT_DIMENSION = 384

    def __init__(
        self,
        mongo_uri: Optional[str] = None,
        db_name: Optional[str] = None,
        embeddings_path: Optional[str] = None,
        index_path: Optional[str] = None,
        dataset_path: Optional[str] = None,
        dimension: int = DEFAULT_DIMENSION,
    ):
        self.dimension = int(dimension)
        self.embeddings_path = self._resolve_embeddings_path(
            embeddings_path
        )
        self.index_path = Path(
            index_path or os.getenv(
                "FAISS_INDEX_PATH",
                "data/cache/faiss_index.bin",
            )
        )
        self.dataset_path = self._resolve_dataset_path(dataset_path)
        self.index = None
        self.embeddings = None
        self.total_logs = self._resolve_total_logs()
        self.mongo_uri = mongo_uri or os.getenv(
            "MONGO_URI",
            "mongodb://localhost:27017/",
        )
        self.db_name = db_name or os.getenv(
            "DATABASE_NAME",
            "telecom_logs",
        )
        self.mongo = MongoClient(
            self.mongo_uri,
            serverSelectionTimeoutMS=5000,
        )
        self.db = self.mongo[self.db_name]
        self._dataset_file = None
        self._dataset_row_groups = None
        self._cached_row_group_index = None
        self._cached_row_group_table = None
        self._build_lock = threading.Lock()
        self._build_thread = None
        self._build_state = {
            "status": "idle",
            "message": None,
            "error": None,
            "started_at": None,
            "finished_at": None,
            "progress_pct": 0.0,
            "processed_vectors": 0,
            "total_vectors": int(self.total_logs),
        }

    def build_index(
        self,
        force_rebuild: bool = False,
        background: bool = False,
    ) -> dict:
        if background:
            return self.start_build_index(force_rebuild=force_rebuild)

        return self._build_index_sync(force_rebuild=force_rebuild)

    def start_build_index(
        self,
        force_rebuild: bool = False,
    ) -> dict:
        self._require_faiss()

        with self._build_lock:
            if (
                self._build_thread is not None
                and self._build_thread.is_alive()
            ):
                return self.get_build_status()

            if (
                not force_rebuild
                and self.index_path.exists()
            ):
                self._load_index_from_disk()
                self._set_build_state(
                    status="completed",
                    message="Existing FAISS index loaded from disk.",
                    error=None,
                    started_at=self._now_iso(),
                    finished_at=self._now_iso(),
                    progress_pct=100.0,
                    processed_vectors=int(self.index.ntotal),
                    total_vectors=int(self.total_logs),
                )
                return self.get_build_status()

            self._set_build_state(
                status="running",
                message="FAISS build started in background.",
                error=None,
                started_at=self._now_iso(),
                finished_at=None,
                progress_pct=0.0,
                processed_vectors=0,
                total_vectors=int(self.total_logs),
            )
            self._build_thread = threading.Thread(
                target=self._build_index_worker,
                kwargs={"force_rebuild": force_rebuild},
                daemon=True,
                name="faiss-build-thread",
            )
            self._build_thread.start()

        return self.get_build_status()

    def get_build_status(self) -> dict:
        return {
            **self._build_state,
            "index_exists": self.index_path.exists(),
            "index_path": str(self.index_path),
            "embeddings_path": str(self.embeddings_path),
        }

    def _build_index_worker(
        self,
        force_rebuild: bool,
    ) -> None:
        try:
            result = self._build_index_sync(force_rebuild=force_rebuild)
            self._set_build_state(
                status="completed",
                message=(
                    f"FAISS index {result.get('status', 'built')} successfully."
                ),
                error=None,
                finished_at=self._now_iso(),
                progress_pct=100.0,
                processed_vectors=int(result.get("total_vectors", 0)),
                total_vectors=int(self.total_logs),
            )
        except Exception as error:
            self._set_build_state(
                status="failed",
                message="FAISS build failed.",
                error=str(error),
                finished_at=self._now_iso(),
            )

    def _build_index_sync(self, force_rebuild: bool = False) -> dict:
        self._require_faiss()

        if not self.embeddings_path.exists():
            raise FileNotFoundError(
                f"Embeddings file not found: {self.embeddings_path}"
            )

        if (
            not force_rebuild
            and self.index_path.exists()
        ):
            self._load_index_from_disk()
            return {
                "status": "loaded",
                "index_path": str(self.index_path),
                "total_vectors": int(self.index.ntotal),
            }

        embeddings = self._load_embeddings()
        total_logs = self.total_logs

        if total_logs == 0:
            raise RuntimeError("No embeddings available to index.")

        self._set_build_state(
            status="running",
            message="Preparing FAISS index structure.",
            error=None,
            progress_pct=2.0,
            total_vectors=int(total_logs),
        )

        nlist = min(
            max(64, int(np.sqrt(total_logs))),
            4096,
        )
        quantizer = faiss.IndexFlatL2(self.dimension)
        subquantizers = self._resolve_pq_subquantizers()
        pq_index = faiss.IndexIVFPQ(
            quantizer,
            self.dimension,
            nlist,
            subquantizers,
            8,
        )
        self.index = faiss.IndexIDMap2(pq_index)

        sample_size = min(total_logs, 200_000)
        rng = np.random.default_rng(42)
        sample_indices = rng.choice(
            total_logs,
            size=sample_size,
            replace=False,
        )
        sample_indices.sort()
        training_sample = np.asarray(
            embeddings[sample_indices],
            dtype=np.float32,
        )
        self._set_build_state(
            status="running",
            message=(
                f"Training compressed FAISS index on {sample_size:,} samples."
            ),
            progress_pct=10.0,
            processed_vectors=0,
        )
        self.index.train(training_sample)
        del training_sample
        gc.collect()

        batch_size = 50_000

        for start in range(0, total_logs, batch_size):
            end = min(start + batch_size, total_logs)
            batch = np.asarray(
                embeddings[start:end],
                dtype=np.float32,
            )
            batch_ids = np.arange(
                start,
                end,
                dtype=np.int64,
            )
            self.index.add_with_ids(batch, batch_ids)
            del batch
            del batch_ids
            gc.collect()
            self._set_build_state(
                status="running",
                message=(
                    f"Indexing vectors {start:,} to {end:,} / {total_logs:,}."
                ),
                progress_pct=round(
                    10.0 + ((end / total_logs) * 80.0),
                    2,
                ),
                processed_vectors=int(end),
            )

        self._set_nprobe(
            min(24, nlist),
        )
        self._set_build_state(
            status="running",
            message="Writing FAISS index to disk.",
            progress_pct=95.0,
            processed_vectors=int(total_logs),
        )
        self.index_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )
        faiss.write_index(self.index, str(self.index_path))

        return {
            "status": "built",
            "index_path": str(self.index_path),
            "total_vectors": int(self.index.ntotal),
            "nlist": int(nlist),
            "nprobe": int(self._get_nprobe_value()),
            "index_family": "IVFPQ",
            "subquantizers": int(subquantizers),
        }

    def search_similar_logs(
        self,
        query_embedding: np.ndarray,
        k: int = 5,
        platform_filter: Optional[str] = None,
    ) -> list:
        self._ensure_index_loaded()
        query = np.asarray(
            query_embedding,
            dtype=np.float32,
        ).reshape(1, -1)
        k = max(1, int(k))
        k_search = k * 5 if platform_filter else k
        distances, indices = self.index.search(query, k_search)
        results = []

        for distance, idx in zip(distances[0], indices[0]):
            if idx == -1:
                continue

            log_document = self._get_log_document(int(idx))

            if (
                platform_filter
                and str(log_document.get("platform", "")).upper()
                != str(platform_filter).upper()
            ):
                continue

            results.append(
                {
                    "log_index": int(idx),
                    "distance": round(float(distance), 4),
                    "similarity_score": round(
                        1.0 / (1.0 + float(distance)),
                        4,
                    ),
                    "platform": log_document.get("platform", "N/A"),
                    "message": log_document.get("message", "N/A"),
                    "timestamp": log_document.get("timestamp"),
                    "level": log_document.get("level", "N/A"),
                    "is_anomaly": bool(
                        log_document.get("is_anomaly", False)
                    ),
                    "incident_id": log_document.get("incident_id"),
                    "source_collection": log_document.get(
                        "source_collection",
                        "unknown",
                    ),
                }
            )

            if len(results) >= k:
                break

        return results

    def search_similar_logs_by_index(
        self,
        log_index: int,
        k: int = 5,
        platform_filter: Optional[str] = None,
    ) -> dict:
        query_embedding = self.get_embedding_for_log_index(log_index)
        results = self.search_similar_logs(
            query_embedding=query_embedding,
            k=k,
            platform_filter=platform_filter,
        )

        return {
            "query_log_index": int(log_index),
            "results": results,
            "count": len(results),
            "search_timestamp": datetime.now(
                timezone.utc
            ).isoformat(),
        }

    def search_similar_incident(
        self,
        incident_id: str,
        k: int = 3,
    ) -> dict:
        incident_document = self._get_incident_document(incident_id)

        if incident_document is None:
            return {
                "error": f"Incident {incident_id} not found"
            }

        anomaly_indices = self._get_incident_log_indices(
            incident_document,
            incident_id,
        )

        if not anomaly_indices:
            return {
                "error": (
                    "No anomaly log indexes found for this incident"
                )
            }

        centroid = self._compute_incident_centroid(
            anomaly_indices
        )

        if centroid is None:
            return {
                "error": "Unable to compute incident centroid"
            }

        similar_logs = self.search_similar_logs(
            centroid,
            k=max(10, k * 10),
        )
        similar_incidents = []
        seen_incidents = {str(incident_id)}

        for log_result in similar_logs:
            related_incident_id = log_result.get("incident_id")

            if not related_incident_id:
                continue

            related_incident_key = str(related_incident_id)

            if related_incident_key in seen_incidents:
                continue

            related_incident = self._get_incident_document(
                related_incident_key
            )

            if related_incident is None:
                continue

            seen_incidents.add(related_incident_key)
            similar_incidents.append(
                {
                    "incident_id": related_incident_key,
                    "created_at": related_incident.get(
                        "created_at"
                    ),
                    "severity": self._extract_incident_severity(
                        related_incident
                    ),
                    "timeline": self._extract_incident_timeline(
                        related_incident
                    ),
                    "top_causes": self._extract_incident_top_causes(
                        related_incident
                    ),
                    "similarity": log_result.get(
                        "similarity_score"
                    ),
                }
            )

            if len(similar_incidents) >= k:
                break

        return {
            "current_incident_id": str(incident_id),
            "similar_incidents": similar_incidents,
            "count": len(similar_incidents),
            "search_timestamp": datetime.now(
                timezone.utc
            ).isoformat(),
        }

    def search_by_text(
        self,
        query_text: str,
        k: int = 5,
        embedding_engine=None,
        platform_filter: Optional[str] = None,
    ) -> list:
        if embedding_engine is None:
            raise ValueError(
                "EmbeddingEngine instance is required."
            )

        query_embedding = embedding_engine.embed_batch(
            [query_text],
            batch_size=1,
        )[0]

        return self.search_similar_logs(
            query_embedding=query_embedding,
            k=k,
            platform_filter=platform_filter,
        )

    def get_embedding_for_log_index(
        self,
        log_index: int,
    ) -> np.ndarray:
        embeddings = self._load_embeddings()
        log_index = int(log_index)

        if log_index < 0 or log_index >= self.total_logs:
            raise IndexError(
                f"log_index {log_index} is outside embedding range"
            )

        return np.asarray(
            embeddings[log_index],
            dtype=np.float32,
        )

    def get_stats(self) -> dict:
        return {
            "available": bool(faiss is not None),
            "dimension": self.dimension,
            "embeddings_path": str(self.embeddings_path),
            "embeddings_exists": self.embeddings_path.exists(),
            "dataset_path": str(self.dataset_path),
            "dataset_exists": self.dataset_path.exists(),
            "index_path": str(self.index_path),
            "index_exists": self.index_path.exists(),
            "total_vectors": int(self.total_logs),
            "index_loaded": self.index is not None,
            "index_type": (
                type(self.index).__name__
                if self.index is not None
                else None
            ),
            "nprobe": (
                int(self._get_nprobe_value())
                if self.index is not None and self._get_nprobe_value() is not None
                else None
            ),
            "index_size_mb": (
                round(self.index_path.stat().st_size / 1e6, 1)
                if self.index_path.exists()
                else None
            ),
            "message": (
                "faiss-cpu not installed"
                if faiss is None
                else None
            ),
            "build_status": self._build_state.get("status"),
            "build_message": self._build_state.get("message"),
            "build_error": self._build_state.get("error"),
            "build_progress_pct": self._build_state.get("progress_pct"),
            "build_started_at": self._build_state.get("started_at"),
            "build_finished_at": self._build_state.get("finished_at"),
            "processed_vectors": self._build_state.get(
                "processed_vectors"
            ),
        }

    def _require_faiss(self):
        if faiss is None:
            raise RuntimeError(
                "FAISS is not installed. Run: pip install faiss-cpu"
            )

    def _ensure_index_loaded(self):
        self._require_faiss()

        if self.index is not None:
            return

        if not self.index_path.exists():
            raise RuntimeError(
                "FAISS index not found. Build it first with "
                "FaissSimilarityEngine.build_index()."
            )

        self._load_index_from_disk()

    def _load_index_from_disk(self):
        self._require_faiss()
        self.index = faiss.read_index(str(self.index_path))
        self._set_nprobe(24)

    def _load_embeddings(self):
        if self.embeddings is not None:
            return self.embeddings

        if not self.embeddings_path.exists():
            raise FileNotFoundError(
                f"Embeddings file not found: {self.embeddings_path}"
            )

        self.embeddings = np.memmap(
            self.embeddings_path,
            dtype=np.float32,
            mode="r",
            shape=(self.total_logs, self.dimension),
        )

        return self.embeddings

    def _resolve_embeddings_path(
        self,
        explicit_path: Optional[str],
    ) -> Path:
        if explicit_path:
            return Path(explicit_path)

        env_path = os.getenv("FAISS_EMBEDDINGS_PATH")

        if env_path:
            return Path(env_path)

        default_path = Path(
            "data/cache/embeddings_7224549_384.memmap"
        )

        if default_path.exists():
            return default_path

        cache_dir = Path("data/cache")
        candidates = sorted(
            cache_dir.glob(f"embeddings_*_{self.dimension}.memmap"),
            key=lambda item: item.stat().st_size,
            reverse=True,
        )

        if candidates:
            return candidates[0]

        return default_path

    def _resolve_dataset_path(
        self,
        explicit_path: Optional[str],
    ) -> Path:
        if explicit_path:
            return Path(explicit_path)

        env_path = os.getenv("FAISS_DATASET_PATH")

        if env_path:
            return Path(env_path)

        return Path("data/processed/ml_dataset.parquet")

    def _get_dataset_file(self):
        if pq is None or not self.dataset_path.exists():
            return None

        if self._dataset_file is None:
            self._dataset_file = pq.ParquetFile(self.dataset_path)

        return self._dataset_file

    def _get_dataset_row_groups(self):
        if self._dataset_row_groups is not None:
            return self._dataset_row_groups

        dataset_file = self._get_dataset_file()

        if dataset_file is None:
            self._dataset_row_groups = []
            return self._dataset_row_groups

        row_groups = []
        start = 0

        for row_group_index in range(dataset_file.num_row_groups):
            num_rows = dataset_file.metadata.row_group(
                row_group_index
            ).num_rows
            end = start + int(num_rows)
            row_groups.append((start, end, row_group_index))
            start = end

        self._dataset_row_groups = row_groups
        return self._dataset_row_groups

    def _resolve_total_logs(self) -> int:
        if not self.embeddings_path.exists():
            return 0

        bytes_per_vector = (
            np.dtype(np.float32).itemsize * self.dimension
        )
        file_size = self.embeddings_path.stat().st_size

        if file_size % bytes_per_vector != 0:
            raise ValueError(
                "Embeddings memmap size is not aligned with dimension"
            )

        return file_size // bytes_per_vector

    def _get_log_document(self, log_index: int) -> dict:
        anomaly_document = self.db.anomalies.find_one(
            {"log_index": int(log_index)}
        )

        if anomaly_document:
            nested_log = anomaly_document.get("log", {})
            return {
                "log_index": int(log_index),
                "platform": anomaly_document.get("platform")
                or nested_log.get("platform"),
                "message": anomaly_document.get("message")
                or nested_log.get("message"),
                "timestamp": anomaly_document.get("timestamp")
                or nested_log.get("timestamp"),
                "level": self._infer_level(anomaly_document),
                "is_anomaly": True,
                "incident_id": self._normalize_identifier(
                    anomaly_document.get("incident_id")
                ),
                "source_collection": "anomalies",
            }

        dataset_document = self._get_log_document_from_dataset(
            int(log_index)
        )

        if dataset_document is not None:
            return dataset_document

        for collection_name in ["logs", "log_features"]:
            document = self.db[collection_name].find_one(
                {
                    "$or": [
                        {"log_index": int(log_index)},
                        {"index": int(log_index)},
                    ]
                }
            )

            if document:
                nested_log = document.get("log", {})
                return {
                    "log_index": int(log_index),
                    "platform": document.get("platform")
                    or nested_log.get("platform"),
                    "message": document.get("message")
                    or nested_log.get("message"),
                    "timestamp": document.get("timestamp")
                    or nested_log.get("timestamp"),
                    "level": document.get("level")
                    or nested_log.get("level"),
                    "is_anomaly": bool(
                        document.get("is_anomaly", False)
                    ),
                    "incident_id": None,
                    "source_collection": collection_name,
                }

        return {
            "log_index": int(log_index),
            "platform": "N/A",
            "message": "Log metadata not found in MongoDB",
            "timestamp": None,
            "level": "N/A",
            "is_anomaly": False,
            "incident_id": None,
            "source_collection": "unavailable",
        }

    def _get_log_document_from_dataset(
        self,
        log_index: int,
    ) -> Optional[dict]:
        row_groups = self._get_dataset_row_groups()

        if not row_groups:
            return None

        row_group_index = None
        row_group_start = 0

        for start, end, candidate_index in row_groups:
            if start <= log_index < end:
                row_group_index = candidate_index
                row_group_start = start
                break

        if row_group_index is None:
            return None

        dataset_file = self._get_dataset_file()

        if dataset_file is None:
            return None

        if self._cached_row_group_index != row_group_index:
            self._cached_row_group_table = dataset_file.read_row_group(
                row_group_index,
                columns=[
                    "platform",
                    "message",
                    "timestamp",
                    "is_error",
                    "is_warning",
                ],
            )
            self._cached_row_group_index = row_group_index

        if self._cached_row_group_table is None:
            return None

        row_offset = int(log_index - row_group_start)
        row_payload = self._cached_row_group_table.slice(
            row_offset,
            1,
        ).to_pydict()
        platform = self._normalize_scalar(
            row_payload.get("platform", [None])[0]
        )
        message = self._normalize_scalar(
            row_payload.get("message", [None])[0]
        )
        timestamp = self._normalize_scalar(
            row_payload.get("timestamp", [None])[0]
        )
        is_error = bool(
            self._normalize_scalar(
                row_payload.get("is_error", [False])[0]
            )
        )
        is_warning = bool(
            self._normalize_scalar(
                row_payload.get("is_warning", [False])[0]
            )
        )

        return {
            "log_index": int(log_index),
            "platform": str(platform).upper() if platform else "N/A",
            "message": message or "Message unavailable in parquet dataset",
            "timestamp": timestamp,
            "level": self._infer_dataset_level(
                message=message,
                is_error=is_error,
                is_warning=is_warning,
            ),
            "is_anomaly": False,
            "incident_id": None,
            "source_collection": self._resolve_source_collection(platform),
        }

    def _infer_level(self, document: dict) -> str:
        features = document.get("features", {})

        if features.get("is_error"):
            return "ERROR"

        if features.get("is_warning"):
            return "WARNING"

        return "INFO"

    def _infer_dataset_level(
        self,
        message: Optional[str],
        is_error: bool,
        is_warning: bool,
    ) -> str:
        message_text = str(message or "").lower()

        if is_error or any(
            keyword in message_text
            for keyword in ["error", "fail", "timeout", "critical"]
        ):
            return "ERROR"

        if is_warning or "warn" in message_text:
            return "WARNING"

        if "alert" in message_text:
            return "ALERT"

        return "INFO"

    def _get_incident_document(
        self,
        incident_id: str,
    ) -> Optional[dict]:
        object_id = self._maybe_object_id(incident_id)
        queries = []

        if object_id is not None:
            queries.append({"_id": object_id})

        queries.append({"_id": incident_id})

        for query in queries:
            document = self.db.incidents.find_one(query)

            if document is not None:
                return document

        return None

    def _get_incident_log_indices(
        self,
        incident_document: dict,
        incident_id: str,
    ) -> list[int]:
        indices = []

        for field_name in ["anomaly_ids", "anomalies"]:
            values = incident_document.get(field_name, [])

            if isinstance(values, list):
                for value in values:
                    if isinstance(value, int):
                        indices.append(int(value))
                        continue

                    anomaly_document = self.db.anomalies.find_one(
                        {"_id": self._maybe_object_id(value) or value},
                        {"log_index": 1},
                    )

                    if (
                        anomaly_document
                        and anomaly_document.get("log_index") is not None
                    ):
                        indices.append(
                            int(anomaly_document["log_index"])
                        )

        if indices:
            return list(dict.fromkeys(indices))[:100]

        object_id = self._maybe_object_id(incident_id)
        anomaly_query = {"incident_id": object_id or incident_id}
        anomaly_documents = list(
            self.db.anomalies.find(
                anomaly_query,
                {"log_index": 1},
            ).limit(100)
        )

        indices.extend(
            int(document["log_index"])
            for document in anomaly_documents
            if document.get("log_index") is not None
        )

        return list(dict.fromkeys(indices))[:100]

    def _compute_incident_centroid(
        self,
        anomaly_indices: list[int],
    ) -> Optional[np.ndarray]:
        embeddings = self._load_embeddings()
        valid_indices = [
            int(index)
            for index in anomaly_indices
            if 0 <= int(index) < self.total_logs
        ][:100]

        if not valid_indices:
            return None

        vectors = np.asarray(
            embeddings[valid_indices],
            dtype=np.float32,
        )

        return np.mean(vectors, axis=0).astype(np.float32)

    def _extract_incident_severity(self, incident_document: dict) -> str:
        severity = incident_document.get("severity", {})

        if isinstance(severity, dict):
            label = severity.get("label")

            if label:
                return str(label)

        if incident_document.get("severity_label"):
            return str(incident_document["severity_label"])

        intelligence = incident_document.get(
            "incident_intelligence",
            {},
        )

        if intelligence.get("severity_label"):
            return str(intelligence["severity_label"])

        return "N/A"

    def _extract_incident_timeline(
        self,
        incident_document: dict,
    ) -> list:
        timeline = incident_document.get("timeline", {})

        if isinstance(timeline, dict):
            if isinstance(timeline.get("timeline"), list):
                return timeline["timeline"]

        intelligence = incident_document.get(
            "incident_intelligence",
            {},
        )

        if isinstance(intelligence.get("timeline"), list):
            return intelligence["timeline"]

        return []

    def _extract_incident_top_causes(
        self,
        incident_document: dict,
    ) -> list:
        root_cause = incident_document.get("root_cause", {})

        if isinstance(root_cause, dict):
            causes = root_cause.get("root_causes", [])

            if causes:
                return causes[:3]

        intelligence = incident_document.get(
            "incident_intelligence",
            {},
        )

        if intelligence.get("top_root_causes"):
            return intelligence["top_root_causes"][:3]

        return []

    def _maybe_object_id(self, value):
        try:
            return ObjectId(str(value))
        except Exception:
            return None

    def _normalize_identifier(self, value):
        if value is None:
            return None

        return str(value)

    def _normalize_scalar(self, value):
        if hasattr(value, "as_py"):
            try:
                return value.as_py()
            except Exception:
                return value

        if isinstance(value, np.generic):
            return value.item()

        return value

    def _resolve_source_collection(
        self,
        platform: Optional[str],
    ) -> str:
        mapping = {
            "smsc": "smsc_logs",
            "smpps": "smpps_logs",
            "smppc": "smppc_logs",
            "dmc": "dmc_logs",
            "mmg": "mmg_logs",
        }

        return mapping.get(
            str(platform or "").strip().lower(),
            "ml_dataset",
        )

    def _resolve_pq_subquantizers(self) -> int:
        for candidate in [48, 32, 24, 16, 12, 8, 4]:
            if self.dimension % candidate == 0:
                return candidate

        return 8

    def _set_build_state(self, **updates) -> None:
        self._build_state.update(updates)

    def _get_base_index(self):
        """
        Récupère l'index FAISS sous-jacent qui a l'attribut nprobe.
        Adapté pour la structure IndexIDMap2 -> Index (IVFPQ)
        """
        current = self.index
        
        # Parcours des wrappers FAISS
        for depth in range(5):
            # Vérifier si l'index courant a nprobe
            if hasattr(current, "nprobe"):
                return current
            
            # Essayer différents attributs selon la version FAISS
            if hasattr(current, "index"):
                current = current.index
            elif hasattr(current, "sub_index"):
                current = current.sub_index
            elif hasattr(current, "quantizer"):
                # Pour certains types d'index
                current = current.quantizer
            else:
                break
        
        return current

    def _get_nprobe_value(self) -> Optional[int]:
        """Extrait la valeur nprobe de l'index interne"""
        base_index = self._get_base_index()
        
        if base_index is not None and hasattr(base_index, "nprobe"):
            return int(base_index.nprobe)
        
        # Alternative: vérifier l'attribut nprobe dans les métadonnées
        if hasattr(self, 'index') and hasattr(self.index, 'nprobe'):
            return int(self.index.nprobe)
        
        return None

    def _set_nprobe(self, value: int) -> None:
        """Configure nprobe sur l'index interne - version robuste"""
        try:
            # Méthode 1: tentative directe
            if hasattr(self.index, 'nprobe'):
                self.index.nprobe = int(value)
                print(f"✓ nprobe configuré à {value}")
                return
            
            # Méthode 2: via l'attribut index
            if hasattr(self.index, 'index'):
                if hasattr(self.index.index, 'nprobe'):
                    self.index.index.nprobe = int(value)
                    print(f"✓ nprobe configuré à {value} sur index.index")
                    return
            
            # Méthode 3: pour IndexIVFPQ spécifiquement
            if hasattr(self.index, 'quantizer'):
                if hasattr(self.index.quantizer, 'nprobe'):
                    self.index.quantizer.nprobe = int(value)
                    print(f"✓ nprobe configuré à {value} sur quantizer")
                    return
            
            # Méthode 4: essayer de cast l'index
            try:
                # Pour FAISS >= 1.7.0
                if hasattr(faiss, 'downcast_index'):
                    downcast = faiss.downcast_index(self.index)
                    if hasattr(downcast, 'nprobe'):
                        downcast.nprobe = int(value)
                        print(f"✓ nprobe configuré à {value} via downcast")
                        return
            except:
                pass
            
            print(f"ℹ️ nprobe non configurable, valeur par défaut utilisée (recherches fonctionnent)")
            
        except Exception as e:
            print(f"⚠️ Erreur configuration nprobe: {e}")

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()


if __name__ == "__main__":
    engine = FaissSimilarityEngine()
    result = engine.build_index()
    print(result)
    print(engine.get_stats())
