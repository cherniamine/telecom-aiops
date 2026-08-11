class IncidentSeverityEngine:

    def compute_severity(
        self,
        anomalies_count,
        cascade,
        causal_links,
        root_causes,
    ):
        score = 0

        if anomalies_count > 50000:
            score += 4
        elif anomalies_count > 10000:
            score += 3
        elif anomalies_count > 1000:
            score += 2
        else:
            score += 1

        cascade_size = len(cascade)

        if cascade_size >= 4:
            score += 3
        elif cascade_size >= 3:
            score += 2
        elif cascade_size >= 2:
            score += 1

        causal_count = len(causal_links)

        if causal_count >= 10:
            score += 3
        elif causal_count >= 5:
            score += 2
        elif causal_count >= 1:
            score += 1

        critical_keywords = [
            "fail",
            "timeout",
            "queue full",
            "refused",
            "disconnect",
        ]
        detected_root_causes = [
            item[0]
            for item in root_causes.get("root_causes", [])
        ]
        matches = sum(
            keyword in detected_root_causes
            for keyword in critical_keywords
        )
        score += matches

        cascade_validation = root_causes.get(
            "cascade_validation",
            {},
        )
        coherence_score = float(
            cascade_validation.get("coherence_score", 0.0) or 0.0
        )

        if coherence_score >= 0.8:
            score += 2
        elif coherence_score >= 0.5:
            score += 1

        root_platform_analysis = root_causes.get(
            "root_platform_analysis",
            {},
        )
        root_platform = str(
            root_platform_analysis.get("root_platform", "")
        ).upper()
        root_platform_criticality = "UNKNOWN"

        for candidate in root_platform_analysis.get("candidates", []):
            if str(candidate.get("platform", "")).upper() != root_platform:
                continue

            root_platform_criticality = str(
                candidate.get("criticality", "UNKNOWN")
            ).upper()
            break

        if root_platform_criticality == "CRITICAL":
            score += 2
        elif root_platform_criticality == "HIGH":
            score += 1

        confirmed_links = [
            link
            for link in root_causes.get("weighted_causal_links", [])
            if str(link.get("topology_status", "")).upper() == "CONFIRMED"
        ]

        if len(confirmed_links) >= 3:
            score += 2
        elif len(confirmed_links) >= 1:
            score += 1

        return self._classify(score), score

    def _classify(self, score):
        if score >= 10:
            return "CRITICAL"
        if score >= 7:
            return "HIGH"
        if score >= 4:
            return "MEDIUM"
        return "LOW"
