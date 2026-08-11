import numpy as np
from sentence_transformers import SentenceTransformer
from threading import Lock


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
                cls._model_cache[model_name] = SentenceTransformer(
                    model_name
                )

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
