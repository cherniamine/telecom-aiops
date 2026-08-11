class IncidentSeverityExplainer:

    def explain(
        self,
        anomalies_count,
        cascade,
        causal_links,
        root_causes,
        severity_label,
    ):
        explanation = []

        if anomalies_count > 50000:
            explanation.append("Large anomaly volume detected")
        elif anomalies_count > 10000:
            explanation.append("Moderate anomaly volume detected")

        if len(cascade) >= 4:
            explanation.append("Multi-platform cascade propagation")
        elif len(cascade) >= 2:
            explanation.append("Cross-platform propagation detected")

        if len(causal_links) >= 5:
            explanation.append("Strong causal dependencies between metrics")

        cascade_validation = root_causes.get(
            "cascade_validation",
            {},
        )
        coherence_score = float(
            cascade_validation.get("coherence_score", 0.0) or 0.0
        )

        if coherence_score >= 0.8:
            explanation.append("Topology-confirmed telecom cascade")
        elif coherence_score >= 0.5:
            explanation.append("Topology partially confirms telecom cascade")

        root_platform_analysis = root_causes.get(
            "root_platform_analysis",
            {},
        )
        root_platform = root_platform_analysis.get("root_platform")

        if root_platform and root_platform != "UNKNOWN":
            explanation.append(
                f"Probable root platform identified: {root_platform}"
            )

        confirmed_links = [
            link
            for link in root_causes.get("weighted_causal_links", [])
            if str(link.get("topology_status", "")).upper() == "CONFIRMED"
        ]

        if confirmed_links:
            explanation.append(
                "Business topology strengthened causal confidence"
            )

        critical_keywords = [
            "fail",
            "timeout",
            "queue full",
            "refused",
            "disconnect",
        ]
        detected_keywords = [
            root_cause[0]
            for root_cause in root_causes.get("root_causes", [])
        ]

        for keyword in critical_keywords:
            if keyword in detected_keywords:
                explanation.append(f"Critical keyword detected: {keyword}")

        return {
            "severity": severity_label,
            "reasons": explanation,
        }

    def explain_severity(
        self,
        anomalies_count,
        cascade,
        causal_links,
        root_causes,
        severity_label,
    ):
        return self.explain(
            anomalies_count=anomalies_count,
            cascade=cascade,
            causal_links=causal_links,
            root_causes=root_causes,
            severity_label=severity_label,
        )
