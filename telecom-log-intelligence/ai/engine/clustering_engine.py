import numpy as np
from sklearn.cluster import DBSCAN, MiniBatchKMeans
from sklearn.preprocessing import normalize


class ClusteringEngine:

    def __init__(
        self,
        dbscan_eps=0.5,
        dbscan_min_samples=5,
        dbscan_max_samples=5000,
        target_cluster_size=500,
        max_clusters=200,
        random_state=42,
    ):

        self.dbscan_max_samples = dbscan_max_samples
        self.target_cluster_size = target_cluster_size
        self.max_clusters = max_clusters
        self.random_state = random_state

        self.dbscan_model = DBSCAN(
            eps=dbscan_eps,
            min_samples=dbscan_min_samples,
            metric="cosine",
        )

    def cluster(self, vectors):
        array = np.asarray(vectors, dtype=np.float32)

        if len(array) == 0:
            return {}

        if len(array) == 1:
            return {0: [0]}

        if len(array) <= self.dbscan_max_samples:
            labels = self.dbscan_model.fit_predict(array)
            if np.all(labels == -1):
                labels = self._cluster_with_kmeans(array)
        else:
            labels = self._cluster_with_kmeans(array)

        return self._labels_to_clusters(labels)

    def _cluster_with_kmeans(self, vectors):
        normalized_vectors = normalize(vectors, norm="l2")
        cluster_count = self._estimate_cluster_count(len(normalized_vectors))

        model = MiniBatchKMeans(
            n_clusters=cluster_count,
            batch_size=min(4096, len(normalized_vectors)),
            n_init=3,
            random_state=self.random_state,
        )

        return model.fit_predict(normalized_vectors)

    def _estimate_cluster_count(self, sample_count):
        estimated = max(2, sample_count // self.target_cluster_size)
        return min(sample_count, min(self.max_clusters, estimated))

    def _labels_to_clusters(self, labels):
        clusters = {}

        for index, label in enumerate(labels):
            if label == -1:
                continue

            clusters.setdefault(int(label), []).append(index)

        return clusters
