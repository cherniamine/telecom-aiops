from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import os


class IncidentImpactService:

    def __init__(self):
        load_dotenv()

        mongo_uri = os.getenv(
            "MONGO_URI",
            "mongodb://localhost:27017/"
        )

        database_name = os.getenv(
            "DATABASE_NAME",
            "telecom_logs"
        )

        client = MongoClient(mongo_uri)

        self.collection = client[
            database_name
        ][
            "incident_impact_predictions"
        ]

    def save(self, impact_document):

        impact_document["timestamp"] = datetime.utcnow()

        return self.collection.insert_one(
            impact_document
        )