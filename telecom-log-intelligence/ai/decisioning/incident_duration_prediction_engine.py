from datetime import datetime


class IncidentDurationPredictionEngine:

    CRITICAL_KEYWORDS = {
        "fail",
        "timeout",
        "queue full",
        "refused",
        "disconnect",
        "connection failed",
        "drop",
    }

    HIGH_KEYWORDS = {
        "retry",
        "error",
        "delay",
        "slow",
    }

    PLATFORM_COMPLEXITY = {
        "MMG": 15,
        "SMSC": 12,
        "SMPPS": 10,
        "DMC": 8,
        "HLR": 14,
        "MSC": 16,
    }

    def predict(
        self,
        anomaly_count,
        cluster_count,
        propagation_path,
        root_causes,
    ):

        keyword_list = [rc[0] for rc in root_causes]

        complexity_score = self._compute_complexity(
            anomaly_count,
            cluster_count,
            propagation_path,
            keyword_list,
        )

        estimated_minutes = self._estimate_resolution_time(
            complexity_score
        )

        stability = self._incident_stability(
            keyword_list,
            anomaly_count,
        )

        escalation_probability = self._escalation_probability(
            complexity_score
        )

        confidence = self._confidence_score(
            anomaly_count,
            cluster_count,
            propagation_path,
        )

        return {
            "timestamp": datetime.utcnow(),
            "estimated_resolution_minutes": estimated_minutes,
            "recovery_complexity": self._complexity_label(
                complexity_score
            ),
            "incident_stability": stability,
            "escalation_probability": escalation_probability,
            "confidence_score": confidence,
        }

    # --------------------------------------------------

    def _compute_complexity(
        self,
        anomaly_count,
        cluster_count,
        propagation_path,
        keywords,
    ):

        score = 0

        score += min(anomaly_count / 5000, 40)

        score += min(cluster_count * 1.5, 25)

        for platform in propagation_path:
            score += self.PLATFORM_COMPLEXITY.get(
                platform,
                5,
            )

        if any(
            k in self.CRITICAL_KEYWORDS
            for k in keywords
        ):
            score += 20

        elif any(
            k in self.HIGH_KEYWORDS
            for k in keywords
        ):
            score += 10

        return min(score, 100)

    # --------------------------------------------------

    def _estimate_resolution_time(self, score):

        if score >= 80:
            return 90

        if score >= 60:
            return 45

        if score >= 40:
            return 20

        return 8

    # --------------------------------------------------

    def _incident_stability(
        self,
        keywords,
        anomaly_count,
    ):

        if (
            anomaly_count > 40000
            or any(
                k in self.CRITICAL_KEYWORDS
                for k in keywords
            )
        ):
            return "UNSTABLE"

        if anomaly_count > 5000:
            return "DEGRADING"

        return "STABLE"

    # --------------------------------------------------

    def _escalation_probability(self, score):

        if score >= 80:
            return "HIGH"

        if score >= 50:
            return "MEDIUM"

        return "LOW"

    # --------------------------------------------------

    def _confidence_score(
        self,
        anomaly_count,
        cluster_count,
        propagation_path,
    ):

        confidence = 60

        if anomaly_count > 10000:
            confidence += 10

        if cluster_count > 10:
            confidence += 10

        if len(propagation_path) >= 3:
            confidence += 12

        return min(confidence, 95)

    # --------------------------------------------------

    def _complexity_label(self, score):

        if score >= 80:
            return "VERY_HIGH"

        if score >= 60:
            return "HIGH"

        if score >= 40:
            return "MEDIUM"

        return "LOW"