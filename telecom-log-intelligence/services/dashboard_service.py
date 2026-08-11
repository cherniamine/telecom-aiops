from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017/")
db = client["telecom_logs"]

class DashboardService:

    def get_stats(self):

        return {
            "total_logs": db.log_features.count_documents({}),
            "total_anomalies": db.anomalies.count_documents({}),
            "total_incidents": db.incidents.count_documents({})
        }

    def anomalies_by_platform(self):

        return list(db.anomalies.aggregate([
            {
                "$group": {
                    "_id": "$platform",
                    "count": {"$sum": 1}
                }
            }
        ]))

    def recent_anomalies(self):

        return list(db.anomalies.find().sort("created_at", -1).limit(50))