import os
import time
import logging

from dotenv import load_dotenv

from realtime.mongo_stream_listener import MongoStreamListener
from realtime.realtime_processor import RealtimeProcessor


logger = logging.getLogger(__name__)

load_dotenv()


class RealtimePipeline:

    def __init__(
        self,
        mongo_uri=None,
        db_name=None,
        collection=None,
        poll_interval_seconds=2,
        buffer_size=None,
        buffer_max_wait_seconds=None,
    ):

        self.mongo_uri = mongo_uri or os.getenv(
            "MONGO_URI",
            "mongodb://localhost:27017/",
        )
        self.db_name = db_name or os.getenv(
            "DATABASE_NAME",
            "telecom_logs",
        )
        self.collection = collection or os.getenv(
            "REALTIME_COLLECTION",
            "logs",
        )
        self.poll_interval_seconds = poll_interval_seconds
        
        # Initialize RealtimeProcessor with buffering
        self.processor = RealtimeProcessor(
            buffer_size=buffer_size or int(
                os.getenv("REALTIME_BUFFER_SIZE", "20")
            ),
            buffer_timeout_seconds=buffer_max_wait_seconds or float(
                os.getenv("REALTIME_BUFFER_MAX_WAIT_SECONDS", "5")
            ),
        )

        self.listener = MongoStreamListener(
            mongo_uri=self.mongo_uri,
            db_name=self.db_name,
            collection=self.collection,
            poll_interval_seconds=self.poll_interval_seconds,
        )

    def start(self):
        """
        Start listening to MongoDB and process logs through RealtimeProcessor.
        
        The RealtimeProcessor handles:
        1. Anomaly detection
        2. Anomaly storage
        3. Buffering for orchestration
        4. Orchestration when buffer reaches configured size or timeout
        5. Linking anomalies to incidents
        """
        print("Starting Realtime Pipeline...")
        print(f"Watching collection: {self.db_name}.{self.collection}")
        print(
            "Buffered orchestration via RealtimeProcessor:"
            f" {self.processor.buffer_size} anomalies per run"
            f" or {self.processor.buffer_timeout_seconds:.0f}s max wait"
        )

        processed_count = 0
        anomaly_count = 0

        try:
            for change in self.listener.listen():
                if not change:
                    continue

                if change.get("operationType") != "insert":
                    continue

                document = change.get("fullDocument")

                if not document:
                    continue

                raw_log = document.get("raw_log", {})

                if not isinstance(raw_log, dict):
                    raw_log = {}

                message = (
                    document.get("message")
                    or document.get("log")
                    or document.get("text")
                    or raw_log.get("message")
                    or raw_log.get("raw_message")
                )

                if not message:
                    logger.info(
                        "Skipping realtime document without message payload."
                    )
                    continue

                processed_count += 1

                # Process log through RealtimeProcessor
                # This will:
                # 1. Detect anomalies
                # 2. Save anomalies
                # 3. Buffer for orchestration
                # 4. Orchestrate and link when buffer is full
                result = self.processor.process_log(document)

                if result.get("is_anomaly"):
                    anomaly_count += 1

                logger.info(
                    f"Processed log #{processed_count} "
                    f"(anomalies: {anomaly_count})"
                )

        except KeyboardInterrupt:
            logger.info("Realtime Pipeline interrupted by user")
            self.processor.flush_buffer()
        except Exception as e:
            logger.error(
                f"Error in Realtime Pipeline: {str(e)}",
                exc_info=True
            )
            self.processor.flush_buffer()
        finally:
            # Flush any remaining buffered logs
            if self.processor.buffer:
                logger.info(
                    f"Processing remaining {len(self.processor.buffer)} "
                    "buffered anomalies before shutdown..."
                )
                self.processor.flush_buffer()


def main():
    pipeline = RealtimePipeline()
    pipeline.start()


if __name__ == "__main__":
    main()
