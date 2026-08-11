import os
from datetime import datetime

from dotenv import load_dotenv
from pymongo import MongoClient


class IncidentReportSaver:

    def __init__(self):
        load_dotenv()

        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        database_name = os.getenv("DATABASE_NAME", "telecom_logs")
        report_collection_name = os.getenv(
            "INCIDENT_REPORT_COLLECTION",
            "incidents",
        )
        intelligence_collection_name = os.getenv(
            "INCIDENT_INTELLIGENCE_COLLECTION",
            "incident_intelligence",
        )
        anomaly_collection_name = os.getenv(
            "ANOMALY_COLLECTION",
            "anomalies",
        )

        self.client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
        )
        self.db = self.client[database_name]
        self.report_collection = self.db[report_collection_name]
        self.intelligence_collection = self.db[intelligence_collection_name]
        self.anomaly_collection = self.db[anomaly_collection_name]

    def save_report(self, results):
        report_document = self._build_report_document(results)
        intelligence_document = self._build_intelligence_document(results)
        saved_ids = {
            "incident_id": None,
            "incident_intelligence_id": None,
        }

        try:
            insert_result = self.report_collection.insert_one(report_document)
            saved_ids["incident_id"] = insert_result.inserted_id
            print("Incident report saved to MongoDB")
        except Exception as error:
            print(f"Incident report was not saved to MongoDB: {error}")

        try:
            insert_result = self.intelligence_collection.insert_one(
                intelligence_document
            )
            saved_ids["incident_intelligence_id"] = insert_result.inserted_id
            print("Incident intelligence saved to MongoDB")
        except Exception as error:
            print(f"Incident intelligence was not saved to MongoDB: {error}")

        return saved_ids

    def save_anomalies(
        self,
        anomaly_documents,
        incident_id=None,
        chunk_size=1000,
    ):
        if not anomaly_documents:
            print("No anomalies to save to MongoDB")
            return 0

        inserted_count = 0

        for start in range(0, len(anomaly_documents), chunk_size):
            chunk = anomaly_documents[start:start + chunk_size]
            prepared_chunk = []

            for document in chunk:
                prepared_document = self._sanitize_for_mongo(document)
                prepared_document["created_at"] = datetime.utcnow()

                if incident_id is not None:
                    prepared_document["incident_id"] = incident_id

                prepared_chunk.append(prepared_document)

            try:
                self.anomaly_collection.insert_many(
                    prepared_chunk,
                    ordered=False,
                )
                inserted_count += len(prepared_chunk)
            except Exception as error:
                print(f"Anomaly batch was not saved to MongoDB: {error}")

        if inserted_count:
            print(f"Saved {inserted_count} anomalies to MongoDB")

        return inserted_count

    def _build_report_document(self, results):
        impact = results.get("impact", {})

        return {
            "created_at": datetime.utcnow(),
            "status": "open",
            "resolved_at": None,
            "total_logs": results["total_logs"],
            "total_anomalies": results["total_anomalies"],
            "clusters": len(results["clusters"]),
            "causal_links": len(results["causal_links"]),
            "platforms": impact.get("affected_platforms", []),
            "root_cause": results["root_cause"],
            "timeline": results["incident_timeline"],
            "impact": impact,
            "severity": results["severity"],
            "incident_intelligence": results.get("incident_intelligence"),
        }

    def _build_intelligence_document(self, results):
        incident_intelligence = results.get("incident_intelligence")

        if incident_intelligence is not None:
            document = dict(incident_intelligence)
        else:
            impact = results.get("impact", {})
            document = {
                "summary": results["incident_timeline"]["summary"],
                "timeline": results["incident_timeline"].get("timeline", []),
                "severity_label": results["severity"]["label"],
                "severity_score": results["severity"]["score"],
                "severity_reasons": results["severity"]["explanation"].get(
                    "reasons",
                    [],
                ),
                "recommended_actions": results["severity"]["recommendations"],
                "affected_platforms": impact.get("affected_platforms", []),
                "sms_delivery_degradation": impact.get(
                    "sms_delivery_degradation"
                ),
                "propagation_risk": impact.get("propagation_risk"),
                "top_root_causes": results["root_cause"].get(
                    "root_causes",
                    [],
                )[:10],
            }

        document["timestamp"] = datetime.utcnow()
        document["total_logs"] = results["total_logs"]
        document["total_anomalies"] = results["total_anomalies"]

        return document

    def _sanitize_for_mongo(self, value):
        if isinstance(value, dict):
            return {
                key: self._sanitize_for_mongo(item)
                for key, item in value.items()
            }

        if isinstance(value, list):
            return [self._sanitize_for_mongo(item) for item in value]

        if isinstance(value, tuple):
            return [self._sanitize_for_mongo(item) for item in value]

        if hasattr(value, "to_pydatetime"):
            try:
                return value.to_pydatetime()
            except Exception:
                return None

        if hasattr(value, "item"):
            try:
                return value.item()
            except Exception:
                return value

        return value
