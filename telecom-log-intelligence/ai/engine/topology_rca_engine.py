from pathlib import Path

import yaml


class TopologyRCAEngine:

    TOPOLOGY_PATH = (
        Path(__file__).resolve().parents[2] / "config" / "topology.yaml"
    )

    def __init__(self, topology_path=None):
        path = Path(topology_path) if topology_path else self.TOPOLOGY_PATH

        with path.open("r", encoding="utf-8") as topology_file:
            config = yaml.safe_load(topology_file) or {}

        self.platforms = config.get("platforms", {})
        self.rca_weights = config.get(
            "rca_weights",
            {
                "confidence_boost": 1.5,
                "confidence_penalty": 0.2,
                "unknown_platform": 0.8,
            },
        )

    def weight_causal_links(self, causal_links):
        weighted_links = []

        for source, target, confidence in causal_links or []:
            weighted_links.append(
                self._evaluate_link(source, target, confidence)
            )

        weighted_links.sort(
            key=lambda item: item["weighted_confidence"],
            reverse=True,
        )

        return weighted_links

    def _evaluate_link(self, source, target, confidence):
        source_upper = str(source or "").upper()
        target_upper = str(target or "").upper()
        raw_confidence = float(confidence)

        if (
            source_upper not in self.platforms
            or target_upper not in self.platforms
        ):
            return {
                "source": source_upper,
                "target": target_upper,
                "raw_confidence": raw_confidence,
                "weighted_confidence": round(
                    raw_confidence * self.rca_weights["unknown_platform"],
                    4,
                ),
                "topology_status": "UNKNOWN_PLATFORM",
                "explanation": "Platform missing from topology.yaml",
            }

        source_config = self.platforms[source_upper]
        impacts = [
            str(platform).upper()
            for platform in source_config.get("impacts", [])
        ]

        if target_upper in impacts:
            weighted_confidence = round(
                raw_confidence * self.rca_weights["confidence_boost"],
                4,
            )

            return {
                "source": source_upper,
                "target": target_upper,
                "raw_confidence": raw_confidence,
                "weighted_confidence": weighted_confidence,
                "topology_status": "CONFIRMED",
                "explanation": (
                    f"{source_upper} -> {target_upper} is a known impact "
                    "path in the business topology."
                ),
                "source_criticality": source_config.get(
                    "criticality",
                    "UNKNOWN",
                ),
                "known_failure_modes": source_config.get(
                    "known_failure_modes",
                    [],
                ),
                "estimated_recovery": source_config.get(
                    "recovery_time_minutes",
                    "N/A",
                ),
            }

        target_config = self.platforms[target_upper]
        reverse_impacts = [
            str(platform).upper()
            for platform in target_config.get("impacts", [])
        ]
        topology_status = "IMPROBABLE"
        explanation = (
            f"{source_upper} -> {target_upper} is not a known dependency "
            "in the business topology."
        )

        if source_upper in reverse_impacts:
            topology_status = "REVERSED"
            explanation = (
                f"{target_upper} impacts {source_upper} according to the "
                "business topology, not the reverse."
            )

        return {
            "source": source_upper,
            "target": target_upper,
            "raw_confidence": raw_confidence,
            "weighted_confidence": round(
                raw_confidence * self.rca_weights["confidence_penalty"],
                4,
            ),
            "topology_status": topology_status,
            "explanation": explanation,
            "source_criticality": source_config.get(
                "criticality",
                "UNKNOWN",
            ),
            "known_failure_modes": source_config.get(
                "known_failure_modes",
                [],
            ),
            "estimated_recovery": source_config.get(
                "recovery_time_minutes",
                "N/A",
            ),
        }

    def validate_cascade(self, cascade):
        steps = []
        valid_steps = 0
        invalid_steps = 0

        for index in range(len(cascade or []) - 1):
            source = str(cascade[index]).upper()
            target = str(cascade[index + 1]).upper()

            if source not in self.platforms:
                steps.append(
                    {
                        "step": f"{source}->{target}",
                        "valid": False,
                        "reason": "unknown platform",
                    }
                )
                invalid_steps += 1
                continue

            impacts = [
                str(platform).upper()
                for platform in self.platforms[source].get("impacts", [])
            ]

            if target in impacts:
                steps.append(
                    {
                        "step": f"{source}->{target}",
                        "valid": True,
                        "reason": "confirmed dependency",
                    }
                )
                valid_steps += 1
            else:
                steps.append(
                    {
                        "step": f"{source}->{target}",
                        "valid": False,
                        "reason": "unknown dependency",
                    }
                )
                invalid_steps += 1

        total_steps = valid_steps + invalid_steps
        coherence_score = (
            round(valid_steps / total_steps, 2)
            if total_steps > 0
            else 0.0
        )

        if coherence_score >= 0.8:
            verdict = "VALID_CASCADE"
        elif coherence_score >= 0.5:
            verdict = "PARTIAL_CASCADE"
        else:
            verdict = "IMPROBABLE_CASCADE"

        return {
            "cascade": cascade,
            "coherence_score": coherence_score,
            "valid_steps": valid_steps,
            "invalid_steps": invalid_steps,
            "steps": steps,
            "verdict": verdict,
        }

    def find_root_platform(self, affected_platforms):
        normalized_platforms = [
            str(platform).upper()
            for platform in affected_platforms or []
        ]
        candidates = []

        for platform in normalized_platforms:
            if platform not in self.platforms:
                continue

            platform_config = self.platforms[platform]
            depends_on = [
                str(item).upper()
                for item in platform_config.get("depends_on", [])
            ]
            affected_dependencies = [
                dependency
                for dependency in depends_on
                if dependency in normalized_platforms
            ]

            candidates.append(
                {
                    "platform": platform,
                    "criticality": platform_config.get(
                        "criticality",
                        "UNKNOWN",
                    ),
                    "dependency_count": len(affected_dependencies),
                    "known_failures": platform_config.get(
                        "known_failure_modes",
                        [],
                    ),
                    "recovery_minutes": platform_config.get(
                        "recovery_time_minutes",
                        "N/A",
                    ),
                }
            )

        candidates.sort(key=lambda item: item["dependency_count"])

        if not candidates:
            return {
                "root_platform": "UNKNOWN",
                "confidence": "LOW",
                "candidates": [],
            }

        confidence = (
            "HIGH"
            if candidates[0]["dependency_count"] == 0
            else "MEDIUM"
        )

        return {
            "root_platform": candidates[0]["platform"],
            "confidence": confidence,
            "candidates": candidates,
        }
