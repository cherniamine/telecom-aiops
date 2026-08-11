from pymongo import MongoClient, InsertOne
from analysis.feature_engineering.feature_builder import FeatureBuilder


class FeatureEngineering:

    def __init__(self):

        self.client = MongoClient("mongodb://localhost:27017")

        self.db = self.client["telecom_logs"]

        self.feature_collection = self.db["log_features"]

        self.builder = FeatureBuilder()

        self.feature_collection.create_index("log_id", unique=True)

    # ==================================
    # PROCESS COLLECTION
    # ==================================

    def process_collection(self, collection_name):

        print(f"\n⚙️ Processing {collection_name}")

        collection = self.db[collection_name]

        operations = []

        processed = 0

        cursor = collection.find({}, batch_size=5000)

        for log in cursor:

            features = self.builder.build_features(log)

            if not features:
                continue

            features["log_id"] = str(log["_id"])

            operations.append(
                InsertOne(features)
            )

            if len(operations) >= 5000:

                try:
                    self.feature_collection.bulk_write(
                        operations,
                        ordered=False
                    )
                except Exception:
                    pass

                operations = []

            processed += 1

        if operations:

            try:
                self.feature_collection.bulk_write(
                    operations,
                    ordered=False
                )
            except Exception:
                pass

        print(f"✅ Processed {processed} logs")

    # ==================================
    # PROCESS ALL
    # ==================================

    def process_all_logs(self):

        collections = self.db.list_collection_names()

        for col in collections:

            if col.endswith("_logs"):

                self.process_collection(col)


if __name__ == "__main__":

    engine = FeatureEngineering()

    engine.process_all_logs()

    print("\n✅ Feature engineering completed")