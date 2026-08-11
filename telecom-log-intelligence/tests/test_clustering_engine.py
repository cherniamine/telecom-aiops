from ai.engine.clustering_engine import ClusteringEngine


def test_clustering():

    engine = ClusteringEngine()

    vectors = [
        [0.1, 0.2],
        [0.11, 0.19],
        [5.0, 5.1],
        [5.1, 5.0]
    ]

    clusters = engine.cluster(vectors)

    assert len(clusters) >= 1