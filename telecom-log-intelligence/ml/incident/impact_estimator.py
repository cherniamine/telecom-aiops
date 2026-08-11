class IncidentImpactEstimator:

    def estimate(
        self,
        timeline,
        severity_label,
        total_anomalies,
        causal_links,
    ):

        impacted_platforms = self._extract_platforms(timeline)
        delivery_risk = self._estimate_delivery_risk(
            impacted_platforms,
            total_anomalies,
        )
        propagation_risk = self._estimate_propagation_risk(
            impacted_platforms,
            causal_links,
        )

        return {
            "affected_platforms": impacted_platforms,
            "severity": severity_label,
            "sms_delivery_degradation": delivery_risk,
            "propagation_risk": propagation_risk,
        }

    def _extract_platforms(self, timeline):

        platforms = []
        seen = set()

        for event in timeline:
            if isinstance(event, dict):
                platform = str(event.get("platform", "")).upper()
            else:
                platform = str(event).upper()

            if not platform or platform == "UNKNOWN" or platform in seen:
                continue

            seen.add(platform)
            platforms.append(platform)

        return platforms

    def _estimate_delivery_risk(self, platforms, anomalies):

        score = 0

        if "SMSC" in platforms:
            score += 2

        if "SMPPS" in platforms or "SMPPC" in platforms:
            score += 2

        if "MMG" in platforms:
            score += 1

        if anomalies > 50000:
            score += 2

        if score >= 5:
            return "HIGH"

        if score >= 3:
            return "MEDIUM"

        return "LOW"

    def _estimate_propagation_risk(self, platforms, causal_links):

        score = 0

        if len(platforms) >= 4:
            score += 2

        if causal_links >= 5:
            score += 2

        if "MMG" in platforms:
            score += 1

        if score >= 4:
            return "HIGH"

        if score >= 2:
            return "MEDIUM"

        return "LOW"
