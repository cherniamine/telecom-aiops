from ai.engine.what_if_engine import WhatIfEngine


def test_what_if_engine_lists_actions():
    engine = WhatIfEngine()
    actions = engine.list_available_actions()

    assert len(actions) >= 8


def test_what_if_engine_simulates_queue_upgrade():
    engine = WhatIfEngine()
    incident = {
        "_id": "69c3f457b6d3286a037bf444",
        "platforms": ["MMG", "SMSC", "SMPPS", "DMC"],
        "severity": {"label": "CRITICAL", "score": 14},
        "total_anomalies": 71393,
        "root_cause": {
            "root_causes": [
                ["fail", 2925539],
                ["retry", 212017],
                ["timeout", 188160],
                ["queue full", 34980],
            ]
        },
        "impact": {
            "sms_delivery_degradation": "HIGH",
            "propagation_risk": "HIGH",
        },
    }

    result = engine.simulate(
        "increase_smsc_queue",
        incident,
        {"capacity_boost_pct": 50},
    )

    assert result["before"]["mttr_minutes"] > result["after"]["mttr_minutes"]
    assert result["action_id"] == "increase_smsc_queue"
