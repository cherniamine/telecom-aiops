import hashlib
import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from pymongo import MongoClient


_PLATFORM_ACTIONS = {
    "MMG": [
        "Verifier la connectivite MMG -> SMSC",
        "Controler la profondeur de file d'attente MMG",
        "Activer le load balancing MMG si disponible",
    ],
    "SMSC": [
        "Inspecter le debit et la profondeur de file SMSC",
        "Redemarrer le pool de connexions SMSC si necessaire",
        "Verifier les sessions SMPP actives cote SMSC",
    ],
    "SMPPS": [
        "Verifier la gestion des sessions SMPP entrantes",
        "Controler les timeouts et la configuration bind SMPP",
        "Analyser les logs de reconnexion SMPPS",
    ],
    "SMPPC": [
        "Verifier les connexions SMPP sortantes (SMPPC)",
        "Controler les intervalles de retry SMPPC",
        "Analyser les rejets et codes d'erreur SMPPC",
    ],
    "DMC": [
        "Verifier la configuration de routage DMC",
        "Scaler les workers DMC si backlog detecte",
        "Controler les dependances DMC -> MMG",
    ],
}

_ROOT_CAUSE_LABELS = {
    "fail": "echecs de traitement",
    "error": "erreurs systeme",
    "retry": "re-tentatives excessives",
    "disconnect": "deconnexions SMPP",
    "timeout": "timeouts reseau",
    "refused": "connexions refusees",
    "drop": "messages abandonnes",
    "queue full": "files d'attente saturees",
    "authorization": "problemes d'autorisation",
    "routing": "problemes de routage",
}

_ESCALATION_TABLE = {
    ("HIGH", "HIGH"): "CRITICAL",
    ("HIGH", "MEDIUM"): "HIGH",
    ("HIGH", "LOW"): "MEDIUM",
    ("MEDIUM", "HIGH"): "HIGH",
    ("MEDIUM", "MEDIUM"): "MEDIUM",
    ("CRITICAL", "HIGH"): "CRITICAL",
    ("CRITICAL", "MEDIUM"): "CRITICAL",
    ("LOW", "HIGH"): "HIGH",
    ("LOW", "MEDIUM"): "MEDIUM",
}

_SEVERITY_WEIGHTS = {
    "CRITICAL": 40,
    "HIGH": 25,
    "MEDIUM": 10,
    "LOW": 3,
}
_CUSTOMER_IMPACT_WEIGHTS = {
    "HIGH": 20,
    "MEDIUM": 10,
    "LOW": 3,
}
_PROPAGATION_RISK_WEIGHTS = {
    "HIGH": 15,
    "MEDIUM": 7,
    "LOW": 2,
}
_PRIORITY_THRESHOLDS = [
    (80, "IMMEDIATE ACTION"),
    (60, "URGENT"),
    (40, "HIGH"),
    (0, "NORMAL"),
]
_SEVERITY_ORDER = {
    "LOW": 0,
    "MEDIUM": 1,
    "HIGH": 2,
    "CRITICAL": 3,
}


def compute_alert_rank_score(
    severity,
    spread_score,
    anomaly_count,
    cascade_length,
    customer_impact,
    propagation_risk,
):
    raw_score = (
        _SEVERITY_WEIGHTS.get(str(severity or "").upper(), 0)
        + min(int(spread_score or 0), 50)
        + min((anomaly_count or 0) // 10, 20)
        + min((cascade_length or 1) * 5, 25)
        + _CUSTOMER_IMPACT_WEIGHTS.get(
            str(customer_impact or "").upper(),
            0,
        )
        + _PROPAGATION_RISK_WEIGHTS.get(
            str(propagation_risk or "").upper(),
            0,
        )
    )
    return min(raw_score, 100)


def get_operator_priority(rank_score):
    for threshold, label in _PRIORITY_THRESHOLDS:
        if rank_score >= threshold:
            return label
    return "NORMAL"


def _max_severity(left, right):
    left_normalized = str(left or "LOW").upper()
    right_normalized = str(right or "LOW").upper()

    if (
        _SEVERITY_ORDER.get(right_normalized, 0)
        > _SEVERITY_ORDER.get(left_normalized, 0)
    ):
        return right_normalized

    return left_normalized


def escalate_severity(
    base,
    customer_impact,
    propagation_risk,
    spread_score=None,
):
    base_normalized = str(base or "LOW").upper()
    customer_normalized = str(customer_impact or "").upper()
    risk_normalized = str(propagation_risk or "").upper()
    escalated = _ESCALATION_TABLE.get(
        (customer_normalized, risk_normalized),
        base_normalized,
    )

    if spread_score and spread_score >= 40 and escalated == "HIGH":
        escalated = "CRITICAL"

    return _max_severity(base_normalized, escalated)


def _rca_summary(root_causes):
    if not root_causes:
        return ""

    labels = []

    for item in root_causes[:3]:
        keyword = str(
            item[0]
            if isinstance(item, (list, tuple)) and item
            else item
        ).lower()
        labels.append(_ROOT_CAUSE_LABELS.get(keyword, keyword))

    return ", ".join(labels)


def _dedupe_actions(actions):
    deduped = []
    seen = set()

    for action in actions:
        normalized = str(action or "").strip()

        if normalized and normalized not in seen:
            deduped.append(normalized)
            seen.add(normalized)

    return deduped


def _incident_message(
    anomaly_count,
    cluster_count,
    propagation_path,
    customer_impact,
    propagation_risk,
    spread_score,
    root_causes,
):
    platforms = " -> ".join(propagation_path) if propagation_path else "inconnues"
    root_cause_summary = _rca_summary(root_causes)
    parts = [
        (
            f"Cascade detectee sur {len(propagation_path)} plateforme(s) : "
            f"{platforms}."
        ),
        (
            f"{anomaly_count} anomalie(s) regroupees en "
            f"{cluster_count} cluster(s)."
        ),
        (
            f"Impact client : {str(customer_impact or 'UNKNOWN').upper()} - "
            f"Risque propagation : {str(propagation_risk or 'UNKNOWN').upper()}."
        ),
    ]

    if spread_score is not None:
        parts.append(f"Spread score : {spread_score}.")

    if root_cause_summary:
        parts.append(f"Causes identifiees : {root_cause_summary}.")

    return " ".join(parts)


def _platform_message(
    platform,
    incident_severity,
    propagation_path,
    propagation_risk,
    root_causes,
):
    cascade_length = max(1, len(propagation_path))

    if platform in propagation_path:
        cascade_position = propagation_path.index(platform) + 1
    else:
        cascade_position = 1

    if cascade_position == 1:
        position_label = "source probable"
    elif cascade_position == cascade_length:
        position_label = "terminal"
    else:
        position_label = f"etape {cascade_position}/{cascade_length}"

    parts = [
        f"Plateforme {platform} impactee ({position_label} de la cascade).",
        f"Severite incident : {str(incident_severity).upper()}.",
        (
            "Risque de propagation : "
            f"{str(propagation_risk or 'UNKNOWN').upper()}."
        ),
    ]

    root_cause_summary = _rca_summary(root_causes)

    if root_cause_summary:
        parts.append(f"Causes observees : {root_cause_summary}.")

    return " ".join(parts)


def _fingerprint(alert_type, propagation_path, platform=None):
    path_part = ":".join(sorted(str(item).upper() for item in propagation_path))
    platform_part = str(platform or "").upper()
    raw_key = f"{str(alert_type).upper()}:{platform_part}:{path_part}"
    return hashlib.md5(raw_key.encode("utf-8")).hexdigest()


class AlertService:
    INCIDENT_ALERT_SEVERITIES = {"CRITICAL", "HIGH"}
    HIGH_RISK_LEVELS = {"HIGH", "CRITICAL"}
    CRITICAL_LOG_LEVELS = {"CRITICAL", "FATAL", "PANIC"}

    def __init__(self):
        load_dotenv()
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        database_name = os.getenv("DATABASE_NAME", "telecom_logs")
        collection_name = os.getenv("ALERT_COLLECTION", "alerts")
        self.dedup_window_seconds = int(
            os.getenv("ALERT_DEDUP_SECONDS", "60")
        )

        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
        )
        self.collection = client[database_name][collection_name]

    def create_alert(
        self,
        message,
        severity="MEDIUM",
        alert_type="ANOMALY",
        source=None,
        metadata=None,
    ):
        document = {
            "type": str(alert_type).upper(),
            "severity": str(severity or "MEDIUM").upper(),
            "message": message,
            "created_at": datetime.now(timezone.utc),
            "status": "new",
        }

        if source is not None:
            document["source"] = source

        if metadata:
            document["metadata"] = metadata

        insert_result = self.collection.insert_one(document)
        document["_id"] = insert_result.inserted_id
        return document

    def create_incident_alert(
        self,
        anomaly_count,
        cluster_count,
        propagation_path,
        base_severity="MEDIUM",
        customer_impact=None,
        propagation_risk=None,
        sms_delivery_degradation=None,
        spread_score=None,
        root_causes=None,
        source="telecom_ai_orchestrator",
        predicted_resolution_minutes=None,
    ):
        propagation_path = propagation_path or []
        root_causes = root_causes or []

        if self._is_duplicate("INCIDENT", propagation_path):
            return None

        severity = escalate_severity(
            base_severity,
            customer_impact,
            propagation_risk,
            spread_score,
        )
        rank_score = compute_alert_rank_score(
            severity,
            spread_score,
            anomaly_count,
            len(propagation_path),
            customer_impact,
            propagation_risk,
        )
        priority = get_operator_priority(rank_score)
        message = _incident_message(
            anomaly_count,
            cluster_count,
            propagation_path,
            customer_impact,
            propagation_risk,
            spread_score,
            root_causes,
        )

        recommended_actions = []
        for platform in propagation_path:
            recommended_actions.extend(
                _PLATFORM_ACTIONS.get(str(platform).upper(), [])
            )

        metadata = {
            "anomaly_count": anomaly_count,
            "cluster_count": cluster_count,
            "propagation_path": propagation_path,
            "root_causes": root_causes[:5],
            "propagation_risk": propagation_risk,
            "customer_impact": customer_impact,
            "sms_delivery_degradation": sms_delivery_degradation,
            "spread_score": spread_score,
            "recommended_actions": _dedupe_actions(recommended_actions)[:6],
            "escalation_signals": {
                "customer_impact": customer_impact,
                "propagation_risk": propagation_risk,
                "sms_delivery_degradation": sms_delivery_degradation,
                "spread_score": spread_score,
            },
            "alert_rank_score": rank_score,
            "operator_priority": priority,
            "dedup_fingerprint": _fingerprint(
                "INCIDENT",
                propagation_path,
            ),
            "predicted_resolution_minutes": predicted_resolution_minutes,
        }

        alert = self.create_alert(
            message=message,
            severity=severity,
            alert_type="INCIDENT",
            source=source,
            metadata=metadata,
        )
        print(
            "  [Alert] INCIDENT | "
            f"{severity} | rank={rank_score} | {priority} | "
            f"{' -> '.join(propagation_path)}"
        )
        return alert

    def create_platform_alert(
        self,
        platform,
        incident_severity,
        propagation_path,
        propagation_risk=None,
        spread_score=None,
        anomaly_count=0,
        customer_impact=None,
        root_causes=None,
        source="telecom_ai_orchestrator",
        predicted_resolution_minutes=None,
    ):
        propagation_path = propagation_path or []
        root_causes = root_causes or []

        if self._is_duplicate("PLATFORM", propagation_path, platform=platform):
            return None

        severity = escalate_severity(
            incident_severity,
            customer_impact,
            propagation_risk,
            spread_score,
        )
        rank_score = compute_alert_rank_score(
            severity,
            spread_score,
            anomaly_count,
            len(propagation_path),
            customer_impact,
            propagation_risk,
        )
        priority = get_operator_priority(rank_score)
        message = _platform_message(
            platform,
            incident_severity,
            propagation_path,
            propagation_risk,
            root_causes,
        )

        if platform in propagation_path:
            cascade_position = propagation_path.index(platform) + 1
        else:
            cascade_position = 1

        metadata = {
            "platform": platform,
            "incident_severity": incident_severity,
            "related_root_causes": root_causes[:3],
            "propagation_risk": propagation_risk,
            "cascade_position": cascade_position,
            "cascade_length": len(propagation_path),
            "immediate_actions": _PLATFORM_ACTIONS.get(
                str(platform).upper(),
                ["Investiguer manuellement."],
            ),
            "alert_rank_score": rank_score,
            "operator_priority": priority,
            "dedup_fingerprint": _fingerprint(
                "PLATFORM",
                propagation_path,
                platform=platform,
            ),
            "predicted_resolution_minutes": predicted_resolution_minutes,
        }

        alert = self.create_alert(
            message=message,
            severity=severity,
            alert_type="PLATFORM",
            source=source,
            metadata=metadata,
        )
        print(
            f"  [Alert] PLATFORM {platform:<6} | "
            f"{severity} | rank={rank_score} | {priority}"
        )
        return alert

    def save_orchestration_alerts(
        self,
        propagation_path,
        anomaly_count,
        cluster_count,
        base_severity="MEDIUM",
        customer_impact=None,
        propagation_risk=None,
        sms_delivery_degradation=None,
        spread_score=None,
        root_causes=None,
        source="telecom_ai_orchestrator",
        predicted_resolution_minutes=None,
    ):
        if not self.should_send_incident_alert(
            severity=base_severity,
            propagation_risk=propagation_risk,
            customer_impact=customer_impact,
            sms_delivery_degradation=sms_delivery_degradation,
        ):
            print("Alert policy: skipping - no HIGH/CRITICAL signal.")
            return []

        alerts = []
        incident_alert = self.create_incident_alert(
            anomaly_count=anomaly_count,
            cluster_count=cluster_count,
            propagation_path=propagation_path,
            base_severity=base_severity,
            customer_impact=customer_impact,
            propagation_risk=propagation_risk,
            sms_delivery_degradation=sms_delivery_degradation,
            spread_score=spread_score,
            root_causes=root_causes,
            source=source,
            predicted_resolution_minutes=predicted_resolution_minutes,
        )

        if incident_alert:
            alerts.append(incident_alert)
        else:
            print(
                "  [Alert] INCIDENT suppressed - duplicate within dedup window."
            )

        for platform in propagation_path or []:
            platform_alert = self.create_platform_alert(
                platform=platform,
                incident_severity=base_severity,
                propagation_path=propagation_path,
                propagation_risk=propagation_risk,
                spread_score=spread_score,
                anomaly_count=anomaly_count,
                customer_impact=customer_impact,
                root_causes=root_causes,
                source=source,
                predicted_resolution_minutes=predicted_resolution_minutes,
            )
            if platform_alert:
                alerts.append(platform_alert)

        return alerts

    def should_send_incident_alert(
        self,
        severity=None,
        propagation_risk=None,
        customer_impact=None,
        sms_delivery_degradation=None,
    ):
        normalized_severity = str(severity or "").upper()

        if normalized_severity in self.INCIDENT_ALERT_SEVERITIES:
            return True

        risk_values = (
            propagation_risk,
            customer_impact,
            sms_delivery_degradation,
        )

        return any(
            str(value or "").upper() in self.HIGH_RISK_LEVELS
            for value in risk_values
        )

    def infer_log_alert_severity(self, log):
        if not isinstance(log, dict):
            return None

        raw_log = log.get("raw_log", {})
        if not isinstance(raw_log, dict):
            raw_log = {}

        severity_candidates = [
            log.get("severity"),
            log.get("log_level"),
            log.get("level"),
            raw_log.get("severity"),
            raw_log.get("log_level"),
            raw_log.get("level"),
        ]

        for candidate in severity_candidates:
            normalized_candidate = str(candidate or "").upper()
            if normalized_candidate in self.CRITICAL_LOG_LEVELS:
                return "CRITICAL"

        message_candidates = [
            log.get("message"),
            raw_log.get("message"),
            raw_log.get("raw_message"),
        ]
        message_text = " ".join(
            str(message)
            for message in message_candidates
            if message
        ).lower()

        if any(
            keyword in message_text
            for keyword in ("critical", "fatal", "panic")
        ):
            return "CRITICAL"

        return None

    def _is_duplicate(self, alert_type, propagation_path, platform=None):
        fingerprint = _fingerprint(
            alert_type,
            propagation_path or [],
            platform=platform,
        )
        cutoff = datetime.now(timezone.utc) - timedelta(
            seconds=self.dedup_window_seconds
        )
        return self.collection.find_one(
            {
                "type": str(alert_type).upper(),
                "metadata.dedup_fingerprint": fingerprint,
                "created_at": {"$gte": cutoff},
            }
        ) is not None
