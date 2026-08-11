from ai.engine.rca_engine import RCAEngine


def test_rca():

    logs = [
        {"platform": "MMG", "message": "ERROR MMG timeout"},
        {"platform": "MMG", "message": "ERROR MMG connection failed"},
        {"platform": "SMSC", "message": "WARNING SMSC queue full"},
    ]

    rca = RCAEngine()

    result = rca.find_root_cause(logs)

    assert result is not None
    assert "root_causes" in result
    assert "affected_platforms" in result
    assert "root_platform_analysis" in result
    assert "cascade_validation" in result
