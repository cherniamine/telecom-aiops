from pymongo import MongoClient
from datetime import datetime

client = MongoClient("mongodb://localhost:27017/")
db = client["telecom_logs"]

def save_anomaly(log, result):

    doc = {
        "log_id": log.get("_id"),
        "timestamp": log.get("timestamp"),
        "platform": log.get("platform"),
        "message": log.get("message"),

        "features": {
            "hour": log.get("hour"),
            "weekday": log.get("weekday"),
            "is_error": int("error" in log.get("message", "").lower())
        },

        "model": {
            "score": result["anomaly_score"],
            "threshold": -0.3,
            "model": "hybrid_if_lof"
        },

        "rca": None,
        "action": None,

        # Fields to be filled by orchestration
        "incident_id": None,
        "severity": None,
        "impact": None,
        "propagation_stage": None,
        "root_cause": None,
        "recommended_action": None,

        "status": "open",
        "created_at": datetime.utcnow()
    }

    insert_result = db.anomalies.insert_one(doc)
    return insert_result.inserted_id