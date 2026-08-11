import os
import re
from collections import Counter

from dotenv import load_dotenv
from pymongo import MongoClient

from llm.log_explainer import LogExplainer
from llm.telecom_ai_copilot import TelecomAICopilot
from ai.notification.email_alert_engine import EmailAlertEngine
from ai.prediction.auto_remediation_recommender import AutoRemediationRecommender
from ai.prediction.incident_evolution_predictor import IncidentEvolutionPredictor
from ai.prediction.incident_similarity_engine import IncidentSimilarityEngine
from services.alert_service import AlertService
from services.anomaly_service import AnomalyService
from services.clustering_service import ClusteringService
from services.incident_impact_service import IncidentImpactService
from services.rca_service import RCAService
from services.telecom_rca_service import TelecomRCAService
from ai.decisioning.impact_estimation_engine import ( ImpactEstimationEngine)
from services.impact_service import ImpactService
from ai.decisioning.incident_duration_prediction_engine import (IncidentDurationPredictionEngine)
from services.incident_duration_service import ( IncidentDurationService)


RUNTIME_ROOT_CAUSE_PATTERNS = [
    ("queue full", [r"queue full", r"queue saturation"]),
    ("timeout", [r"timeout", r"timed out", r"session timeout"]),
    ("retry", [r"retry", r"retries", r"backoff"]),
    ("refused", [r"refused", r"connection refused"]),
    (
        "disconnect",
        [
            r"disconnect",
            r"session closed",
            r"outside session closed",
            r"logout request",
            r"session shutting down",
        ],
    ),
    (
        "connection failed",
        [r"connection failed", r"connection reset by peer", r"reset by peer"],
    ),
    (
        "authorization",
        [
            r"authorization",
            r"unauthorized",
            r"permission denied",
            r"invalid",
            r"not found",
        ],
    ),
    ("routing", [r"routing", r"route", r"router"]),
    ("error", [r"error", r"exception", r"alert"]),
    ("fail", [r"fail", r"failed", r"failure"]),
    ("drop", [r"drop", r"packet loss"]),
]

PLATFORM_ROOT_CAUSE_HINTS = {
    "MMG": "timeout",
    "SMSC": "queue full",
    "SMPPS": "timeout",
    "SMPPC": "disconnect",
    "DMC": "routing",
    "SMS_ROUTER": "routing",
}

_RUNTIME_ORCHESTRATOR = None
_RUNTIME_EXPLAINER = None
_RUNTIME_COPILOT = None


def _save_incident_to_db(result: dict, impact: dict | None = None) -> str | None:
    """
    Sauvegarde l'incident realtime dans MongoDB `incidents`.
    Doit être appelé une seule fois par batch, après _finalize_orchestration_result.
    """
    try:
        from dashboard.dashboard_service import DashboardService
        svc = DashboardService()
        incident_id = svc.save_incident(result, impact)
        if incident_id:
            print(f"  ✓ Incident saved → incidents._id = {incident_id}")
        return incident_id
    except Exception as e:
        print(f"  ⚠ Could not save incident to DB: {e}")
        return None

class TelecomAIOrchestrator:

    def __init__(self):
        self.anomaly_service = AnomalyService()
        self.clustering_service = ClusteringService()
        self.rca_service = RCAService()
        self.telecom_rca_service = TelecomRCAService()
        self.alert_service = AlertService()

    # ------------------------------------------------

    def process_logs(self, logs, generate_alerts=True):
        if not logs:
            return {
                "anomalies": [],
                "clusters": [],
                "rca": {"root_causes": [], "count": 0},
                "telecom_rca": {
                    "root_causes": [],
                    "count": 0,
                    "propagation_path": [],
                },
                "alerts": [],
            }

        result = {}

        # 1. Detect anomalies
        anomalies = self.anomaly_service.analyze_batch(logs)
        result["anomalies"] = anomalies

        # 2. Cluster logs
        clusters = self.clustering_service.cluster_logs(logs)
        result["clusters"] = clusters

        # 3. Simple RCA
        anomaly_logs = [a["log"] for a in anomalies if a["is_anomaly"]]
        result["rca"] = self.rca_service.analyze(anomaly_logs)

        # 4. Telecom RCA
        result["telecom_rca"] = self.telecom_rca_service.process_logs(logs)

        # 5. Optional per-anomaly alerts
        alerts = []

        if generate_alerts:
            for anomaly in anomalies:
                if anomaly["is_anomaly"]:
                    alert_severity = self.alert_service.infer_log_alert_severity(
                        anomaly["log"]
                    )

                    if alert_severity:
                        alert = self.alert_service.create_alert(
                            message=anomaly["log"].get("message"),
                            severity=alert_severity,
                            source="telecom_ai_orchestrator",
                        )
                        alerts.append(alert)

        result["alerts"] = alerts

        return result


def _load_runtime_config():
    load_dotenv()

    return {
        "mongo_uri": os.getenv("MONGO_URI", "mongodb://localhost:27017/"),
        "database_name": os.getenv("DATABASE_NAME", "telecom_logs"),
        "log_collection": os.getenv("COLLECTION_NAME", "log_features"),
        "anomaly_collection": os.getenv("ANOMALY_COLLECTION", "anomalies"),
        "incident_intelligence_collection": os.getenv(
            "INCIDENT_INTELLIGENCE_COLLECTION",
            "incident_intelligence",
        ),
    }


def _build_logs_from_documents(documents):
    logs = []

    for document in documents:
        if isinstance(document.get("log"), dict):
            logs.append(document["log"])
            continue

        features = document.get("features", {})
        message = document.get("message")

        if not message:
            continue

        logs.append(
            {
                "message": str(message),
                "platform": document.get("platform", "unknown"),
                "timestamp": document.get("timestamp"),
                "hour": features.get("hour", document.get("hour")),
                "weekday": features.get("weekday", document.get("weekday")),
                "is_error": features.get("is_error", document.get("is_error")),
                "is_warning": features.get(
                    "is_warning",
                    document.get("is_warning"),
                ),
            }
        )

    return logs


def _load_logs_for_cli():
    config = _load_runtime_config()
    client = MongoClient(config["mongo_uri"], serverSelectionTimeoutMS=5000)
    db = client[config["database_name"]]

    anomaly_documents = list(
        db[config["anomaly_collection"]].find(
            {},
            {
                "log": 1,
                "features": 1,
                "message": 1,
                "platform": 1,
                "timestamp": 1,
                "hour": 1,
                "weekday": 1,
                "is_error": 1,
                "is_warning": 1,
            },
        )
    )
    logs = _build_logs_from_documents(anomaly_documents)
    latest_intelligence = db[config["incident_intelligence_collection"]].find_one(
        sort=[("timestamp", -1)]
    )

    if logs:
        return {
            "logs": logs,
            "source": "saved anomalies",
            "anomaly_documents": anomaly_documents,
            "latest_intelligence": latest_intelligence,
        }

    recent_logs = list(
        db[config["log_collection"]]
        .find(
            {},
            {
                "message": 1,
                "platform": 1,
                "timestamp": 1,
                "hour": 1,
                "weekday": 1,
                "is_error": 1,
                "is_warning": 1,
            },
        )
        .sort("_id", -1)
        .limit(20)
    )

    logs = _build_logs_from_documents(recent_logs)

    return {
        "logs": logs,
        "source": "recent logs",
        "anomaly_documents": [],
        "latest_intelligence": latest_intelligence,
    }


def _analyze_saved_anomalies(orchestrator, anomaly_documents, logs):
    return {
        "anomalies": anomaly_documents,
        "clusters": orchestrator.clustering_service.cluster_logs(logs),
        "rca": orchestrator.rca_service.analyze(logs),
        "telecom_rca": orchestrator.telecom_rca_service.process_logs(logs),
        "alerts": [],
    }


def _count_clusters(clusters):
    if isinstance(clusters, dict):
        return len(clusters)

    if isinstance(clusters, list):
        return len(
            {
                item.get("cluster_id")
                for item in clusters
                if isinstance(item, dict) and item.get("cluster_id") is not None
            }
        )

    return 0


def _build_result_from_intelligence_snapshot(
    anomaly_documents,
    intelligence_document,
):
    top_root_causes = intelligence_document.get("top_root_causes", [])
    propagation_path = intelligence_document.get("timeline", [])

    return {
        "anomalies": anomaly_documents,
        "clusters": [],
        "rca": {
            "root_causes": top_root_causes,
            "count": len(top_root_causes),
        },
        "telecom_rca": {
            "root_causes": top_root_causes,
            "count": len(top_root_causes),
            "propagation_path": propagation_path,
        },
        "alerts": [],
        "snapshot_summary": intelligence_document.get("summary"),
        "snapshot_cluster_count": intelligence_document.get("cluster_count", 0),
        "snapshot_severity": intelligence_document.get("severity_label"),
        "snapshot_recommendations": intelligence_document.get(
            "recommended_actions",
            [],
        ),
        "snapshot_reasons": intelligence_document.get("severity_reasons", []),
    }


def _infer_severity_label(result):
    if result.get("snapshot_severity"):
        return result["snapshot_severity"]

    anomaly_count = len(result.get("anomalies", []))
    cluster_count = _count_clusters(result.get("clusters", []))

    if anomaly_count >= 1000 or cluster_count >= 10:
        return "HIGH"

    if anomaly_count >= 100 or cluster_count >= 3:
        return "MEDIUM"

    return "LOW"


def _save_orchestration_alerts(result, impact=None, duration_prediction=None):
    alert_service = AlertService()

    anomaly_count = len(result.get("anomalies", []))
    cluster_count = result.get("snapshot_cluster_count")

    if cluster_count is None:
        cluster_count = _count_clusters(result.get("clusters", []))

    propagation_path = result.get("telecom_rca", {}).get(
        "propagation_path",
        [],
    )
    root_causes = result.get("rca", {}).get("root_causes", [])
    severity = (
        (impact or {}).get("severity_label")
        or result.get("snapshot_severity")
        or _infer_severity_label(result)
    )
    propagation_risk = (impact or {}).get("propagation_risk")
    customer_impact = (impact or {}).get("customer_impact")
    sms_delivery_degradation = (impact or {}).get(
        "sms_delivery_degradation"
    )
    # 🔧 RÉCUPÉRER predicted_resolution_minutes depuis duration_prediction
    predicted_resolution_minutes = None
    if duration_prediction:
        predicted_resolution_minutes = duration_prediction.get("estimated_resolution_minutes")
    
    # 🔧 Valeur par défaut si non disponible
    if not predicted_resolution_minutes:
        predicted_resolution_minutes = 15

    alerts = []

    if not alert_service.should_send_incident_alert(
        severity=severity,
        propagation_risk=propagation_risk,
        customer_impact=customer_impact,
        sms_delivery_degradation=sms_delivery_degradation,
    ):
        print(
            "Alert policy: skipping alert creation because incident is "
            "not CRITICAL and risk is below HIGH."
        )
        result["alerts"] = alerts
        return alerts

    alerts = alert_service.save_orchestration_alerts(
        propagation_path=propagation_path,
        anomaly_count=anomaly_count,
        cluster_count=cluster_count,
        base_severity=severity,
        customer_impact=customer_impact,
        propagation_risk=propagation_risk,
        sms_delivery_degradation=sms_delivery_degradation,
        spread_score=(impact or {}).get("spread_score")
        or (impact or {}).get("incident_spread_score"),
        root_causes=root_causes,
        source="telecom_ai_orchestrator",
        predicted_resolution_minutes=predicted_resolution_minutes,
    )

    result["alerts"] = alerts

    return alerts


def _load_latest_propagation_snapshot():
    config = _load_runtime_config()
    client = MongoClient(
        config["mongo_uri"],
        serverSelectionTimeoutMS=5000,
    )

    try:
        db = client[config["database_name"]]

        return db[config["incident_intelligence_collection"]].find_one(
            {"timeline.0": {"$exists": True}},
            sort=[("timestamp", -1)],
        )
    finally:
        client.close()


def _apply_propagation_fallback(result):
    telecom_rca = result.setdefault("telecom_rca", {})
    propagation_path = telecom_rca.get("propagation_path", [])

    if propagation_path:
        return propagation_path

    try:
        latest_snapshot = _load_latest_propagation_snapshot()
    except Exception as error:
        print(f"Propagation fallback unavailable: {error}")
        return propagation_path

    if not latest_snapshot:
        return propagation_path

    fallback_path = latest_snapshot.get("timeline", [])

    if fallback_path:
        telecom_rca["propagation_path"] = fallback_path
        print(
            "Using historical propagation fallback:",
            " -> ".join(fallback_path),
        )

    return telecom_rca.get("propagation_path", [])


def _infer_root_causes_from_logs(logs):
    keyword_scores = Counter()

    for log in logs or []:
        if isinstance(log, dict):
            message = log.get("message", "")
        else:
            message = str(log)

        message_text = str(message or "").lower()

        if not message_text:
            continue

        for keyword, patterns in RUNTIME_ROOT_CAUSE_PATTERNS:
            if any(re.search(pattern, message_text) for pattern in patterns):
                keyword_scores[keyword] += 1

    return [
        (keyword, float(score))
        for keyword, score in keyword_scores.most_common(5)
    ]


def _infer_root_causes_from_platforms(propagation_path):
    keyword_scores = Counter()

    for platform in propagation_path or []:
        keyword = PLATFORM_ROOT_CAUSE_HINTS.get(
            str(platform or "").upper()
        )

        if keyword:
            keyword_scores[keyword] += 1

    return [
        (keyword, float(score))
        for keyword, score in keyword_scores.most_common(3)
    ]


def _resolve_primary_root_causes(result, logs, propagation_path):
    primary_root_causes = result.get("rca", {}).get("root_causes", [])

    if primary_root_causes:
        return primary_root_causes

    telecom_root_causes = result.get("telecom_rca", {}).get(
        "root_causes",
        [],
    )

    if telecom_root_causes:
        result.setdefault("rca", {})
        result["rca"]["root_causes"] = telecom_root_causes
        result["rca"]["count"] = result.get("telecom_rca", {}).get(
            "count",
            len(telecom_root_causes),
        )
        return telecom_root_causes

    inferred_root_causes = _infer_root_causes_from_logs(logs)

    if not inferred_root_causes:
        inferred_root_causes = _infer_root_causes_from_platforms(
            propagation_path
        )

    if inferred_root_causes:
        result.setdefault("rca", {})
        result["rca"]["root_causes"] = inferred_root_causes
        result["rca"]["count"] = len(inferred_root_causes)
        result.setdefault("telecom_rca", {})
        result["telecom_rca"]["root_causes"] = inferred_root_causes

    return inferred_root_causes


def _send_incident_email_if_needed(
    severity,
    propagation_path,
    root_causes,
    impact_prediction,
    duration_prediction,
):
    normalized_severity = str(severity or "").upper()

    if normalized_severity not in {"CRITICAL", "HIGH"}:
        print(
            "Email policy: skipping email because severity is below HIGH."
        )
        return False

    top_root_causes = []

    for root_cause in root_causes[:3]:
        if isinstance(root_cause, (list, tuple)) and root_cause:
            top_root_causes.append(str(root_cause[0]))
        elif root_cause:
            top_root_causes.append(str(root_cause))

    root_cause_text = ", ".join(top_root_causes) or "unknown"

    email_engine = EmailAlertEngine()

    return email_engine.send_alert(
        severity=normalized_severity,
        propagation_path=propagation_path,
        root_cause=root_cause_text,
        impact=impact_prediction.get("customer_impact"),
        duration=duration_prediction.get(
            "estimated_resolution_minutes"
        ),
    )


def _normalize_runtime_logs(logs):
    normalized_logs = []

    for item in logs or []:
        if isinstance(item, dict):
            if isinstance(item.get("log"), dict):
                normalized_logs.append(item["log"])
                continue

            features = item.get("features", {})
            raw_log = item.get("raw_log", {})

            if not isinstance(raw_log, dict):
                raw_log = {}

            message = (
                item.get("message")
                or item.get("log")
                or item.get("text")
                or raw_log.get("message")
                or raw_log.get("raw_message")
            )

            if not message:
                continue

            normalized_logs.append(
                {
                    "message": str(message),
                    "platform": item.get(
                        "platform",
                        raw_log.get("platform", "unknown"),
                    ),
                    "timestamp": item.get(
                        "timestamp",
                        raw_log.get("timestamp"),
                    ),
                    "hour": features.get("hour", item.get("hour")),
                    "weekday": features.get(
                        "weekday",
                        item.get("weekday"),
                    ),
                    "is_error": features.get(
                        "is_error",
                        item.get("is_error"),
                    ),
                    "is_warning": features.get(
                        "is_warning",
                        item.get("is_warning"),
                    ),
                }
            )
            continue

        message = str(item).strip()

        if not message:
            continue

        normalized_logs.append(
            {
                "message": message,
                "platform": "unknown",
            }
        )

    return normalized_logs


def _finalize_orchestration_result(result):
    if not result:
        return None

    impact_engine = ImpactEstimationEngine()
    impact_service = ImpactService()
    propagation_path = _apply_propagation_fallback(result)
    anomaly_logs = [
        anomaly.get("log")
        for anomaly in result.get("anomalies", [])
        if isinstance(anomaly, dict) and anomaly.get("log")
    ]
    root_causes = _resolve_primary_root_causes(
        result,
        logs=anomaly_logs,
        propagation_path=propagation_path,
    )

    cluster_count = result.get("snapshot_cluster_count")

    if cluster_count is None:
        cluster_count = _count_clusters(result.get("clusters", []))

    impact = impact_engine.estimate(
        anomaly_count=len(result.get("anomalies", [])),
        cluster_count=cluster_count,
        propagation_path=propagation_path,
        root_causes=root_causes,
    )

    spread_score = impact.get(
        "incident_spread_score",
        impact.get("spread_score"),
    )

    impact_service.save(impact)
    result["impact"] = impact

    print("\nIMPACT ESTIMATION")
    print("Affected platforms:", impact["affected_platform_count"])
    print("Estimated severity:", impact["severity_label"])
    print(
        "Potential SMS delivery degradation:",
        impact["sms_delivery_degradation"],
    )
    print("Propagation risk:", impact["propagation_risk"])
    print("Customer impact:", impact["customer_impact"])
    print("Spread score:", spread_score)

    impact_storage_service = IncidentImpactService()

    impact_document = {
        "affected_platforms": impact["affected_platforms"],
        "severity_label": impact["severity_label"],
        "sms_delivery_degradation": impact["sms_delivery_degradation"],
        "propagation_risk": impact["propagation_risk"],
        "customer_impact": impact["customer_impact"],
        "spread_score": spread_score,
        "anomaly_count": len(result.get("anomalies", [])),
        "cluster_count": cluster_count,
        "propagation_path": propagation_path,
    }

    impact_storage_service.save(impact_document)
    result["impact_prediction"] = impact_document

    print("\nDURATION PREDICTION")

    duration_engine = IncidentDurationPredictionEngine()
    duration_service = IncidentDurationService()

    duration_prediction = duration_engine.predict(
        anomaly_count=len(result.get("anomalies", [])),
        cluster_count=cluster_count,
        propagation_path=propagation_path,
        root_causes=root_causes,
    )

    duration_prediction_document = {
        **duration_prediction,
        "anomaly_count": len(result.get("anomalies", [])),
        "cluster_count": cluster_count,
        "propagation_path": propagation_path,
        "top_root_causes": root_causes[:5],
        "severity": impact["severity_label"],
        "source": "telecom_ai_orchestrator",
    }

    duration_service.save(duration_prediction_document)
    result["duration_prediction"] = duration_prediction_document

    print(
        "Estimated resolution time:",
        duration_prediction["estimated_resolution_minutes"],
        "minutes",
    )
    print(
        "Recovery complexity:",
        duration_prediction["recovery_complexity"],
    )
    print(
        "Incident stability:",
        duration_prediction["incident_stability"],
    )
    print(
        "Escalation probability:",
        duration_prediction["escalation_probability"],
    )
    print(
        "Confidence score:",
        duration_prediction["confidence_score"],
        "%",
    )

    anomaly_count = len(result.get("anomalies", []))
    severity_label = impact["severity_label"]

    print("\nEMAIL ALERT")

    email_alert_sent = _send_incident_email_if_needed(
        severity=severity_label,
        propagation_path=propagation_path,
        root_causes=root_causes,
        impact_prediction=impact_document,
        duration_prediction=duration_prediction_document,
    )
    result["email_alert_sent"] = email_alert_sent

    print("\nEVOLUTION PREDICTION")

    evolution_engine = IncidentEvolutionPredictor()

    evolution_prediction = evolution_engine.predict_evolution(
        anomaly_count=anomaly_count,
        cluster_count=cluster_count,
        propagation_path=propagation_path,
        root_causes=root_causes,
        severity=severity_label,
    )

    result["evolution_prediction"] = evolution_prediction

    print(evolution_prediction)

    print("\nAUTO REMEDIATION")

    remediation_engine = AutoRemediationRecommender()

    remediation = remediation_engine.recommend_actions(
        root_causes=root_causes,
        propagation_path=propagation_path,
        severity=severity_label,
    )

    result["auto_remediation"] = remediation

    print(remediation)

    print("\nSIMILAR INCIDENT SEARCH")

    similarity_engine = IncidentSimilarityEngine()

    similar_incidents = similarity_engine.find_similar_incidents(
        propagation_path=propagation_path,
        severity=severity_label,
        root_causes=root_causes,
    )

    result["similar_incidents"] = similar_incidents

    print(similar_incidents)

    copilot = _get_runtime_copilot()

    print("\nORCHESTRATION SUMMARY")
    print(f"Detected anomalies: {len(result.get('anomalies', []))}")

    summary_cluster_count = result.get("snapshot_cluster_count")

    if summary_cluster_count is None:
        summary_cluster_count = _count_clusters(result.get("clusters", []))

    print(f"Clusters: {summary_cluster_count}")
    print(f"Root causes: {result.get('rca', {}).get('root_causes', [])}")
    print("Propagation path:", propagation_path)

    if result.get("snapshot_severity"):
        print(f"Severity: {result['snapshot_severity']}")
    else:
        print(f"Severity: {severity_label}")

    # 🔧 CORRECTION: Appeler _save_orchestration_alerts APRÈS avoir défini duration_prediction_document
    saved_alerts = _save_orchestration_alerts(
        result,
        impact=impact,
        duration_prediction=duration_prediction_document  # Maintenant défini
    )

    print(f"Alerts saved: {len(saved_alerts)}")

    if saved_alerts:
        print(f"Latest alert id: {saved_alerts[-1].get('_id')}")

    print("\nEXPLANATION")

    if result.get("snapshot_summary"):
        print(result["snapshot_summary"])

        for reason in result.get("snapshot_reasons", []):
            print(f"- {reason}")

        recommendations = result.get("snapshot_recommendations", [])

        if recommendations:
            print("Recommendations:")

            for recommendation in recommendations:
                print(f"- {recommendation}")
    else:
        print(copilot.ask("explain incident", result))
    
    # Sauvegarder l'incident realtime dans MongoDB
    saved_incident_id = _save_incident_to_db(result, impact)
    if saved_incident_id:
        result["incident_id"] = saved_incident_id

    return result


def _get_runtime_orchestrator():
    global _RUNTIME_ORCHESTRATOR

    if _RUNTIME_ORCHESTRATOR is None:
        _RUNTIME_ORCHESTRATOR = TelecomAIOrchestrator()

    return _RUNTIME_ORCHESTRATOR


def _get_runtime_copilot():
    global _RUNTIME_EXPLAINER
    global _RUNTIME_COPILOT

    if _RUNTIME_EXPLAINER is None:
        _RUNTIME_EXPLAINER = LogExplainer()

    if _RUNTIME_COPILOT is None:
        _RUNTIME_COPILOT = TelecomAICopilot(_RUNTIME_EXPLAINER)

    return _RUNTIME_COPILOT


def run_orchestrator(logs):
    print("Running AI orchestration on realtime/batch logs...")

    normalized_logs = _normalize_runtime_logs(logs)

    if not normalized_logs:
        print("No logs provided to orchestrator.")
        return None

    print(f"Processing {len(normalized_logs)} logs...")

    orchestrator = _get_runtime_orchestrator()
    result = orchestrator.process_logs(
        normalized_logs,
        generate_alerts=False,
    )

    return _finalize_orchestration_result(result)


def main():
    print("Starting Telecom AI Orchestrator...")

    try:
        runtime_data = _load_logs_for_cli()
    except Exception as error:
        print(f"MongoDB load error: {error}")
        return

    logs = runtime_data["logs"]
    source = runtime_data["source"]
    anomaly_documents = runtime_data["anomaly_documents"]
    latest_intelligence = runtime_data["latest_intelligence"]

    if not logs:
        print("No logs available for orchestration.")
        return

    print(f"Loaded {len(logs)} logs from {source}.")

    if anomaly_documents and len(anomaly_documents) > 5000 and latest_intelligence:
        print(
            "Using saved incident intelligence snapshot for large anomaly volume."
        )
        result = _build_result_from_intelligence_snapshot(
            anomaly_documents,
            latest_intelligence,
        )
        return _finalize_orchestration_result(result)
    elif anomaly_documents:
        orchestrator = TelecomAIOrchestrator()
        print(
            "Using saved anomaly documents from MongoDB "
            "without re-running alert generation."
        )
        result = _analyze_saved_anomalies(
            orchestrator,
            anomaly_documents,
            logs,
        )
        return _finalize_orchestration_result(result)
    else:
        return run_orchestrator(logs)


if __name__ == "__main__":
    main()
