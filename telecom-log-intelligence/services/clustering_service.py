from ai.engine.clustering_engine import ClusteringEngine
from ai.engine.embedding_engine import EmbeddingEngine
import numpy as np

class ClusteringService:

    def __init__(self):
        self.engine = ClusteringEngine()
        self.embedder = EmbeddingEngine()

    def cluster_logs(self, logs_or_vectors):

        vectors = self._prepare_vectors(logs_or_vectors)

        if len(vectors) == 0:
            return []

        clusters = self.engine.cluster(vectors)

        result = []

        for idx, cluster_id in clusters.items():

            for log_index in cluster_id:
                result.append({
                    "log_index": log_index,
                    "cluster_id": int(idx)
                })

        return result

    def _prepare_vectors(self, logs_or_vectors):
        if logs_or_vectors is None:
            return np.empty((0, 0), dtype=np.float32)

        if isinstance(logs_or_vectors, np.ndarray):
            return logs_or_vectors

        if len(logs_or_vectors) == 0:
            return np.empty((0, 0), dtype=np.float32)

        first_item = logs_or_vectors[0]

        if isinstance(first_item, (dict, str)):
            messages = []

            for item in logs_or_vectors:
                if isinstance(item, dict):
                    messages.append(str(item.get("message", "")))
                else:
                    messages.append(str(item))

            return self.embedder.embed_batch(messages, batch_size=256)

        return np.asarray(logs_or_vectors, dtype=np.float32)
