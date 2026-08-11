from ai.engine.topology_rca_engine import TopologyRCAEngine


def test_weight_causal_links_boosts_known_topology_path():
    engine = TopologyRCAEngine()

    result = engine.weight_causal_links(
        [
            ("MMG", "SMSC", 0.85),
            ("SMPPS", "MMG", 0.60),
        ]
    )

    assert result
    assert result[0]["weighted_confidence"] >= result[1]["weighted_confidence"]
    assert any(item["topology_status"] == "CONFIRMED" for item in result)


def test_find_root_platform_from_known_cascade():
    engine = TopologyRCAEngine()

    result = engine.find_root_platform(
        ["MMG", "SMSC", "SMPPS", "DMC"]
    )

    assert result["root_platform"] == "MMG"
