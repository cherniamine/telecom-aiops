from datetime import datetime

from database.mongodb_client import MongoDBClient


class IncidentEvolutionPredictor:

    TELECOM_CHAIN = [
        "MMG",
        "SMSC",
        "SMPPS",
        "DMC",
        "SMS_ROUTER",
        "HLR",
        "MSC",
    ]

    CRITICAL_KEYWORDS = {
        "fail",
        "timeout",
        "queue full",
        "refused",
        "disconnect",
        "connection failed",
        "drop",
        "authorization",
    }

    HIGH_KEYWORDS = {
        "retry",
        "error",
        "delay",
        "slow",
        "routing",
    }

    def __init__(self):
        self.mongo = MongoDBClient()
        self.db = self.mongo.get_database()

    def predict_evolution(
        self,
        anomaly_count,
        cluster_count,
        propagation_path,
        root_causes,
        severity,
    ):

        propagation_path = self._normalize_path(propagation_path)
        root_keywords = self._normalize_root_causes(root_causes)

        risk_score = 0
        risk_factors = []

        if anomaly_count > 50000:
            risk_score += 30
            risk_factors.append("high_anomaly_volume")

        if cluster_count > 50:
            risk_score += 20
            risk_factors.append("wide_cluster_spread")

        if len(propagation_path) >= 3:
            risk_score += 25
            risk_factors.append("multi_platform_cascade")

        if severity == "CRITICAL":
            risk_score += 25
            risk_factors.append("critical_severity")

        if any(keyword in self.CRITICAL_KEYWORDS for keyword in root_keywords):
            risk_score += 15
            risk_factors.append("critical_root_cause_keyword")
        elif any(keyword in self.HIGH_KEYWORDS for keyword in root_keywords):
            risk_score += 8
            risk_factors.append("high_root_cause_keyword")

        risk_score = min(risk_score, 100)

        next_platform = self._predict_next_platform(propagation_path)
        will_spread_more = risk_score >= 60
        will_touch_new_platform = bool(next_platform) and (
            will_spread_more or len(propagation_path) >= 2
        )
        severity_likely_to_increase = severity != "CRITICAL" and risk_score >= 50
        more_anomalies_expected = (
            anomaly_count > 10000
            or will_spread_more
            or any(keyword in self.CRITICAL_KEYWORDS for keyword in root_keywords)
        )

        prediction = {
            "timestamp": datetime.utcnow(),
            "severity": severity,
            "risk_score": risk_score,
            "will_spread_more": will_spread_more,
            "will_touch_new_platform": will_touch_new_platform,
            "severity_likely_to_increase": severity_likely_to_increase,
            "more_anomalies_expected": more_anomalies_expected,
            "next_possible_platform": next_platform,
            "current_propagation_length": len(propagation_path),
            "propagation_path": propagation_path,
            "root_cause_keywords": root_keywords[:10],
            "risk_factors": risk_factors,
        }

        self.db.incident_evolution.insert_one(prediction)

        return prediction

    def _predict_next_platform(self, propagation_path):
        if not propagation_path:
            return None

        for platform in reversed(propagation_path):
            if platform in self.TELECOM_CHAIN:
                index = self.TELECOM_CHAIN.index(platform)

                if index + 1 < len(self.TELECOM_CHAIN):
                    return self.TELECOM_CHAIN[index + 1]

                return None

        return None

    def _normalize_root_causes(self, root_causes):
        if isinstance(root_causes, dict):
            root_causes = root_causes.get("root_causes", [])

        keywords = []

        for item in root_causes or []:
            if isinstance(item, (list, tuple)) and item:
                keyword = item[0]
            else:
                keyword = item

            if keyword is None:
                continue

            text = str(keyword).strip().lower()

            if text:
                keywords.append(text)

        return list(dict.fromkeys(keywords))

    def _normalize_path(self, propagation_path):
        normalized = []

        for platform in propagation_path or []:
            text = str(platform).strip().upper()

            if text:
                normalized.append(text)

        return normalized
