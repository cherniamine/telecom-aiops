import os
import random
import threading
from datetime import datetime, timezone
from time import sleep

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

PLATFORM_COLLECTIONS = {
    "SMSC":  "smsc_logs",
    "MMG":   "mmg_logs",
    "SMPPS": "smpps_logs",
    "SMPPC": "smppc_logs",
    "DMC":   "dmc_logs",
}


class PlatformSimulator:
    """Streams logs from one platform collection into the realtime 'logs' collection."""

    def __init__(
        self,
        platform: str,
        source_collection: str,
        mongo_uri: str,
        db_name: str,
        stream_collection: str = "logs",
        limit: int = 200,
        min_delay: float = 0.05,
        max_delay: float = 0.20,
    ):
        self.platform          = platform
        self.source_collection = source_collection
        self.stream_collection = stream_collection
        self.limit             = limit
        self.min_delay         = min_delay
        self.max_delay         = max_delay

        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        self._src  = db[source_collection]
        self._dest = db[stream_collection]

    def run(self) -> int:
        count = self._src.count_documents({})
        if count == 0:
            print(f"[{self.platform}] ⚠  Collection '{self.source_collection}' is empty — skipping.")
            return 0

        limit = min(self.limit, count)
        print(f"[{self.platform}] ▶  Streaming {limit} logs from '{self.source_collection}'...")

        inserted = 0
        for doc in self._src.find().limit(limit):
            payload = self._prepare(doc)
            self._dest.insert_one(payload)
            inserted += 1
            if inserted == 1 or inserted % 100 == 0:
                print(f"[{self.platform}]    {inserted}/{limit} logs streamed")
            sleep(random.uniform(self.min_delay, self.max_delay))

        print(f"[{self.platform}] ✓  Done — {inserted} logs inserted.")
        return inserted

    def _prepare(self, doc: dict) -> dict:
        payload = {k: v for k, v in doc.items() if k != "_id"}

        raw = payload.get("raw_log") if isinstance(payload.get("raw_log"), dict) else {}

        if not payload.get("message"):
            payload["message"] = (
                raw.get("message")
                or raw.get("raw_message")
                or payload.get("text")
                or payload.get("log")
                or ""
            )

        if not payload.get("platform"):
            payload["platform"] = raw.get("platform") or self.platform

        payload["simulated_at"]      = datetime.now(timezone.utc)
        payload["source"]            = "log_stream_simulator"
        payload["source_collection"] = self.source_collection
        return payload


class LogStreamSimulator:
    """
    Streams logs from ALL 5 telecom platforms simultaneously using threads.

    Each platform gets its own thread so the realtime pipeline receives a
    realistic mix of SMSC / MMG / SMPPS / SMPPC / DMC events.
    """

    # Fallback order when a specific collection is empty
    DEFAULT_SOURCE_COLLECTIONS = [
        "dataset_logs",
        "smsc_logs",
        "mmg_logs",
        "smpps_logs",
        "smppc_logs",
        "dmc_logs",
        "anomalies",
    ]

    def __init__(
        self,
        mongo_uri: str | None = None,
        db_name: str | None = None,
        source_collection: str | None = None,   # kept for backward-compat (single mode)
        stream_collection: str = "logs",
        limit: int = 200,                       # per platform
        min_delay: float = 0.05,
        max_delay: float = 0.20,
        platforms: dict[str, str] | None = None,  # override {PLATFORM: collection}
        parallel: bool = True,
    ):
        self.mongo_uri = mongo_uri or os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        self.db_name   = db_name   or os.getenv("DATABASE_NAME", "telecom_logs")
        self.stream_collection_name = os.getenv("SIMULATOR_STREAM_COLLECTION", stream_collection)
        self.limit     = int(os.getenv("SIMULATOR_LIMIT",     str(limit)))
        self.min_delay = float(os.getenv("SIMULATOR_MIN_DELAY", str(min_delay)))
        self.max_delay = float(os.getenv("SIMULATOR_MAX_DELAY", str(max_delay)))
        self.parallel  = parallel

        # Legacy single-source mode (env var or constructor arg)
        self._single_source = source_collection or os.getenv("SIMULATOR_SOURCE_COLLECTION", "")

        # Platform map — can be overridden via constructor
        self._platform_map: dict[str, str] = platforms or dict(PLATFORM_COLLECTIONS)

        if self.min_delay > self.max_delay:
            self.min_delay, self.max_delay = self.max_delay, self.min_delay

        # Shared MongoClient for legacy single-source helper
        self._client = MongoClient(self.mongo_uri, serverSelectionTimeoutMS=5000)
        self._db     = self._client[self.db_name]

    # ─── Public API ──────────────────────────────────────────────────────────

    def stream_logs(self) -> int:
        """
        Main entry point.

        • If SIMULATOR_SOURCE_COLLECTION is set → legacy single-source mode.
        • Otherwise → stream all 5 platforms (parallel by default).
        """
        if self._single_source:
            print(f"[single-source mode] Using '{self._single_source}'")
            return self._stream_single(self._single_source)

        return self.stream_all_platforms()

    def stream_all_platforms(self) -> int:
        """Stream all 5 platforms, either in parallel threads or sequentially."""
        simulators = self._build_simulators()

        if not simulators:
            print("No platform collections found. Aborting.")
            return 0

        print(f"\n{'='*60}")
        print(f"  TelecomAI — Multi-Platform Realtime Simulation")
        print(f"  Platforms : {', '.join(s.platform for s in simulators)}")
        print(f"  Logs/plat : {self.limit}")
        print(f"  Mode      : {'parallel threads' if self.parallel else 'sequential'}")
        print(f"{'='*60}\n")

        if self.parallel:
            return self._run_parallel(simulators)
        return self._run_sequential(simulators)

    # ─── Internal helpers ─────────────────────────────────────────────────────

    def _build_simulators(self) -> list[PlatformSimulator]:
        simulators = []
        for platform, collection_name in self._platform_map.items():
            col = self._db[collection_name]
            try:
                if col.count_documents({}) == 0:
                    print(f"[{platform}] ⚠  '{collection_name}' empty — skipping.")
                    continue
            except Exception as e:
                print(f"[{platform}] ⚠  Cannot access '{collection_name}': {e}")
                continue

            simulators.append(
                PlatformSimulator(
                    platform=platform,
                    source_collection=collection_name,
                    mongo_uri=self.mongo_uri,
                    db_name=self.db_name,
                    stream_collection=self.stream_collection_name,
                    limit=self.limit,
                    min_delay=self.min_delay,
                    max_delay=self.max_delay,
                )
            )
        return simulators

    def _run_parallel(self, simulators: list[PlatformSimulator]) -> int:
        results: dict[str, int] = {}
        lock = threading.Lock()

        def worker(sim: PlatformSimulator):
            count = sim.run()
            with lock:
                results[sim.platform] = count

        threads = [threading.Thread(target=worker, args=(s,), daemon=True) for s in simulators]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        total = sum(results.values())
        print(f"\n{'─'*40}")
        print("  Simulation summary")
        print(f"{'─'*40}")
        for plat, n in results.items():
            print(f"  {plat:<8}  {n:>5} logs inserted")
        print(f"{'─'*40}")
        print(f"  TOTAL     {total:>5} logs → '{self.stream_collection_name}'")
        print(f"{'─'*40}\n")
        return total

    def _run_sequential(self, simulators: list[PlatformSimulator]) -> int:
        total = 0
        for sim in simulators:
            total += sim.run()
        return total

    # ─── Legacy single-source (backward-compat) ───────────────────────────────

    def _stream_single(self, collection_name: str) -> int:
        col = self._resolve_source_collection(collection_name)
        if col is None:
            print("No suitable source collection found.")
            return 0

        available = col.count_documents({})
        if available == 0:
            print(f"Collection '{col.name}' is empty.")
            return 0

        limit = min(self.limit, available)
        dest  = self._db[self.stream_collection_name]

        print(f"Starting single-source simulation: '{col.name}' → '{self.stream_collection_name}'")
        print(f"Documents to stream: {limit}")

        inserted = 0
        try:
            for doc in col.find().limit(limit):
                sim = PlatformSimulator.__new__(PlatformSimulator)
                sim.platform          = col.name.upper().replace("_LOGS", "")
                sim.source_collection = col.name
                payload = sim._prepare(doc)  # noqa: SLF001
                dest.insert_one(payload)
                inserted += 1
                if inserted == 1 or inserted % 100 == 0:
                    print(f"Streamed {inserted}/{limit} logs...")
                sleep(random.uniform(self.min_delay, self.max_delay))
        except KeyboardInterrupt:
            print(f"\nInterrupted. Logs streamed: {inserted}")
            return inserted

        print(f"Done. Total: {inserted}")
        return inserted

    def _resolve_source_collection(self, name: str):
        if name:
            col = self._db[name]
            if col.count_documents({}) > 0:
                return col
            print(f"'{name}' empty — falling back to auto-detection.")

        for n in self.DEFAULT_SOURCE_COLLECTIONS:
            try:
                col = self._db[n]
                if col.count_documents({}) > 0:
                    return col
            except Exception:
                continue
        return None


def main():
    print("Launching realtime log stream simulator...\n")
    try:
        simulator = LogStreamSimulator(
            limit=200,       # 200 logs per platform = 1000 total
            parallel=True,   # all 5 platforms at once
        )
        simulator.stream_logs()
    except KeyboardInterrupt:
        print("\nSimulation stopped by user.")
    except Exception as e:
        print(f"Log stream simulator error: {e}")


if __name__ == "__main__":
    main()