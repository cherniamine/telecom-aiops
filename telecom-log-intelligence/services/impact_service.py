from pymongo import MongoClient
import os


class ImpactService:

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
            "INCIDENT_INTELLIGENCE_COLLECTION",
            "incident_intelligence",
        )

        client = MongoClient(mongo_uri)

        self.collection = client[database_name][collection_name]

    def save(self, intelligence):

        result = self.collection.insert_one(intelligence)

        return result.inserted_id

