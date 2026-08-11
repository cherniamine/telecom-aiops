from pymongo import MongoClient
from datetime import datetime


class IncidentsMaster:

    def __init__(self,
                 mongo_uri="mongodb://localhost:27017/",
                 db_name="telecom_logs",
                 collection="incidents"):

        self.client = MongoClient(mongo_uri)
        self.collection = self.client[db_name][collection]


    # -----------------------------------------
    # CHECK DUPLICATE INCIDENT
    # -----------------------------------------

    def is_duplicate(self, report):

        root_causes = report.get("root_cause", {})

        latest = self.collection.find_one(
            {"root_cause": root_causes},
            sort=[("_id", -1)]
        )

        if latest:
            return True

        return False


    # -----------------------------------------
    # SAVE INCIDENT
    # -----------------------------------------

    def save_incident(self, report, source="unknown"):

        if not report:
            print("⚠️ Empty incident report skipped")
            return None

        if self.is_duplicate(report):

            print("⚠️ Duplicate incident detected — skipped")

            return None


        report["created_at"] = datetime.utcnow()

        report["source"] = source


        result = self.collection.insert_one(report)

        print("✅ Incident saved (master control)")

        return result.inserted_id


    # -----------------------------------------
    # UPDATE INCIDENT STATUS
    # -----------------------------------------

    def update_status(self, incident_id, status):

        self.collection.update_one(

            {"_id": incident_id},

            {
                "$set": {
                    "status": status,
                    "updated_at": datetime.utcnow()
                }
            }

        )

        print("🔄 Incident status updated:", status)


    # -----------------------------------------
    # LIST INCIDENTS
    # -----------------------------------------

    def list_recent(self, limit=10):

        return list(

            self.collection
            .find()
            .sort("_id", -1)
            .limit(limit)

        )