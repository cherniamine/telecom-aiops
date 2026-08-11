from ai.engine.telecom_topology_engine import TelecomTopologyEngine


def test_topology_learning():

    logs = [
        "DMC request received",
        "MMG processing message",
        "SMSC routing sms",
        "SMPP session send"
    ]

    engine = TelecomTopologyEngine()

    engine.learn(logs)

    edges = engine.build_topology()

    assert len(edges) >= 1