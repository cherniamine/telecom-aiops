import time

from pymongo import ASCENDING, DESCENDING, MongoClient


class MongoStreamListener:

    def __init__(self, mongo_uri, db_name, collection, poll_interval_seconds=2):

        self.client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
        )

        self.collection = self.client[db_name][collection]
        self.poll_interval_seconds = poll_interval_seconds

    def listen(self):

        print("Listening MongoDB Change Stream...")

        try:
            self.client.admin.command("ping")
        except Exception as error:
            print("MongoDB connection error:", str(error))
            print("Realtime pipeline stopped. Check MongoDB URI and availability.")
            return

        pipeline = []

        try:
            with self.collection.watch(pipeline) as stream:
                for change in stream:
                    if change.get("operationType") == "insert":
                        yield change
            return
        except Exception as error:
            if self._supports_polling_fallback(error):
                print("Change streams unavailable on this MongoDB instance.")
                print("Falling back to polling mode for new inserts...")
                yield from self._poll_for_inserts()
                return

            print("MongoDB Change Stream error:", str(error))
            print(
                "Realtime pipeline stopped. Ensure MongoDB is reachable and change streams are enabled."
            )

    def _poll_for_inserts(self):
        last_seen_id = self._get_latest_id()

        while True:
            query = {}

            if last_seen_id is not None:
                query["_id"] = {"$gt": last_seen_id}

            new_documents = list(
                self.collection.find(query).sort("_id", ASCENDING)
            )

            for document in new_documents:
                last_seen_id = document.get("_id", last_seen_id)
                yield {
                    "operationType": "insert",
                    "fullDocument": document,
                }

            time.sleep(self.poll_interval_seconds)

    def _get_latest_id(self):
        latest_document = self.collection.find_one(sort=[("_id", DESCENDING)])

        if not latest_document:
            return None

        return latest_document.get("_id")

    def _supports_polling_fallback(self, error):
        message = str(error).lower()

        return (
            "only supported on replica sets" in message
            or "changestream" in message
        )
