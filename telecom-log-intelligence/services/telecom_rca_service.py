from ai.engine.rca_engine import RCAEngine


class TelecomRCAService:

    def __init__(self):
        self.engine = RCAEngine()

    def process_logs(self, logs):
        root_cause = self.engine.find_root_cause(logs)
        affected_platforms = root_cause.get("affected_platforms", [])

        return {
            "root_causes": root_cause.get("root_causes", []),
            "count": root_cause.get("count", 0),
            "propagation_path": affected_platforms,
            "affected_platforms": affected_platforms,
            "root_platform_analysis": root_cause.get(
                "root_platform_analysis",
                {},
            ),
            "cascade_validation": root_cause.get(
                "cascade_validation",
                {},
            ),
        }

    def reset(self):
        pass
