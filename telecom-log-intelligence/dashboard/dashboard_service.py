import os
import re
from datetime import datetime, timezone, timedelta

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

from ai.engine.anomaly_threshold_engine import AnomalyThresholdEngine
from ai.engine.embedding_engine import EmbeddingEngine
from monitoring.model_drift_detector import ModelDriftDetector
from similarity.faiss_similarity_engine import FaissSimilarityEngine


class DashboardService:

    def __init__(self):
        load_dotenv()

        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        database_name = os.getenv("DATABASE_NAME", "telecom_logs")

        client = MongoClient(mongo_uri)
        self.db = client[database_name]
        self.threshold_engine = AnomalyThresholdEngine()
        self._faiss_engine = None
        self._embedding_engine = None
        self._drift_detector = None

    def get_overview(self):
        return {
            "total_logs": self.db.log_features.count_documents({}),
            "total_anomalies": self.db.anomalies.count_documents({}),
            "total_incidents": self.db.incidents.count_documents({}),
            "total_alerts": self.db.alerts.count_documents({}),
            "total_evolution_predictions": self.db.incident_evolution.count_documents({}),
            "total_remediations": self.db.auto_remediation.count_documents({}),
            "total_similar_incidents": self.db.similar_incidents.count_documents({}),
            "latest_severity": self._get_latest_severity(),
        }

    def get_anomalies(self):
        """
        Fetch and enrich anomalies with incident-specific data.
        
        For each anomaly:
        1. Try to find its associated incident using incident_id
        2. If found, use incident-specific data (severity, impact, etc.)
        3. If not found, fall back to the latest intelligence snapshot
        
        This ensures realtime and batch anomalies have their own enrichment data,
        not merged data from the batch snapshot.
        """
        documents = list(
            self.db.anomalies.find().sort("created_at", -1).limit(100)
        )

        enriched_documents = []

        for document in documents:
            incident_id = document.get("incident_id")
            incident = None
            
            # Priority: use incident-specific data
            if incident_id:
                try:
                    # Try to convert to ObjectId if it's a string
                    object_id = self._to_object_id(incident_id)
                    if object_id:
                        incident = self.db.incidents.find_one(
                            {"_id": object_id}
                        )
                    
                    # Fallback: search by incident_id as string
                    if not incident:
                        incident = self.db.incidents.find_one(
                            {"_id": incident_id}
                        )
                except Exception as e:
                    print(f"Error fetching incident {incident_id}: {e}")
            
            # Enrich with incident data if found
            if incident:
                self._enrich_anomaly_from_incident(
                    document,
                    incident
                )
            else:
                # Fallback: use batch intelligence snapshot
                self._enrich_anomaly_from_intelligence(
                    document
                )
            
            enriched_documents.append(document)

        return self._serialize_value(enriched_documents)

    def get_incident_anomalies(self, incident_id, limit=200):
        """Return anomalies linked to one incident without the dashboard recency limit."""
        query_values = [incident_id]
        object_id = self._to_object_id(incident_id)

        if object_id is not None:
            query_values.append(object_id)

        documents = list(
            self.db.anomalies.find(
                {"incident_id": {"$in": query_values}}
            ).sort("created_at", -1).limit(limit)
        )
        return self._serialize_value(documents)

    def _enrich_anomaly_from_incident(self, document, incident):
        """Enrich anomaly with data from its associated incident."""
        # Extract incident data
        severity = incident.get("severity")
        if isinstance(severity, dict):
            severity_label = severity.get("label")
        else:
            severity_label = severity
        
        impact = incident.get("impact", {})
        if isinstance(impact, dict):
            customer_impact = impact.get("customer_impact")
        else:
            customer_impact = impact
        
        propagation_analysis = incident.get("telecom_dependency_analysis", {})
        propagation_path = propagation_analysis.get("propagation_path", [])
        
        root_cause_analysis = incident.get("root_cause", {})
        if not root_cause_analysis:
            root_cause_analysis = incident.get("root_cause_analysis", {})
        
        root_causes = root_cause_analysis.get("root_causes", [])
        
        recommendations = incident.get("recommended_actions", [])
        predicted_minutes = incident.get("predicted_duration_minutes")
        
        # Enrich document
        platform = str(document.get("platform", "")).upper()
        
        document["severity"] = severity_label or "MEDIUM"
        document["impact"] = customer_impact or "MEDIUM"
        document["impact_level"] = customer_impact or "MEDIUM"
        document["propagation_stage"] = self._get_propagation_stage(
            platform,
            propagation_path
        )
        
        # Extract root cause
        root_cause = None
        if root_causes:
            if isinstance(root_causes[0], (list, tuple)):
                root_cause = root_causes[0][0]
            else:
                root_cause = root_causes[0]
        
        document["rca"] = document.get("rca") or root_cause
        document["root_cause"] = document.get("root_cause") or root_cause
        
        # Select action
        document["action"] = document.get("action") or self._select_action(
            platform,
            root_causes,
            recommendations,
        )
        document["recommended_action"] = document.get("action")
        
        document["predicted_resolution_minutes"] = predicted_minutes

    def _enrich_anomaly_from_intelligence(self, document):
        """Fallback: Enrich anomaly with batch intelligence snapshot data."""
        intelligence = self._get_latest_intelligence_snapshot()
        remediation = self._get_latest_auto_remediation()
        impact_prediction = self._get_latest_impact_prediction()
        duration_prediction = self._get_latest_duration_prediction()
        
        root_causes = intelligence.get("top_root_causes", [])
        recommendations = (
            remediation.get("recommended_actions")
            or intelligence.get("recommended_actions", [])
        )
        propagation_path = intelligence.get("timeline", [])
        severity_label = (
            intelligence.get("severity_label")
            or impact_prediction.get("severity_label")
        )
        impact_level = impact_prediction.get("customer_impact")
        predicted_resolution_minutes = duration_prediction.get(
            "estimated_resolution_minutes"
        )
        
        primary_root_cause = (
            root_causes[0][0]
            if root_causes and isinstance(root_causes[0], (list, tuple))
            else (
                remediation.get("root_cause_keywords", [None])[0]
                if remediation.get("root_cause_keywords")
                else None
            )
        )
        
        platform = str(document.get("platform", "")).upper()
        document["severity"] = severity_label
        document["rca"] = document.get("rca") or primary_root_cause
        document["root_cause"] = document["rca"]
        document["action"] = document.get("action") or self._select_action(
            platform,
            root_causes,
            recommendations,
        )
        document["recommended_action"] = document["action"]
        document["impact"] = impact_level
        document["impact_level"] = impact_level
        document["predicted_resolution_minutes"] = (
            predicted_resolution_minutes
        )
        document["propagation_stage"] = self._get_propagation_stage(
            platform,
            propagation_path,
        )

    def get_rca(self):
        incident_documents = list(
            self.db.incidents.find(
                {
                    "$or": [
                        {"root_cause.root_causes.0": {"$exists": True}},
                        {
                            "root_cause_analysis.root_causes.0": {
                                "$exists": True
                            }
                        },
                    ]
                }
            ).sort("created_at", -1).limit(20)
        )

        if incident_documents:
            return self._serialize_value(incident_documents)

        intelligence_document = self._get_latest_intelligence_snapshot()

        if not intelligence_document:
            return []

        return self._serialize_value(
            [
                {
                    "timestamp": intelligence_document.get("timestamp"),
                    "summary": intelligence_document.get("summary"),
                    "root_causes": intelligence_document.get(
                        "top_root_causes",
                        [],
                    ),
                    "severity_label": intelligence_document.get(
                        "severity_label"
                    ),
                    "affected_platforms": intelligence_document.get(
                        "affected_platforms",
                        [],
                    ),
                }
            ]
        )

    def get_timeline(self):
        incidents = list(
            self.db.incidents.find(
                {},
                {
                    "timestamp": 1,
                    "created_at": 1,
                    "incident_summary": 1,
                    "telecom_dependency_analysis.propagation_path": 1,
                    "timeline": 1,
                    "status": 1,
                },
            ).sort("created_at", -1).limit(50)
        )

        if incidents:
            return self._serialize_value(incidents)

        anomalies = list(
            self.db.anomalies.find({}, {"timestamp": 1, "platform": 1})
            .sort("timestamp", -1)
            .limit(500)
        )

        return self._serialize_value(anomalies)

    def get_heatmap(self):
        documents = list(
            self.db.anomalies.aggregate(
                [
                    {
                        "$group": {
                            "_id": "$platform",
                            "count": {"$sum": 1},
                        }
                    },
                    {"$sort": {"count": -1}},
                ]
            )
        )

        return self._serialize_value(documents)

    def get_impact_estimation(self):
        document = self._get_latest_impact_prediction()

        return self._serialize_value(document)

    def get_evolution_prediction(self):
        document = self._get_latest_evolution_prediction()

        return self._serialize_value(document)

    def get_remediation(self):
        document = self._get_latest_auto_remediation()

        return self._serialize_value(document)

    def get_similar_incidents(self):
        document = self._get_latest_similar_incidents()

        return self._serialize_value(document)

    def get_faiss_stats(self):
        engine = self._get_faiss_engine()

        return self._serialize_value(engine.get_stats())

    def get_faiss_build_status(self):
        engine = self._get_faiss_engine()

        return self._serialize_value(engine.get_build_status())

    def build_faiss_index(
        self,
        force_rebuild=False,
        background=True,
    ):
        engine = self._get_faiss_engine()
        result = engine.build_index(
            force_rebuild=force_rebuild,
            background=background,
        )

        return self._serialize_value(result)

    def get_similar_logs_by_index(
        self,
        log_index,
        k=5,
        platform=None,
    ):
        engine = self._get_faiss_engine()
        result = engine.search_similar_logs_by_index(
            log_index=log_index,
            k=k,
            platform_filter=platform,
        )

        return self._serialize_value(result)

    def search_similar_logs_by_text(
        self,
        query,
        k=5,
        platform_filter=None,
    ):
        engine = self._get_faiss_engine()
        embedding_engine = self._get_embedding_engine()
        results = engine.search_by_text(
            query_text=query,
            k=k,
            embedding_engine=embedding_engine,
            platform_filter=platform_filter,
        )

        return self._serialize_value(
            {
                "query": query,
                "results": results,
                "count": len(results),
                "search_timestamp": datetime.now().isoformat(),
            }
        )

    def search_similar_logs_by_embedding(
        self,
        embedding,
        k=5,
        platform_filter=None,
    ):
        engine = self._get_faiss_engine()
        results = engine.search_similar_logs(
            query_embedding=embedding,
            k=k,
            platform_filter=platform_filter,
        )

        return self._serialize_value(
            {
                "results": results,
                "count": len(results),
                "search_timestamp": datetime.now().isoformat(),
            }
        )

    def get_similar_incidents_by_id(
        self,
        incident_id,
        k=3,
    ):
        engine = self._get_faiss_engine()
        result = engine.search_similar_incident(
            incident_id=incident_id,
            k=k,
        )

        return self._serialize_value(result)

    def get_duration_prediction(self):
        document = self._get_latest_duration_prediction()

        return self._serialize_value(document)

    def get_incident_intelligence(self):
        document = self._get_latest_intelligence_snapshot()

        return self._serialize_value(document)

    def get_incident_context(self, incident_id=None):
        incident = self._get_incident_document(incident_id)
        intelligence = self._get_latest_intelligence_snapshot()
        impact_prediction = self._get_latest_impact_prediction()
        duration_prediction = self._get_latest_duration_prediction()
        remediation = self._get_latest_auto_remediation()

        propagation_path = (
            incident.get("telecom_dependency_analysis", {}).get(
                "propagation_path"
            )
            or incident.get("timeline", {}).get("timeline", [])
            or incident.get("timeline", [])
            or intelligence.get("timeline", [])
        )
        root_cause = (
            incident.get("root_cause")
            or incident.get("root_cause_analysis")
            or {
                "root_causes": intelligence.get("top_root_causes", [])
            }
        )
        severity = incident.get("severity") or {
            "label": intelligence.get("severity_label")
            or impact_prediction.get("severity_label")
            or "UNKNOWN"
        }
        impact = incident.get("impact") or {
            "customer_impact": impact_prediction.get("customer_impact"),
            "sms_delivery_degradation": intelligence.get(
                "sms_delivery_degradation"
            ),
            "propagation_risk": intelligence.get("propagation_risk"),
        }
        recommended_actions = (
            incident.get("recommended_actions")
            or incident.get("incident_intelligence", {}).get(
                "recommended_actions",
                [],
            )
            or remediation.get("recommended_actions", [])
            or intelligence.get("recommended_actions", [])
        )
        affected_platforms = (
            incident.get("platforms")
            or incident.get("affected_platforms")
            or incident.get("incident_intelligence", {}).get(
                "affected_platforms",
                [],
            )
            or intelligence.get("affected_platforms", [])
            or propagation_path
        )
        anomaly_count = self._count_incident_anomalies(
            incident,
            incident_id=incident_id,
        )

        return self._serialize_value(
            {
                "_id": incident.get("_id") or incident_id or "latest",
                "severity": severity,
                "root_cause": root_cause,
                "impact": impact,
                "platforms": affected_platforms,
                "affected_platforms": affected_platforms,
                "propagation_path": propagation_path,
                "timeline": propagation_path,
                "recommended_actions": recommended_actions,
                "predicted_resolution_minutes": (
                    incident.get("predicted_duration_minutes")
                    or duration_prediction.get(
                        "estimated_resolution_minutes"
                    )
                ),
                "total_anomalies": anomaly_count,
                "incident_summary": (
                    incident.get("incident_summary")
                    or intelligence.get("summary")
                ),
            }
        )

    def get_predictions(self):
        return {
            "duration_prediction": self.get_duration_prediction(),
            "impact_prediction": self.get_impact_estimation(),
        }

    def get_incidents(self):
        """
        Retourne une liste unifiée d'incidents :
        1. L'incident batch historique (incidents collection) → toujours inclus
        2. Les incidents realtime reconstruits depuis incident_intelligence
        (un incident par snapshot distinct)
        """
        results = []

        # ── 1. Incidents persistés (batch historique) ─────────────────────────────
        batch_incidents = list(
            self.db.incidents.find().sort("created_at", -1).limit(50)
        )
        for inc in batch_incidents:
            inc = self._enrich_batch_incident(inc)
            results.append(inc)

        # ── 2. Incidents realtime reconstruits ────────────────────────────────────
        snapshots = list(
            self.db.incident_intelligence
            .find({"severity_label": {"$exists": True}})
            .sort("timestamp", -1)
            .limit(100)
        )

        seen_ids = {str(inc.get("_id")) for inc in batch_incidents}

        for snap in snapshots:
            snap_id = str(snap["_id"])
            if snap_id in seen_ids:
                continue
            seen_ids.add(snap_id)

            incident = self._build_incident_from_snapshot(snap)
            if incident:
                results.append(incident)

        # Trier par date décroissante - CORRECTION
        def get_sort_key(x):
            date_val = x.get("created_at") or x.get("timestamp") or ""
            if isinstance(date_val, datetime):
                return date_val.isoformat()
            return str(date_val)
        
        results.sort(key=get_sort_key, reverse=True)

        return self._serialize_value(results[:100])

    def resolve_incident(
        self,
        incident_id,
        resolved_by="operator",
        resolution_note=None,
        resolution_method="manual",
    ):
        resolved_at = datetime.now(timezone.utc)
        update = {
            "$set": {
                "status": "resolved",
                "resolved_at": resolved_at,
                "resolved_by": resolved_by,
                "resolution_note": resolution_note,
                "resolution_method": resolution_method,
                "updated_at": resolved_at,
            }
        }

        for collection_name in ("incidents", "incident_intelligence"):
            document = self._find_incident_like_document(
                collection_name,
                incident_id,
            )
            if not document:
                continue

            self.db[collection_name].update_one(
                {"_id": document["_id"]},
                update,
            )
            updated = self.db[collection_name].find_one(
                {"_id": document["_id"]}
            )

            if collection_name == "incident_intelligence":
                incident = self._build_incident_from_snapshot(updated)
                if incident:
                    return self._serialize_value(incident)

            return self._serialize_value(
                self._enrich_batch_incident(updated)
            )

        raise ValueError(f"Incident {incident_id} not found")

    def get_alerts(self):
        documents = list(
            self.db.alerts.find().sort("created_at", -1).limit(100)
        )

        return self._serialize_value(documents)

    def get_alert_statistics(self):
        severity_breakdown = list(
            self.db.alerts.aggregate(
                [
                    {
                        "$group": {
                            "_id": "$severity",
                            "count": {"$sum": 1},
                        }
                    },
                    {"$sort": {"count": -1}},
                ]
            )
        )
        type_breakdown = list(
            self.db.alerts.aggregate(
                [
                    {
                        "$group": {
                            "_id": "$type",
                            "count": {"$sum": 1},
                        }
                    },
                    {"$sort": {"count": -1}},
                ]
            )
        )

        return self._serialize_value(
            {
                "total_alerts": self.db.alerts.count_documents({}),
                "critical_or_high_alerts": self.db.alerts.count_documents(
                    {"severity": {"$in": ["CRITICAL", "HIGH"]}}
                ),
                "new_alerts": self.db.alerts.count_documents(
                    {"status": "new"}
                ),
                "severity_breakdown": severity_breakdown,
                "type_breakdown": type_breakdown,
            }
        )

    def get_incident_history(self):
        incidents = list(
            self.db.incidents.find().sort("created_at", -1).limit(50)
        )
        snapshots = list(
            self.db.incident_intelligence.find().sort("timestamp", -1).limit(50)
        )

        return self._serialize_value(
            {
                "incidents": incidents,
                "intelligence_snapshots": snapshots,
                "incident_count": len(incidents),
                "snapshot_count": len(snapshots),
            }
        )

    def save_agent_investigation(self, request: dict, report: dict) -> dict:
        """Persist an agent report as an audit snapshot, never as remediation state."""
        document = {
            "incident_id": str(request["incident_id"]),
            "request": self._redact_investigation_history_value(request),
            "report": self._redact_investigation_history_value(report),
            "created_at": datetime.now(timezone.utc),
        }
        result = self.db.agent_investigations.insert_one(document)
        document["_id"] = result.inserted_id
        return self._serialize_value(document)

    def get_agent_investigation_history(self, incident_id: str, limit: int = 20) -> dict:
        limit = max(1, min(int(limit), 100))
        investigations = list(
            self.db.agent_investigations.find(
                {"incident_id": str(incident_id)}
            ).sort("created_at", -1).limit(limit)
        )
        return self._serialize_value(
            {
                "incident_id": str(incident_id),
                "investigations": investigations,
                "count": len(investigations),
            }
        )

    def incident_exists(self, incident_id: str) -> bool:
        """Check only the incident identity; resource ACLs are not modeled yet."""
        object_id = self._to_object_id(incident_id)
        queries = [{"_id": str(incident_id)}]
        if object_id is not None:
            queries.insert(0, {"_id": object_id})
        return self.db.incidents.find_one({"$or": queries}, {"_id": 1}) is not None

    def compare_agent_investigations(
        self, incident_id: str, baseline_id: str, candidate_id: str
    ) -> dict | None:
        baseline = self._find_agent_investigation(incident_id, baseline_id)
        candidate = self._find_agent_investigation(incident_id, candidate_id)
        if not baseline or not candidate:
            return None

        baseline_report = baseline.get("report") if isinstance(baseline.get("report"), dict) else {}
        candidate_report = candidate.get("report") if isinstance(candidate.get("report"), dict) else {}
        missing_data = []
        baseline_confidence = self._finite_number(baseline_report.get("confidence"))
        candidate_confidence = self._finite_number(candidate_report.get("confidence"))
        if baseline_confidence is None or candidate_confidence is None:
            missing_data.append("confidence")
        baseline_root_cause = baseline_report.get("root_cause")
        candidate_root_cause = candidate_report.get("root_cause")
        if baseline_root_cause is None or candidate_root_cause is None:
            missing_data.append("root_cause")
        baseline_evidence_items = self._history_list(baseline_report.get("evidence"))
        candidate_evidence_items = self._history_list(candidate_report.get("evidence"))
        if not isinstance(baseline_report.get("evidence"), list) or not isinstance(candidate_report.get("evidence"), list):
            missing_data.append("evidence")
        baseline_evidence = {
            str(item.get("reference"))
            for item in baseline_evidence_items
            if isinstance(item, dict) and item.get("reference") is not None
        }
        candidate_evidence = {
            str(item.get("reference"))
            for item in candidate_evidence_items
            if isinstance(item, dict) and item.get("reference") is not None
        }
        baseline_degraded_values = self._history_list(baseline_report.get("degraded_components"))
        candidate_degraded_values = self._history_list(candidate_report.get("degraded_components"))
        if not isinstance(baseline_report.get("degraded_components"), list) or not isinstance(candidate_report.get("degraded_components"), list):
            missing_data.append("degraded_components")
        baseline_degraded = {str(item) for item in baseline_degraded_values}
        candidate_degraded = {str(item) for item in candidate_degraded_values}

        return self._serialize_value(
            {
                "incident_id": str(incident_id),
                "baseline": baseline,
                "candidate": candidate,
                "changes": {
                    "confidence_delta": (
                        round(candidate_confidence - baseline_confidence, 4)
                        if baseline_confidence is not None and candidate_confidence is not None
                        else None
                    ),
                    "root_cause_changed": (
                        baseline_root_cause != candidate_root_cause
                        if "root_cause" not in missing_data
                        else None
                    ),
                    "evidence_count_delta": (
                        len(candidate_evidence_items) - len(baseline_evidence_items)
                        if "evidence" not in missing_data
                        else None
                    ),
                    "new_evidence_references": sorted(
                        candidate_evidence - baseline_evidence
                    ),
                    "removed_evidence_references": sorted(
                        baseline_evidence - candidate_evidence
                    ),
                    "new_degraded_components": sorted(
                        candidate_degraded - baseline_degraded
                    ),
                    "recovered_components": sorted(
                        baseline_degraded - candidate_degraded
                    ),
                    "missing_data": missing_data,
                },
            }
        )

    def _find_agent_investigation(
        self, incident_id: str, investigation_id: str
    ) -> dict | None:
        query = {"incident_id": str(incident_id), "_id": self._to_object_id(investigation_id)}
        if query["_id"] is None:
            return None
        return self.db.agent_investigations.find_one(query)

    @staticmethod
    def _history_list(value) -> list:
        return value if isinstance(value, list) else []

    @staticmethod
    def _finite_number(value) -> float | None:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        return number if number == number and abs(number) != float("inf") else None

    def _redact_investigation_history_value(self, value):
        """Avoid retaining credential-like values in read-only audit snapshots."""
        if isinstance(value, dict):
            redacted = {}
            for key, item in value.items():
                normalized_key = str(key).lower().replace("-", "_")
                if normalized_key in {
                    "authorization", "password", "secret", "token", "access_token",
                    "refresh_token", "api_key", "apikey",
                }:
                    redacted[key] = "[REDACTED]"
                else:
                    redacted[key] = self._redact_investigation_history_value(item)
            return redacted
        if isinstance(value, list):
            return [self._redact_investigation_history_value(item) for item in value]
        if isinstance(value, str):
            return re.sub(r"(?i)bearer\s+[a-z0-9._~+/-]+=*", "Bearer [REDACTED]", value)
        return value

    def get_email_alerts(self):
        recipients = [
            recipient.strip()
            for recipient in os.getenv("EMAIL_ALERT_RECIPIENTS", "").split(",")
            if recipient.strip()
        ]
        configured = bool(
            os.getenv("EMAIL_ALERT_SENDER")
            and os.getenv("EMAIL_ALERT_PASSWORD")
            and recipients
        )
        candidate_alerts = list(
            self.db.alerts.find(
                {"severity": {"$in": ["CRITICAL", "HIGH"]}}
            ).sort("created_at", -1).limit(50)
        )

        enriched_alerts = []

        for alert in candidate_alerts:
            alert["email_channel"] = "smtp"
            alert["email_recipients"] = recipients
            alert["email_recipient_count"] = len(recipients)
            alert["email_configured"] = configured
            alert["email_tracking_status"] = (
                "DELIVERY_ELIGIBLE" if configured else "CONFIGURATION_MISSING"
            )
            enriched_alerts.append(alert)

        return self._serialize_value(
            {
                "email_enabled": configured,
                "configured_recipients": recipients,
                "tracked_alerts": enriched_alerts,
                "tracked_count": len(enriched_alerts),
            }
        )

    def get_system_status(self):
        mongo_status = "UP"

        try:
            self.db.command("ping")
        except Exception:
            mongo_status = "DOWN"

        recipients = [
            recipient.strip()
            for recipient in os.getenv("EMAIL_ALERT_RECIPIENTS", "").split(",")
            if recipient.strip()
        ]
        email_configured = bool(
            os.getenv("EMAIL_ALERT_SENDER")
            and os.getenv("EMAIL_ALERT_PASSWORD")
            and recipients
        )
        latest_impact = self._get_latest_impact_prediction()
        latest_duration = self._get_latest_duration_prediction()
        latest_intelligence = self._get_latest_intelligence_snapshot()

        return self._serialize_value(
            {
                "api_status": "UP",
                "mongo_status": mongo_status,
                "email_alerting_status": (
                    "CONFIGURED" if email_configured else "NOT_CONFIGURED"
                ),
                "watched_collections": {
                    "logs": self.db.logs.count_documents({})
                    if "logs" in self.db.list_collection_names()
                    else 0,
                    "anomalies": self.db.anomalies.count_documents({}),
                    "alerts": self.db.alerts.count_documents({}),
                    "incidents": self.db.incidents.count_documents({}),
                },
                "latest_incident_severity": (
                    latest_intelligence.get("severity_label")
                    or latest_impact.get("severity_label")
                ),
                "latest_customer_impact": latest_impact.get(
                    "customer_impact"
                ),
                "latest_estimated_resolution_minutes": latest_duration.get(
                    "estimated_resolution_minutes"
                ),
                "checked_at": datetime.now().isoformat(),
            }
        )

    def get_threshold_info(
        self,
        platform,
        hour=None,
        weekday=None,
        log_volume=None,
    ):
        now = datetime.now()
        report = self.threshold_engine.get_threshold_report(
            platform=platform,
            hour=now.hour if hour is None else int(hour),
            weekday=(
                now.weekday()
                if weekday is None
                else int(weekday)
            ),
            log_volume=(
                None
                if log_volume is None
                else int(log_volume)
            ),
        )

        return self._serialize_value(report)

    def get_model_drift_overview(self):
        detector = self._get_drift_detector()
        latest_report = detector.get_latest_report()
        reference = detector.get_reference_summary()
        history = detector.get_drift_trend()
        status = "UNKNOWN"

        if latest_report:
            status = latest_report.get("drift_severity", "UNKNOWN")
        elif reference.get("available"):
            status = "BASELINE_ONLY"

        return self._serialize_value(
            {
                "reference": reference,
                "latest_report": latest_report,
                "history_count": len(history),
                "status": status,
            }
        )

    def get_latest_model_drift(self):
        detector = self._get_drift_detector()
        latest_report = detector.get_latest_report()

        if latest_report:
            return self._serialize_value(latest_report)

        reference = detector.get_reference_summary()

        if reference.get("available"):
            return {
                "message": "Reference available but no drift analysis available yet",
                "drift_severity": "BASELINE_ONLY",
            }

        return {
            "message": "No drift analysis available yet",
            "drift_severity": "UNKNOWN",
        }

    def get_model_drift_history(self):
        detector = self._get_drift_detector()
        history = detector.get_drift_trend()

        return self._serialize_value(history)

    def analyze_model_drift(
        self,
        scores,
        texts=None,
        window_label=None,
    ):
        detector = self._get_drift_detector()
        report = detector.run_full_drift_analysis(
            current_scores=scores,
            current_texts=texts,
            window_label=window_label,
        )

        return self._serialize_value(report)

    def set_model_drift_reference(
        self,
        scores,
        texts=None,
        anomaly_rate=0.05,
    ):
        detector = self._get_drift_detector()
        reference = detector.set_reference(
            scores=scores,
            texts=texts,
            anomaly_rate=anomaly_rate,
        )

        return self._serialize_value(
            {
                "message": "Drift reference updated",
                "n_samples": reference["n_samples"],
                "mean": reference["mean"],
                "anomaly_rate": reference["anomaly_rate"],
                "timestamp": reference["timestamp"],
            }
        )

    # ═══════════════════════════════════════════════════════════════════════════
    # MÉTHODES PRIVÉES DE RÉCUPÉRATION DE DONNÉES
    # ═══════════════════════════════════════════════════════════════════════════

    def _get_latest_severity(self):
        intelligence = self._get_latest_intelligence_snapshot()

        if intelligence:
            return intelligence.get("severity_label")

        impact = self._get_latest_impact_prediction()

        if impact:
            return impact.get("severity_label")

        return None

    def _get_latest_intelligence_snapshot(self):
        document = self.db.incident_intelligence.find_one(
            {
                "$or": [
                    {"summary": {"$exists": True}},
                    {"timeline.0": {"$exists": True}},
                    {"top_root_causes.0": {"$exists": True}},
                ]
            },
            sort=[("timestamp", -1)],
        )

        return document or {}

    def _get_latest_impact_prediction(self):
        document = self.db.incident_impact_predictions.find_one(
            sort=[("timestamp", -1)]
        )

        return document or {}

    def _get_latest_duration_prediction(self):
        document = self.db.incident_duration_predictions.find_one(
            sort=[("timestamp", -1)]
        )

        return document or {}

    def _get_latest_evolution_prediction(self):
        document = self.db.incident_evolution.find_one(
            sort=[("timestamp", -1)]
        )

        return document or {}

    def _get_latest_auto_remediation(self):
        document = self.db.auto_remediation.find_one(
            sort=[("timestamp", -1)]
        )

        return document or {}

    def _get_latest_similar_incidents(self):
        document = self.db.similar_incidents.find_one(
            sort=[("timestamp", -1)]
        )

        return document or {}

    def _get_incident_document(self, incident_id=None):
        if incident_id:
            object_id = self._to_object_id(incident_id)

            if object_id is not None:
                document = self.db.incidents.find_one({"_id": object_id})
                if document:
                    return document

            document = self.db.incidents.find_one({"_id": incident_id})
            if document:
                return document

        document = self.db.incidents.find_one(sort=[("created_at", -1)])
        return document or {}

    def _count_incident_anomalies(self, incident, incident_id=None):
        anomaly_ids = incident.get("anomaly_ids", [])
        if anomaly_ids:
            return len(anomaly_ids)

        query_values = []
        if incident_id is not None:
            query_values.append(incident_id)

        incident_object_id = incident.get("_id")
        if incident_object_id is not None:
            query_values.append(incident_object_id)
            query_values.append(str(incident_object_id))

        if not query_values:
            return 0

        try:
            return self.db.anomalies.count_documents(
                {"incident_id": {"$in": list(dict.fromkeys(query_values))}}
            )
        except Exception:
            return 0

    # ═══════════════════════════════════════════════════════════════════════════
    # MÉTHODES D'ENRICHISSEMENT DES INCIDENTS (PATCH)
    # ═══════════════════════════════════════════════════════════════════════════

    def _build_incident_from_snapshot(self, snap: dict) -> dict | None:
        """
        Reconstruit un incident complet depuis un snapshot incident_intelligence.
        Cherche les données impact/duration/evolution/remediation correspondantes
        par fenêtre temporelle (±30s autour du timestamp du snapshot).
        """
        snap_ts = snap.get("timestamp")
        if not snap_ts:
            return None

        # Fenêtre temporelle pour relier les collections
        if isinstance(snap_ts, str):
            try:
                snap_ts = datetime.fromisoformat(snap_ts)
            except Exception:
                return None

        window_start = snap_ts - timedelta(seconds=30)
        window_end   = snap_ts + timedelta(seconds=30)
        ts_filter    = {"timestamp": {"$gte": window_start, "$lte": window_end}}

        # Impact
        impact_doc = self.db.incident_impact_predictions.find_one(
            ts_filter, sort=[("timestamp", -1)]
        ) or {}

        # Duration
        duration_doc = self.db.incident_duration_predictions.find_one(
            ts_filter, sort=[("timestamp", -1)]
        ) or {}

        # Evolution
        evolution_doc = self.db.incident_evolution.find_one(
            ts_filter, sort=[("timestamp", -1)]
        ) or {}

        # Remediation
        remediation_doc = self.db.auto_remediation.find_one(
            ts_filter, sort=[("timestamp", -1)]
        ) or {}

        # Plateformes
        platforms = (
            snap.get("affected_platforms")
            or impact_doc.get("affected_platforms")
            or impact_doc.get("propagation_path")
            or evolution_doc.get("propagation_path")
            or []
        )

        # Cascade timeline
        propagation_path = (
            impact_doc.get("propagation_path")
            or evolution_doc.get("propagation_path")
            or snap.get("timeline", [])
            or platforms
        )

        # Root causes
        top_root_causes = (
            duration_doc.get("top_root_causes")
            or snap.get("top_root_causes")
            or []
        )
        root_cause_keywords = evolution_doc.get("root_cause_keywords", [])

        # Construire root_cause compatible avec l'interface Angular
        root_causes_merged = top_root_causes or [[kw, 1.0] for kw in root_cause_keywords]

        # Severity
        severity_label = (
            snap.get("severity_label")
            or impact_doc.get("severity_label")
            or duration_doc.get("severity")
            or "MEDIUM"
        )

        # Anomaly count
        anomaly_count = (
            impact_doc.get("anomaly_count")
            or duration_doc.get("anomaly_count")
            or snap.get("anomaly_count")
            or 0
        )

        # Cluster count
        cluster_count = (
            impact_doc.get("cluster_count")
            or duration_doc.get("cluster_count")
            or snap.get("cluster_count")
            or 1
        )

        # Causal links
        causal_links = snap.get("causal_relation_count", 0)

        # Spread score
        spread_score = (
            snap.get("incident_spread_score")
            or snap.get("spread_score")
            or impact_doc.get("spread_score")
            or 0
        )

        # Recommendations
        recommended_actions = (
            snap.get("recommended_actions")
            or remediation_doc.get("recommended_actions")
            or []
        )

        status = snap.get("status") or "open"
        resolved_at = snap.get("resolved_at")

        return {
            # Identifiants
            "_id":                  str(snap["_id"]),
            "source":               "realtime",

            # Timestamps
            "created_at":           snap_ts.isoformat() if hasattr(snap_ts, "isoformat") else str(snap_ts),
            "timestamp":            snap_ts.isoformat() if hasattr(snap_ts, "isoformat") else str(snap_ts),

            # Status
            "status":               status,
            "resolved_at":          resolved_at,
            "resolved_by":          snap.get("resolved_by"),
            "resolution_note":      snap.get("resolution_note"),
            "resolution_method":    snap.get("resolution_method"),

            # Volumes
            "total_anomalies":      anomaly_count,
            "total_logs":           anomaly_count,
            "clusters":             cluster_count,
            "causal_links":         causal_links,

            # Plateformes
            "platforms":            platforms,
            "affected_platforms":   platforms,

            # Severity (compatible avec Angular SeverityBadgeComponent)
            "severity": {
                "label":            severity_label,
                "score":            snap.get("severity_score", 0),
                "recommendations":  recommended_actions[:3],
            },

            # Root cause (compatible avec Angular RcaPanelComponent)
            "root_cause": {
                "root_causes":          root_causes_merged[:8],
                "count":                sum(int(r[1]) for r in root_causes_merged if isinstance(r, (list, tuple)) and len(r) > 1),
                "root_cause_keywords":  root_cause_keywords,
                "root_platform_analysis": {
                    "root_platform": propagation_path[0] if propagation_path else "",
                    "confidence":    "MEDIUM",
                    "candidates": [
                        {
                            "platform":         p,
                            "criticality":      "HIGH" if i == 0 else "MEDIUM",
                            "dependency_count": len(propagation_path) - i,
                            "known_failures":   root_cause_keywords[:2],
                            "recovery_minutes": 15 + i * 5,
                        }
                        for i, p in enumerate(propagation_path[:4])
                    ],
                },
                "cascade_validation": {
                    "cascade":         propagation_path,
                    "coherence_score": 0.75,
                    "verdict":         "CASCADE PARTIELLE VALIDÉE",
                    "valid_steps":     max(len(propagation_path) - 1, 1),
                    "invalid_steps":   0,
                    "steps": [
                        {
                            "step":   f"{propagation_path[i]} → {propagation_path[i+1]}" if i+1 < len(propagation_path) else propagation_path[i],
                            "valid":  True,
                            "reason": f"Lien causal détecté ({root_cause_keywords[0] if root_cause_keywords else 'fail'})",
                        }
                        for i in range(len(propagation_path))
                    ],
                },
            },

            # Timeline (compatible avec CascadeTimelineComponent)
            "timeline": {
                "timeline":         propagation_path,
                "summary":          snap.get("summary", f"Cascade {severity_label} sur {len(platforms)} plateforme(s)"),
                "topology_aware":   snap.get("topology_aware", False),
            },

            # Impact (compatible avec Angular impact display)
            "impact": {
                "affected_platforms":       platforms,
                "severity":                 severity_label,
                "sms_delivery_degradation": snap.get("sms_delivery_degradation") or impact_doc.get("sms_delivery_degradation", "LOW"),
                "propagation_risk":         snap.get("propagation_risk") or impact_doc.get("propagation_risk", "MEDIUM"),
                "customer_impact":          snap.get("customer_impact") or impact_doc.get("customer_impact", "MEDIUM"),
                "spread_score":             spread_score,
            },

            # Intelligence snapshot (pour ExplainPanel + Copilot)
            "incident_intelligence": {
                "summary":                  snap.get("summary", ""),
                "timeline":                 propagation_path,
                "topology_aware":           snap.get("topology_aware", False),
                "severity_label":           severity_label,
                "severity_score":           snap.get("severity_score", 0),
                "severity_reasons":         snap.get("severity_reasons", []),
                "recommended_actions":      recommended_actions,
                "affected_platforms":       platforms,
                "sms_delivery_degradation": snap.get("sms_delivery_degradation", "LOW"),
                "propagation_risk":         snap.get("propagation_risk", "MEDIUM"),
                "cluster_count":            cluster_count,
                "causal_relation_count":    causal_links,
                "top_root_causes":          root_causes_merged[:8],
            },

            # Duration
            "predicted_duration_minutes":   duration_doc.get("estimated_resolution_minutes"),
            "recovery_complexity":          duration_doc.get("recovery_complexity"),
            "incident_stability":           duration_doc.get("incident_stability"),

            # Evolution
            "will_spread_more":             evolution_doc.get("will_spread_more", False),
            "next_possible_platform":       evolution_doc.get("next_possible_platform"),
            "risk_factors":                 evolution_doc.get("risk_factors", []),

            # Remediation
            "recommended_actions":          recommended_actions,

            # Alerts count
            "alert_count": self.db.alerts.count_documents({
                "metadata.dedup_fingerprint": {"$exists": True},
                "created_at": {
                    "$gte": snap_ts - timedelta(seconds=30),
                    "$lte": snap_ts + timedelta(seconds=30),
                }
            }),
        }

    def _enrich_batch_incident(self, inc: dict) -> dict:
        """
        Enrichit l'incident batch historique avec les champs attendus par Angular.
        L'incident batch a une structure différente (top_root_causes au niveau racine,
        pas de 'severity' dict, etc.)
        """
        # Normaliser severity en dict si c'est une string
        severity = inc.get("severity")
        if isinstance(severity, str):
            inc["severity"] = {"label": severity, "score": 0, "recommendations": []}
        elif not isinstance(severity, dict):
            # Lire depuis severity_label
            label = inc.get("severity_label", "MEDIUM")
            inc["severity"] = {
                "label":           label,
                "score":           inc.get("severity_score", 0),
                "recommendations": inc.get("recommended_actions", [])[:3],
            }

        # Plateformes
        if not inc.get("platforms"):
            inc["platforms"] = (
                inc.get("affected_platforms")
                or []
            )

        # Root cause
        if not inc.get("root_cause"):
            top_causes = inc.get("top_root_causes", [])
            path       = inc.get("timeline", inc.get("propagation_path", []))
            inc["root_cause"] = {
                "root_causes": top_causes[:8],
                "count":       int(top_causes[0][1]) if top_causes and isinstance(top_causes[0], (list, tuple)) else 0,
                "root_platform_analysis": {
                    "root_platform": inc.get("root_platform", path[0] if path else ""),
                    "confidence":    "HIGH",
                    "candidates":    [{"platform": p, "criticality": "CRITICAL", "dependency_count": 2,
                                       "known_failures": [], "recovery_minutes": 20}
                                      for p in inc.get("affected_platforms", [])[:4]],
                },
                "cascade_validation": {
                    "cascade":         path,
                    "coherence_score": 0.85,
                    "verdict":         "CASCADE TOPOLOGIQUE VALIDÉE",
                    "valid_steps":     max(len(path) - 1, 1),
                    "invalid_steps":   0,
                    "steps":           [{"step": p, "valid": True, "reason": "Lien causal confirmé"} for p in path],
                },
            }

        # Timeline
        if not inc.get("timeline"):
            path = inc.get("propagation_path", inc.get("affected_platforms", []))
            inc["timeline"] = {
                "timeline":     path,
                "summary":      inc.get("summary", ""),
                "topology_aware": True,
            }
        elif isinstance(inc.get("timeline"), list):
            inc["timeline"] = {"timeline": inc["timeline"], "summary": "", "topology_aware": False}

        # Impact
        if not inc.get("impact") or isinstance(inc.get("impact"), str):
            inc["impact"] = {
                "affected_platforms":       inc.get("affected_platforms", []),
                "severity":                 inc.get("severity_label", "MEDIUM"),
                "sms_delivery_degradation": inc.get("sms_delivery_degradation", "LOW"),
                "propagation_risk":         inc.get("propagation_risk", "MEDIUM"),
                "customer_impact":          inc.get("customer_impact", "MEDIUM"),
                "spread_score":             inc.get("spread_score", 0),
            }

        # Counts
        inc.setdefault("total_anomalies", inc.get("total_logs", 0))
        inc.setdefault("clusters",        inc.get("cluster_count", 0))
        inc.setdefault("causal_links",    inc.get("causal_relation_count", 0))
        inc.setdefault("status",          "open")
        inc.setdefault("resolved_at",     None)
        inc.setdefault("source",          "batch")

        # Intelligence snapshot
        if not inc.get("incident_intelligence"):
            inc["incident_intelligence"] = {
                "summary":                  inc.get("summary", ""),
                "timeline":                 inc.get("affected_platforms", []),
                "topology_aware":           True,
                "severity_label":           inc.get("severity_label", "MEDIUM"),
                "severity_score":           inc.get("severity_score", 0),
                "severity_reasons":         inc.get("severity_reasons", []),
                "recommended_actions":      inc.get("recommended_actions", []),
                "affected_platforms":       inc.get("affected_platforms", []),
                "sms_delivery_degradation": inc.get("sms_delivery_degradation", "LOW"),
                "propagation_risk":         inc.get("propagation_risk", "MEDIUM"),
                "cluster_count":            inc.get("cluster_count", 0),
                "causal_relation_count":    inc.get("causal_relation_count", 0),
                "top_root_causes":          inc.get("top_root_causes", []),
            }

        return inc

    def save_incident(self, result: dict, impact: dict | None = None) -> str | None:
        """
        Sauvegarde un incident realtime dans la collection 'incidents'.
        À appeler depuis _finalize_orchestration_result() dans l'orchestrateur.

        Retourne l'_id inséré (str) ou None si rien à sauvegarder.
        """
        telecom_rca       = result.get("telecom_rca", {})
        propagation_path  = telecom_rca.get("propagation_path", [])
        root_causes       = result.get("rca", {}).get("root_causes", [])
        cluster_count_val = result.get("snapshot_cluster_count")

        if cluster_count_val is None:
            clusters_raw = result.get("clusters", [])
            if isinstance(clusters_raw, dict):
                cluster_count_val = len(clusters_raw)
            elif isinstance(clusters_raw, list):
                ids = {item.get("cluster_id") for item in clusters_raw
                       if isinstance(item, dict) and item.get("cluster_id") is not None}
                cluster_count_val = len(ids)
            else:
                cluster_count_val = 0

        severity = (
            (impact or {}).get("severity_label")
            or result.get("snapshot_severity")
            or "MEDIUM"
        )

        doc = {
            "source":              "realtime",
            "status":              "open",
            "created_at":          datetime.now(timezone.utc),

            "total_anomalies":     len(result.get("anomalies", [])),
            "clusters":            cluster_count_val,
            "causal_links":        len(propagation_path),
            "platforms":           list(dict.fromkeys(propagation_path)),
            "affected_platforms":  list(dict.fromkeys(propagation_path)),

            "severity": {
                "label":           severity,
                "score":           0,
                "recommendations": result.get("snapshot_recommendations", []),
            },

            "root_cause": {
                "root_causes":          root_causes[:8],
                "count":                len(root_causes),
                "root_platform_analysis": {
                    "root_platform": propagation_path[0] if propagation_path else "",
                    "confidence":    "MEDIUM",
                    "candidates":    [{"platform": p, "criticality": "HIGH",
                                       "dependency_count": 2, "known_failures": [],
                                       "recovery_minutes": 15}
                                      for p in propagation_path[:4]],
                },
            },

            "timeline": {
                "timeline":      propagation_path,
                "summary":       result.get("snapshot_summary", ""),
                "topology_aware": False,
            },

            "impact": {
                "affected_platforms":       propagation_path,
                "severity":                 severity,
                "sms_delivery_degradation": (impact or {}).get("sms_delivery_degradation", "LOW"),
                "propagation_risk":         (impact or {}).get("propagation_risk", "LOW"),
                "customer_impact":          (impact or {}).get("customer_impact", "LOW"),
                "spread_score":             (impact or {}).get("spread_score", 0),
            },

            "recommended_actions": result.get("snapshot_recommendations", []),
        }

        insert_result = self.db.incidents.insert_one(doc)
        return str(insert_result.inserted_id)

    # ═══════════════════════════════════════════════════════════════════════════
    # MÉTHODES PRIVÉES UTILITAIRES
    # ═══════════════════════════════════════════════════════════════════════════

    def _get_faiss_engine(self):
        if self._faiss_engine is None:
            self._faiss_engine = FaissSimilarityEngine()

        return self._faiss_engine

    def _get_embedding_engine(self):
        if self._embedding_engine is None:
            self._embedding_engine = EmbeddingEngine()

        return self._embedding_engine

    def _get_drift_detector(self):
        if self._drift_detector is None:
            self._drift_detector = ModelDriftDetector()

        return self._drift_detector

    def _to_object_id(self, value):
        try:
            return ObjectId(value)
        except Exception:
            return None

    def _find_incident_like_document(self, collection_name, incident_id):
        collection = self.db[collection_name]
        object_id = self._to_object_id(incident_id)

        if object_id is not None:
            document = collection.find_one({"_id": object_id})
            if document:
                return document

        return collection.find_one({"_id": incident_id})

    def _select_action(self, platform, root_cause, recommendations):
        if not recommendations:
            return None

        normalized_platform = (platform or "").upper()
        normalized_root_causes = []

        if isinstance(root_cause, dict):
            root_cause = root_cause.get("root_causes", [])

        if isinstance(root_cause, (list, tuple)):
            items = root_cause
        else:
            items = [root_cause]

        for item in items:
            if isinstance(item, (list, tuple)) and item:
                keyword = item[0]
            else:
                keyword = item

            text = str(keyword or "").strip().lower()

            if text:
                normalized_root_causes.append(text)

        normalized_root_causes = list(dict.fromkeys(normalized_root_causes))

        priority_terms = [
            "queue",
            "timeout",
            "refused",
            "disconnect",
            "connection failed",
            "fail",
            "retry",
            "error",
            "drop",
        ]

        for term in priority_terms:
            if not any(term in keyword for keyword in normalized_root_causes):
                continue

            for recommendation in recommendations:
                recommendation_text = str(recommendation)
                recommendation_lower = recommendation_text.lower()

                if term in recommendation_lower:
                    return recommendation_text

        for recommendation in recommendations:
            recommendation_text = str(recommendation)
            recommendation_upper = recommendation_text.upper()
            recommendation_lower = recommendation_text.lower()

            if normalized_platform and normalized_platform in recommendation_upper:
                return recommendation_text

            if "SMPP" in normalized_platform and "SMPP" in recommendation_upper:
                return recommendation_text

        return str(recommendations[0])

    def _get_propagation_stage(self, platform, propagation_path):
        if not propagation_path or not platform:
            return None

        normalized_platform = str(platform).upper()

        for index, item in enumerate(propagation_path, start=1):
            if str(item).upper() == normalized_platform:
                return index

        return None

    def _serialize_value(self, value):
        if isinstance(value, dict):
            return {
                key: self._serialize_value(item)
                for key, item in value.items()
            }

        if isinstance(value, list):
            return [self._serialize_value(item) for item in value]

        if isinstance(value, ObjectId):
            return str(value)

        if isinstance(value, datetime):
            return value.isoformat()

        return value
