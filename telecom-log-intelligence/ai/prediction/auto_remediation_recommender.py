from datetime import datetime

from database.mongodb_client import MongoDBClient


class AutoRemediationRecommender:

    ACTION_RULES = [
        ("queue full", "Increase SMSC queue capacity"),
        ("timeout", "Restart SMPP sessions"),
        ("disconnect", "Verify SMPP session handling"),
        ("authorization", "Review authorization and session validation flows"),
        ("routing", "Check routing configuration and platform dependencies"),
        ("refused", "Check authentication routing policies"),
        ("connection failed", "Validate TCP connectivity and session setup"),
        ("fail", "Restart failing telecom connectors"),
        ("retry", "Throttle retry storms and review backoff"),
        ("error", "Inspect application error logs and service health"),
        ("drop", "Check packet loss and transport drops"),
    ]

    PLATFORM_RULES = {
        "MMG": "Validate MMG queue status",
        "SMSC": "Inspect SMSC throughput and queue depth",
        "SMPPS": "Verify SMPP session handling",
        "DMC": "Check DMC routing configuration",
        "SMS_ROUTER": "Validate SMS router routing tables",
        "HLR": "Inspect HLR query latency",
        "MSC": "Check MSC signaling stability",
    }

    def __init__(self):
        self.mongo = MongoDBClient()
        self.db = self.mongo.get_database()

    def recommend_actions(
        self,
        root_causes,
        propagation_path,
        severity,
    ):

        keywords = self._normalize_root_causes(root_causes)
        platforms = self._normalize_path(propagation_path)

        actions = []

        for keyword, action in self.ACTION_RULES:
            if keyword in keywords:
                actions.append(action)

        for platform in platforms:
            platform_action = self.PLATFORM_RULES.get(platform)

            if platform_action:
                actions.append(platform_action)

        if severity == "CRITICAL":
            actions.append("Trigger emergency telecom escalation workflow")

        actions = self._dedupe(actions)

        if not actions:
            actions.append("Perform manual investigation - No automated actions available")

        remediation_doc = {
            "timestamp": datetime.utcnow(),
            "recommended_actions": actions,
            "severity": severity,
            "affected_platforms": platforms,
            "root_cause_keywords": keywords[:10],
            "action_count": len(actions),
        }

        self.db.auto_remediation.insert_one(remediation_doc)

        return remediation_doc

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

    def _dedupe(self, actions):
        deduped = []

        for action in actions:
            if action not in deduped:
                deduped.append(action)

        return deduped
