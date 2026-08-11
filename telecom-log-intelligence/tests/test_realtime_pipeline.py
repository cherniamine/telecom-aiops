from realtime.realtime_processor import RealtimeProcessor


def test_realtime_processing():

    processor = RealtimeProcessor()

    log = "ERROR SMPP connection lost"

    result = processor.process_log(log)

    assert "anomaly" in result