import os
from pymongo import MongoClient


class IncidentDurationService:

    def __init__(self):

        mongo_uri = os.getenv(
            "MONGO_URI",
            "mongodb://localhost:27017/",
        )

        database_name = os.getenv(
            "DATABASE_NAME",
            "telecom_logs",
        )

        collection_name = os.getenv(
            "INCIDENT_DURATION_COLLECTION",
            "incident_duration_predictions",
        )

        client = MongoClient(mongo_uri)

        self.collection = client[database_name][collection_name]

    def save(self, prediction):

        result = self.collection.insert_one(prediction)

        return result.inserted_id