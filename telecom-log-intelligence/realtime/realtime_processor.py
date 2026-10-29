import os
import logging
from datetime import datetime, timezone
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

from services.anomaly_service import AnomalyService
from services.anomaly_storage import save_anomaly
from services.alert_service import AlertService
from ai.orchestrator.telecom_ai_orchestrator import run_orchestrator


logger = logging.getLogger(__name__)


class RealtimeProcessor:

    def __init__(self, buffer_size=20, buffer_timeout_seconds=5):
        """
        Initialize RealtimeProcessor with buffering capability for orchestration.
        
        Args:
            buffer_size: Number of logs to accumulate before flushing
            buffer_timeout_seconds: Max seconds to wait before flushing partial buffer
        """
        self.anomaly_service = AnomalyService()
        self.alert_service = AlertService()
        self.buffer = []
        self.buffer_size = buffer_size
        self.buffer_timeout_seconds = buffer_timeout_seconds
        self.last_flush_time = datetime.now(timezone.utc)
        
        # MongoDB connection
        load_dotenv()
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        database_name = os.getenv("DATABASE_NAME", "telecom_logs")
        
        client = MongoClient(mongo_uri)
        self.db = client[database_name]

    def process_log(self, log):
        """
        Process a single log entry:
        1. Detect anomalies
        2. Save anomaly without incident_id (placeholder)
        3. Add to buffer for orchestration
        4. Flush when buffer is full or timeout reached
        """
        if not isinstance(log, dict):
            log = {"message": str(log)}

        log_id = log.get("_id")
        platform = log.get("platform", "UNKNOWN")
        message = log.get("message", "")[:50]
        
        # Step 1: Detect anomaly
        result = self.anomaly_service.analyze_log(log)
        is_anomaly = result.get("is_anomaly", False)
        anomaly_score = result.get("anomaly_score", 0)

        print(f"[{platform}] Log {log_id}: score={anomaly_score:.2f}, anomaly={is_anomaly}")

        if is_anomaly:
            # Step 2: Save anomaly (incident_id will be filled later)
            anomaly_id = save_anomaly(log, result)
            
            # Step 3: Add to buffer for orchestration
            self.buffer.append({
                "log": log,
                "anomaly_id": anomaly_id,
                "result": result
            })
            
            buffer_status = f"({len(self.buffer)}/{self.buffer_size})"
            print(f"  ✓ ANOMALY BUFFERED {buffer_status} - ID: {anomaly_id}")
            logger.info(
                f"Buffered anomaly {anomaly_id} "
                f"({len(self.buffer)}/{self.buffer_size})"
            )
            
            # Step 4: Check if we should flush
            self._check_and_flush()

        return result

    def _check_and_flush(self):
        """Check if buffer should be flushed based on size or timeout."""
        should_flush = len(self.buffer) >= self.buffer_size
        
        if not should_flush:
            elapsed = (
                datetime.now(timezone.utc) - self.last_flush_time
            ).total_seconds()
            should_flush = elapsed >= self.buffer_timeout_seconds
            if should_flush:
                print(f"  ⏱️  TIMEOUT FLUSH TRIGGERED ({elapsed:.1f}s > {self.buffer_timeout_seconds}s), {len(self.buffer)} anomalies")
        else:
            print(f"  📦 BUFFER FULL FLUSH TRIGGERED ({len(self.buffer)}/{self.buffer_size})")
        
        if should_flush:
            self.flush_buffer()

    def flush_buffer(self):
        """
        Flush accumulated logs through orchestrator and link anomalies to incidents.
        
        This method:
        1. Extracts logs from buffer
        2. Runs orchestrator to create incidents and alerts
        3. Extracts incident IDs from alerts
        4. Updates anomalies with incident_id and enrichment data
        """
        if not self.buffer:
            logger.info("Buffer is empty, skipping flush.")
            return

        buffer_size = len(self.buffer)
        print(f"\n{'='*60}")
        print(f"🔄 FLUSHING BUFFER: {buffer_size} anomalies through orchestrator...")
        print(f"{'='*60}")

        logger.info(
            f"Flushing buffer: {len(self.buffer)} anomalies "
            "through orchestrator..."
        )

        try:
            # Step 1: Extract logs from buffer
            logs = [item["log"] for item in self.buffer]
            buffer_size = len(logs)

            # Step 2: Run orchestrator
            print(f"  ▶ Calling run_orchestrator() with {buffer_size} logs...")
            orchestration_result = run_orchestrator(logs)

            if not orchestration_result:
                print(f"  ✗ Orchestrator returned no result")
                logger.warning(
                    "Orchestrator returned no result, "
                    "anomalies remain unlinked"
                )
                self.buffer = []
                self.last_flush_time = datetime.now(timezone.utc)
                return

            # Step 3: Extract incident information from alerts
            alerts = orchestration_result.get("alerts", [])
            
            if alerts:
                print(f"  ✓ Orchestrator created {len(alerts)} alert(s)")
                logger.info(
                    f"Orchestrator created {len(alerts)} alert(s) "
                    f"from {buffer_size} logs"
                )
                
                # Step 4: Update anomalies with incident data
                self._update_anomalies_from_orchestration(
                    alerts,
                    orchestration_result
                )
            else:
                print(f"  ⚠ Orchestrator processed {buffer_size} logs but created no alerts")
                logger.info(
                    f"Orchestrator processed {buffer_size} logs "
                    "but created no alerts"
                )

        except Exception as e:
            print(f"  ✗ Error during buffer flush: {str(e)}")
            logger.error(
                f"Error during buffer flush: {str(e)}",
                exc_info=True
            )
        finally:
            self.buffer = []
            self.last_flush_time = datetime.now(timezone.utc)
            print(f"✓ Buffer cleared and ready for new anomalies\n")

    def _update_anomalies_from_orchestration(
        self,
        alerts,
        orchestration_result
    ):
        """
        Update anomalies in buffer with incident data from orchestration.
        
        Maps orchestration alerts to anomalies and enriches them with:
        - incident_id
        - severity
        - impact level
        - propagation stage
        - root causes
        - recommended actions
        """
        impact = orchestration_result.get("impact", {})
        propagation_path = (
            orchestration_result.get("telecom_rca", {})
            .get("propagation_path", [])
        )
        root_causes = (
            orchestration_result.get("rca", {})
            .get("root_causes", [])
        )

        # For each buffered anomaly, find matching alert and update
        for i, buffer_item in enumerate(self.buffer):
            anomaly_id = buffer_item["anomaly_id"]
            
            # Use the first incident alert for now
            # (In future, could use more sophisticated matching)
            incident_alert = None
            for alert in alerts:
                if alert.get("type") == "INCIDENT":
                    incident_alert = alert
                    break
            
            if incident_alert:
                self._update_anomaly_with_incident(
                    anomaly_id,
                    incident_alert,
                    impact,
                    propagation_path,
                    root_causes
                )
            else:
                logger.warning(
                    f"No INCIDENT alert found for anomaly {anomaly_id}"
                )

    def _update_anomaly_with_incident(
        self,
        anomaly_id,
        incident_alert,
        impact,
        propagation_path,
        root_causes
    ):
        """Update a single anomaly with incident data."""
        try:
            metadata = incident_alert.get("metadata", {})
            
            # Extract enrichment data
            severity = incident_alert.get("severity", "MEDIUM")
            customer_impact = (
                metadata.get("customer_impact")
                or impact.get("customer_impact")
            )
            propagation_stage = self._get_propagation_stage(
                propagation_path
            )
            
            root_cause = None
            if root_causes and isinstance(root_causes[0], (list, tuple)):
                root_cause = root_causes[0][0]
            elif root_causes:
                root_cause = root_causes[0]
            
            recommended_actions = metadata.get("recommended_actions", [])
            recommended_action = (
                recommended_actions[0] if recommended_actions else None
            )

            # Update anomaly in database
            update_result = self.db.anomalies.update_one(
                {"_id": ObjectId(str(anomaly_id)) if isinstance(anomaly_id, ObjectId) else anomaly_id},
                {
                    "$set": {
                        "incident_id": str(incident_alert.get("_id", "")),
                        "severity": severity,
                        "impact": customer_impact,
                        "propagation_stage": propagation_stage,
                        "root_cause": root_cause,
                        "recommended_action": recommended_action,
                        "updated_at": datetime.now(timezone.utc),
                    }
                }
            )
            
            if update_result.matched_count > 0:
                print(f"    ✓ Updated anomaly {anomaly_id} → incident_id={incident_alert.get('_id')}, severity={severity}")
                logger.info(
                    f"Updated anomaly {anomaly_id} "
                    f"with incident {incident_alert.get('_id')} "
                    f"(severity={severity})"
                )
            else:
                logger.warning(
                    f"Could not find anomaly {anomaly_id} for update"
                )

        except Exception as e:
            logger.error(
                f"Error updating anomaly {anomaly_id}: {str(e)}",
                exc_info=True
            )

    def _get_propagation_stage(self, propagation_path):
        """
        Calculate propagation stage from propagation path.
        Returns the length of the propagation path (1-4+).
        """
        return len(propagation_path) if propagation_path else 1
