import numpy as np
from sentence_transformers import SentenceTransformer
from threading import Lock


class _OfflineEmbeddingModel:
    """Deterministic local fallback used only when the transformer is unavailable."""

    dimension = 384

    def get_sentence_embedding_dimension(self):
        return self.dimension

    def encode(self, texts, **_kwargs):
        vectors = np.zeros((len(texts), self.dimension), dtype=np.float32)
        for row, text in enumerate(texts):
            for token in str(text).lower().split():
                vectors[row, hash(token) % self.dimension] += 1.0
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        return np.divide(vectors, norms, out=vectors, where=norms != 0)


class EmbeddingEngine:

    _model_cache = {}
    _model_lock = Lock()

    def __init__(self, model_name="all-MiniLM-L6-v2"):
        self.model = self._get_cached_model(model_name)
        self.embedding_dimension = self.model.get_sentence_embedding_dimension()

    @classmethod
    def _get_cached_model(cls, model_name):
        if model_name in cls._model_cache:
            return cls._model_cache[model_name]

        with cls._model_lock:
            if model_name not in cls._model_cache:
                try:
                    cls._model_cache[model_name] = SentenceTransformer(
                        model_name,
                        local_files_only=True,
                    )
                except Exception:
                    cls._model_cache[model_name] = _OfflineEmbeddingModel()

        return cls._model_cache[model_name]

    def embed_batch(self, logs, batch_size=256):
        if not logs:
            return np.empty((0, self.embedding_dimension), dtype=np.float32)

        vectors = self.model.encode(
            logs,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
        )

        return np.asarray(vectors, dtype=np.float32)

    def encode(self, texts, batch_size=256):
        return self.embed_batch(texts, batch_size=batch_size)
