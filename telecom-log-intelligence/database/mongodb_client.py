import os

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure


load_dotenv()


class MongoDBClient:

    def __init__(self):
        try:
            mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
            db_name = os.getenv("DATABASE_NAME", "telecom_logs")

            print(f"Connecting to MongoDB: {mongo_uri}")

            self.client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=5000,
            )
            self.client.admin.command("ping")
            self.db = self.client[db_name]

            print(f"MongoDB connected successfully to {db_name}")

        except ConnectionFailure as error:
            print(f"MongoDB connection failed: {error}")
            raise

    def get_database(self):
        return self.db

    def get_collection(self, name):
        return self.db[name]

    def close(self):
        self.client.close()
