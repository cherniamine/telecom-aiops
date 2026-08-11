import os
from pymongo import MongoClient

from ingestion.log_cleaner import LogCleaner
from ingestion.log_normalizer import LogNormalizer
from ingestion.parser import LogParserRouter

class IngestRunner:

    def __init__(self):

        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        db_name = os.getenv("DATABASE_NAME", "telecom_logs")

        print(f"🔌 Connexion MongoDB: {mongo_uri}")
        print(f"📊 Base de données: {db_name}")

        self.client = MongoClient(mongo_uri)
        self.db = self.client[db_name]

        self.cleaner = LogCleaner()
        self.parser = LogParserRouter()
        self.normalizer = LogNormalizer()

    # ==========================================
    # INGEST FILE
    # ==========================================

    def ingest_file(self, file_path, platform, source_file=None):

        collection_name = f"{platform.lower()}_logs"
        collection = self.db[collection_name]

        print(f"🚀 Ingesting {file_path} → {collection_name}")

        inserted = 0
        skipped = 0

        try:

            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:

                for line in f:

                    # 1️⃣ Clean
                    clean_line = self.cleaner.clean_line(line)

                    if not clean_line:
                        skipped += 1
                        continue

                    # 2️⃣ Parse
                    parsed = self.parser.parse(
                        clean_line,
                        platform,
                        source_file
                    )

                    if not parsed:
                        skipped += 1
                        continue

                    # 3️⃣ Normalize
                    normalized = self.normalizer.normalize(parsed)

                    if not normalized:
                        skipped += 1
                        continue

                    # 4️⃣ Insert
                    collection.insert_one(normalized)

                    inserted += 1

            print(f"✅ Inserted: {inserted}")
            print(f"⚠ Skipped: {skipped}")

        except Exception as e:

            print(f"❌ Error processing {file_path}: {e}")

    # ==========================================
    # INGEST DIRECTORY
    # ==========================================

    def ingest_directory_recursive(self, directory, platform):

        for root, dirs, files in os.walk(directory):

            for file in files:

                file_path = os.path.join(root, file)

                self.ingest_file(
                    file_path=file_path,
                    platform=platform,
                    source_file=file
                )

    # ==========================================
    # INGEST ALL PLATFORMS
    # ==========================================

    def ingest_all_platforms(self, raw_logs_root):

        for platform in os.listdir(raw_logs_root):

            platform_path = os.path.join(raw_logs_root, platform)

            if not os.path.isdir(platform_path):
                continue

            print("\n==============================")
            print(f"📡 PLATFORM: {platform}")
            print("==============================")

            self.ingest_directory_recursive(
                directory=platform_path,
                platform=platform
            )


# ==========================================
# CLI
# ==========================================

if __name__ == "__main__":

    runner = IngestRunner()

    runner.ingest_all_platforms("data/raw_logs")

    print("\n✅ All platforms ingestion completed.")