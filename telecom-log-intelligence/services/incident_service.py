from pymongo import MongoClient
from datetime import datetime

client = MongoClient("mongodb://localhost:27017/")
db = client["telecom_logs"]

class IncidentService:

    def create_incident(self, anomaly_ids, platform):

        doc = {
            "anomalies": anomaly_ids,
            "platform": platform,
            "root_cause": "To be analyzed",
            "impact": "Unknown",
            "status": "open",
            "created_at": datetime.utcnow(),
            "resolved_at": None
        }

        return db.incidents.insert_one(doc)