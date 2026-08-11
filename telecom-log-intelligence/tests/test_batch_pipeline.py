from pipeline.batch_pipeline import BatchPipeline


def test_batch_pipeline():

    pipeline = BatchPipeline(
        mongo_uri="mongodb://localhost:27017",
        db_name="telecom_logs",
        collection="logs"
    )

    result = pipeline.run(limit=10)

    assert result is not None