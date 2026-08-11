import threading
import time
from pymongo import MongoClient

from ai.orchestrator.incidents_master import IncidentsMaster
from pipeline.realtime_pipeline import RealtimePipeline
from ai.orchestrator.telecom_ai_orchestrator import TelecomAIOrchestrator
from ai.orchestrator.telecom_decision_support_engine import TelecomDecisionSupportEngine


# -----------------------------------------
# CONFIGURATION
# -----------------------------------------

MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "telecom_logs"

LOGS_COLLECTION = "log_features"
REALTIME_INCIDENTS_COLLECTION = "incidents_realtime"


# -----------------------------------------
# REALTIME PIPELINE THREAD
# -----------------------------------------

def start_realtime_pipeline():

    print("🚀 Starting Realtime Pipeline...")

    pipeline = RealtimePipeline(
        mongo_uri=MONGO_URI,
        db_name=DB_NAME,
        collection=LOGS_COLLECTION
    )

    pipeline.start()


# -----------------------------------------
# AI INCIDENT ANALYSIS LOOP
# -----------------------------------------

def start_ai_analysis_loop():

    print("🧠 Starting Realtime AI Incident Engine...")

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    orchestrator = TelecomAIOrchestrator()
    decision_engine = TelecomDecisionSupportEngine()

    last_processed_id = None

    while True:

        try:

            print("\n🔍 Running realtime AI analysis...")

            query = {}

            if last_processed_id:
                query["_id"] = {"$gt": last_processed_id}

            logs_cursor = list(
                db[LOGS_COLLECTION]
                .find(query)
                .sort("_id", -1)
                .limit(500)
            )

            if not logs_cursor:

                print("⚠️ No new logs detected...")
                time.sleep(10)
                continue


            last_processed_id = logs_cursor[0]["_id"]


            logs = [

                log.get("message")
                or log.get("log")
                or log.get("text")

                for log in logs_cursor

                if (

                    log.get("message")
                    or log.get("log")
                    or log.get("text")

                )

            ]


            print(f"📊 New logs loaded: {len(logs)}")


            result = orchestrator.process_logs(logs)


            report = decision_engine.build_incident_report(

                anomalies=result.get("anomalies", []),

                rca=result.get("rca", {}),

                telecom_rca=result.get("telecom_rca", {}),

                alerts=result.get("alerts", [])

            )


            print("\n🧠 REALTIME INCIDENT GENERATED\n")


            incidents_master = IncidentsMaster()
            incidents_master.save_incident(report, source="realtime_ai")


            print("✅ Incident saved into MongoDB (Realtime)")


            time.sleep(20)


        except Exception as e:

            print("❌ AI Loop Error:", str(e))

            time.sleep(10)


# -----------------------------------------
# MAIN ENTRYPOINT
# -----------------------------------------

if __name__ == "__main__":

    print("🚀 Starting Telecom AI Platform...\n")


    realtime_thread = threading.Thread(
        target=start_realtime_pipeline,
        daemon=True
    )


    ai_thread = threading.Thread(
        target=start_ai_analysis_loop,
        daemon=True
    )


    realtime_thread.start()
    ai_thread.start()


    print("✅ Telecom AI Platform running successfully")
    print("📡 Realtime ingestion active")
    print("🧠 AI realtime analysis active")
    print("📊 Realtime incident detection active\n")


    try:

        while True:
            time.sleep(1)

    except KeyboardInterrupt:

        print("\n Shutting down Telecom AI Platform...")