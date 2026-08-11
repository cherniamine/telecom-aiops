from collections import Counter
import re

from ai.engine.topology_rca_engine import TopologyRCAEngine


class RCAEngine:

    ERROR_PATTERNS = [
        r"timeout",
        r"connection failed",
        r"refused",
        r"unreachable",
        r"overload",
        r"queue full",
        r"retry",
        r"latency",
        r"disconnect",
        r"error",
        r"fail",
        r"drop",
    ]

    def __init__(self, topology_path=None):
        try:
            self.topology_rca = TopologyRCAEngine(topology_path=topology_path)
            self.platforms = {
                str(platform).upper(): config
                for platform, config in self.topology_rca.platforms.items()
            }
            self.topology_weights = self.topology_rca.rca_weights
        except Exception:
            self.topology_rca = None
            self.platforms = {}
            self.topology_weights = {
                "confidence_boost": 1.5,
                "confidence_penalty": 0.2,
                "unknown_platform": 0.8,
            }

        self.platform_patterns = [
            re.compile(rf"\b{re.escape(platform)}\b", re.IGNORECASE)
            for platform in sorted(
                self.platforms,
                key=len,
                reverse=True,
            )
        ]

    def create_counter(self):
        return {
            "pattern_scores": Counter(),
            "pattern_counts": Counter(),
            "platform_counts": Counter(),
            "platform_sequence": [],
        }

    def update_counter(self, logs, counter):
        state = self._ensure_counter_state(counter)

        for log in logs or []:
            log_message = self._extract_message(log)

            if not log_message:
                continue

            platform = self._extract_platform(log, log_message)

            if platform:
                state["platform_counts"][platform] += 1

                if platform not in state["platform_sequence"]:
                    state["platform_sequence"].append(platform)

            log_lower = log_message.lower()

            for pattern in self.ERROR_PATTERNS:
                if not re.search(pattern, log_lower):
                    continue

                state["pattern_counts"][pattern] += 1
                state["pattern_scores"][pattern] += self._get_pattern_weight(
                    platform,
                    pattern,
                )

    def summarize(self, counter, causal_links=None):
        state = self._ensure_counter_state(counter)
        pattern_scores = state["pattern_scores"]

        if len(pattern_scores) == 0:
            return {
                "root_causes": [],
                "count": 0,
                "affected_platforms": state["platform_sequence"],
                "platform_counts": [],
                "root_platform_analysis": self.find_root_platform(
                    state["platform_sequence"]
                ),
                "cascade_validation": self.validate_cascade(
                    state["platform_sequence"]
                ),
                "weighted_causal_links": self.weight_causal_links(
                    causal_links or []
                ),
            }

        return {
            "root_causes": [
                (pattern, round(score, 4))
                for pattern, score in pattern_scores.most_common(10)
            ],
            "raw_root_causes": state["pattern_counts"].most_common(10),
            "count": round(sum(pattern_scores.values()), 4),
            "affected_platforms": state["platform_sequence"],
            "platform_counts": state["platform_counts"].most_common(),
            "root_platform_analysis": self.find_root_platform(
                state["platform_sequence"]
            ),
            "cascade_validation": self.validate_cascade(
                state["platform_sequence"]
            ),
            "weighted_causal_links": self.weight_causal_links(
                causal_links or []
            ),
        }

    def find_root_cause(self, logs, causal_links=None):
        counter = self.create_counter()
        self.update_counter(logs, counter)
        return self.summarize(counter, causal_links=causal_links)

    def weight_causal_links(self, causal_links):
        if not self.topology_rca:
            return []

        return self.topology_rca.weight_causal_links(causal_links)

    def validate_cascade(self, cascade):
        if not self.topology_rca or len(cascade or []) < 2:
            return {
                "cascade": cascade or [],
                "coherence_score": 0.0,
                "valid_steps": 0,
                "invalid_steps": 0,
                "steps": [],
                "verdict": "INSUFFICIENT_DATA",
            }

        return self.topology_rca.validate_cascade(cascade)

    def find_root_platform(self, affected_platforms):
        if not self.topology_rca:
            return {
                "root_platform": "UNKNOWN",
                "confidence": "LOW",
                "candidates": [],
            }

        return self.topology_rca.find_root_platform(affected_platforms)

    def _ensure_counter_state(self, counter):
        if isinstance(counter, Counter):
            return {
                "pattern_scores": counter,
                "pattern_counts": Counter(counter),
                "platform_counts": Counter(),
                "platform_sequence": [],
            }

        if counter is None:
            counter = {}

        counter.setdefault("pattern_scores", Counter())
        counter.setdefault("pattern_counts", Counter())
        counter.setdefault("platform_counts", Counter())
        counter.setdefault("platform_sequence", [])

        return counter

    def _get_pattern_weight(self, platform, pattern):
        if not self.topology_rca or not platform:
            return 1.0

        platform_config = self.platforms.get(platform)

        if not platform_config:
            return float(self.topology_weights["unknown_platform"])

        known_failure_modes = [
            str(item).lower()
            for item in platform_config.get("known_failure_modes", [])
        ]
        normalized_pattern = str(pattern).lower()

        if any(
            normalized_pattern in failure_mode
            or failure_mode in normalized_pattern
            for failure_mode in known_failure_modes
        ):
            return float(self.topology_weights["confidence_boost"])

        return 1.0

    def _extract_platform(self, log, message):
        if isinstance(log, dict):
            platform = log.get("platform")

            if platform:
                return str(platform).upper()

            raw_log = log.get("raw_log", {})

            if isinstance(raw_log, dict) and raw_log.get("platform"):
                return str(raw_log.get("platform")).upper()

        message_text = str(message or "")

        for pattern in self.platform_patterns:
            match = pattern.search(message_text)

            if match:
                return match.group(0).upper()

        return None

    def _extract_message(self, log):
        if isinstance(log, dict):
            message = log.get("message")

            if not message:
                raw_log = log.get("raw_log", {})

                if isinstance(raw_log, dict):
                    message = raw_log.get("message") or raw_log.get(
                        "raw_message"
                    )
        elif log is None:
            message = ""
        else:
            message = str(log)

        if not isinstance(message, str):
            message = str(message)

        return message
