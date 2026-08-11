from collections import Counter


class IncidentTimelineEngine:

    def reconstruct_timeline(
        self,
        df,
        anomaly_indices=None,
        causal_links=None,
        root_causes=None,
    ):
        if df is None or df.empty:
            return {
                "timeline": [],
                "summary": "No anomaly timeline detected",
                "topology_aware": False,
                "cascade_validation": {},
                "weighted_causal_links": [],
                "root_platform_analysis": {},
            }

        if causal_links is None:
            causal_links = []

        if root_causes is None:
            root_causes = {
                "root_causes": [],
                "count": 0,
            }

        anomaly_df = df.copy()

        if anomaly_indices:
            safe_indices = [
                index
                for index in anomaly_indices
                if 0 <= index < len(anomaly_df)
            ]

            if safe_indices:
                anomaly_df = anomaly_df.iloc[safe_indices].copy()

        if "timestamp" in anomaly_df.columns:
            anomaly_df = anomaly_df.sort_values("timestamp")

        events = []

        for _, row in anomaly_df.iterrows():
            events.append(
                {
                    "platform": str(
                        row.get("platform", "UNKNOWN")
                    ).upper(),
                    "hour": row.get("hour"),
                    "is_error": bool(row.get("is_error", False)),
                    "is_warning": bool(row.get("is_warning", False)),
                }
            )

        cascade = self._build_clean_cascade(events)
        topology_context = self._extract_topology_context(root_causes)
        explanation = self._generate_explanation(
            cascade,
            causal_links,
            root_causes,
            topology_context.get("cascade_validation", {}),
            topology_context.get("root_platform_analysis", {}),
        )

        return {
            "timeline": cascade,
            "summary": explanation,
            "topology_aware": bool(
                topology_context.get("weighted_causal_links")
                or topology_context.get("cascade_validation")
            ),
            "cascade_validation": topology_context.get(
                "cascade_validation",
                {},
            ),
            "weighted_causal_links": topology_context.get(
                "weighted_causal_links",
                [],
            ),
            "root_platform_analysis": topology_context.get(
                "root_platform_analysis",
                {},
            ),
        }

    def _build_clean_cascade(self, events):
        platform_counter = Counter()

        for event in events:
            platform_counter[event["platform"]] += 1

        dominant_platforms = [
            platform
            for platform, _count in platform_counter.most_common(5)
        ]
        cascade = []
        last_platform = None

        for event in events:
            platform = event["platform"]

            if platform not in dominant_platforms:
                continue

            if platform != last_platform:
                cascade.append(platform)
                last_platform = platform

        final_chain = []

        for platform in cascade:
            if platform not in final_chain:
                final_chain.append(platform)

        return final_chain

    def _generate_explanation(
        self,
        cascade,
        causal_links,
        root_causes,
        cascade_validation,
        root_platform_analysis,
    ):
        if len(cascade) == 0:
            return "No cascade detected"

        platform_chain = " -> ".join(cascade)
        root_items = root_causes.get("root_causes", [])
        root_text = root_items[0][0] if root_items else "unavailable"
        explanation = (
            f"Incident cascade detected: {platform_chain}. "
            f"Likely trigger: {root_text}. "
            f"Causal relations discovered: {len(causal_links)}."
        )

        coherence_score = float(
            cascade_validation.get("coherence_score", 0.0) or 0.0
        )

        if coherence_score >= 0.8:
            explanation += " Topology validation confirms the cascade."
        elif coherence_score >= 0.5:
            explanation += (
                " Topology validation partially confirms the cascade."
            )

        root_platform = root_platform_analysis.get("root_platform")

        if root_platform and root_platform != "UNKNOWN":
            explanation += f" Probable root platform: {root_platform}."

        return explanation

    def _extract_topology_context(self, root_causes):
        if not isinstance(root_causes, dict):
            return {}

        return {
            "cascade_validation": root_causes.get(
                "cascade_validation",
                {},
            ),
            "weighted_causal_links": root_causes.get(
                "weighted_causal_links",
                [],
            ),
            "root_platform_analysis": root_causes.get(
                "root_platform_analysis",
                {},
            ),
        }
