from datetime import datetime


class ImpactEstimationEngine:

    CRITICAL_KEYWORDS = {
        "fail",
        "timeout",
        "queue full",
        "refused",
        "disconnect",
        "drop",
        "connection failed",
    }

    HIGH_KEYWORDS = {
        "retry",
        "error",
        "delay",
        "slow",
    }

    def estimate(
        self,
        anomaly_count,
        cluster_count,
        propagation_path,
        root_causes,
    ):

        platforms = list(set(propagation_path))

        keywords = [rc[0] for rc in root_causes]

        sms_risk = self._sms_risk(keywords, anomaly_count)

        propagation_risk = self._propagation_risk(
            len(platforms),
            cluster_count,
        )

        customer_impact = self._customer_impact(
            anomaly_count,
            len(platforms),
            keywords,
        )

        severity = self._severity(
            anomaly_count,
            cluster_count,
            keywords,
            len(platforms),
        )

        spread_score = self._spread_score(
            anomaly_count,
            cluster_count,
            len(platforms),
        )

        return {
            "timestamp": datetime.utcnow(),
            "severity_label": severity,
            "affected_platforms": platforms,
            "affected_platform_count": len(platforms),
            "sms_delivery_degradation": sms_risk,
            "propagation_risk": propagation_risk,
            "customer_impact": customer_impact,
            "incident_spread_score": spread_score,
            "spread_score": spread_score,
        }

    def _sms_risk(self, keywords, anomaly_count):

        if "queue full" in keywords or "timeout" in keywords:
            return "HIGH"

        if anomaly_count > 50000:
            return "HIGH"

        if anomaly_count > 5000:
            return "MEDIUM"

        return "LOW"

    def _propagation_risk(self, platform_count, cluster_count):

        if platform_count >= 4 or cluster_count >= 50:
            return "HIGH"

        if platform_count >= 2:
            return "MEDIUM"

        return "LOW"

    def _customer_impact(
        self,
        anomaly_count,
        platform_count,
        keywords,
    ):

        if (
            anomaly_count > 40000
            or platform_count >= 3
            or any(
                k in self.CRITICAL_KEYWORDS
                for k in keywords
            )
        ):
            return "HIGH"

        if anomaly_count > 5000:
            return "MEDIUM"

        return "LOW"

    def _severity(
        self,
        anomaly_count,
        cluster_count,
        keywords,
        platform_count,
    ):

        if (
            anomaly_count > 50000
            or cluster_count > 50
            or platform_count >= 4
            or any(
                k in self.CRITICAL_KEYWORDS
                for k in keywords
            )
        ):
            return "CRITICAL"

        if (
            anomaly_count > 5000
            or cluster_count > 10
            or any(
                k in self.HIGH_KEYWORDS
                for k in keywords
            )
        ):
            return "HIGH"

        return "MEDIUM"

    def _spread_score(
        self,
        anomaly_count,
        cluster_count,
        platform_count,
    ):

        score = 0

        score += min(anomaly_count / 1000, 40)
        score += min(cluster_count * 2, 30)
        score += min(platform_count * 10, 30)

        return round(score)
