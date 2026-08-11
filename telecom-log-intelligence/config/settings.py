import os
from pathlib import Path
from dotenv import load_dotenv

# Charger variables .env
load_dotenv()

# =====================================================
# BASE PATHS
# =====================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
RAW_LOGS_DIR = DATA_DIR / "raw_logs"
PROCESSED_DIR = DATA_DIR / "processed"

# Services logs
DMC_LOGS_DIR = RAW_LOGS_DIR / "DMC"
MMG_LOGS_DIR = RAW_LOGS_DIR / "MMG"
SMPPC_LOGS_DIR = RAW_LOGS_DIR / "SMPPC"
SMPPS_LOGS_DIR = RAW_LOGS_DIR / "SMPPS"
SMSC_LOGS_DIR = RAW_LOGS_DIR / "SMSC"

# =====================================================
# MONGODB CONFIG
# =====================================================

MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongodb:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "telecom_logs")

COLLECTION_DMC = "dmc_logs"
COLLECTION_MMG = "mmg_logs"
COLLECTION_SMPPC = "smppc_logs"
COLLECTION_SMPPS = "smpps_logs"
COLLECTION_SMSC = "smsc_logs"

COLLECTION_FEATURES = "features"
COLLECTION_ANOMALIES = "anomalies"
COLLECTION_CORRELATIONS = "correlations"
COLLECTION_MODELS_META = "models_metadata"

# =====================================================
# ML SETTINGS
# =====================================================

MODEL_DIR = BASE_DIR / "ml_models"
MODEL_VERSION = "v1"

ISOLATION_FOREST_PARAMS = {
    "n_estimators": 200,
    "contamination": 0.02,
    "random_state": 42
}

# =====================================================
# FEATURE ENGINEERING SETTINGS
# =====================================================

TIME_WINDOW_MINUTES = 5

FEATURE_COLUMNS = [
    "logs_per_minute",
    "warn_ratio",
    "error_ratio",
    "unique_error_codes",
    "burst_score",
    "interarrival_mean"
]

# =====================================================
# LOGGING CONFIG
# =====================================================

LOG_LEVEL = "INFO"

# =====================================================
# INGESTION SETTINGS
# =====================================================

SUPPORTED_LOG_EXTENSIONS = [".log", ".txt"]

BATCH_SIZE = 5000