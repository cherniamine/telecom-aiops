import pandas as pd
import re
from pymongo import MongoClient
from pathlib import Path


# =====================================================
# CLEAN LOG TEXT
# =====================================================

def clean_log(log):

    if not log:
        return ""

    log = str(log)

    # remove numbers
    log = re.sub(r"\d+", "", log)

    # normalize whitespace
    log = re.sub(r"\s+", " ", log)

    return log.strip().lower()


# =====================================================
# EXTRACT LOG LEVEL
# =====================================================

def extract_level(raw_log):

    if not raw_log:
        return "unknown"

    return (
        raw_log.get("severity")
        or raw_log.get("level")
        or raw_log.get("log_level")
        or "unknown"
    ).lower()


# =====================================================
# LABEL ENGINEERING
# =====================================================

def is_error(level, message):

    return int(
        level in ["error", "alert", "critical"]
        or "error" in message
        or "fail" in message
        or "timeout" in message
    )


def is_warning(level, message):

    return int(
        level in ["warn", "warning"]
        or "warn" in message
    )


# =====================================================
# READ COLLECTION STREAM
# =====================================================

def read_collection(col, platform_name):

    rows = []

    cursor = col.find({}, batch_size=5000)

    for doc in cursor:

        raw = doc.get("raw_log", {})

        message = (
            raw.get("raw_message")
            or raw.get("message")
            or ""
        )

        message = clean_log(message)

        if not message:
            continue

        level = extract_level(raw)

        timestamp = raw.get("timestamp")

        row = {

            # =====================
            # CORE FEATURES
            # =====================

            "platform": platform_name,
            "message": message,
            "timestamp": timestamp,
            # =====================
            # TEXT FEATURES
            # =====================

            "message_length": len(message),

            # =====================
            # TIME FEATURES
            # =====================

            "hour": timestamp.hour if timestamp else 0,
            "day": timestamp.day if timestamp else 0,
            "month": timestamp.month if timestamp else 0,
            "weekday": timestamp.weekday() if timestamp else 0,

        }

        # =====================
        # LABEL FEATURES
        # =====================

        row["is_error"] = is_error(level, message)
        row["is_warning"] = is_warning(level, message)

        rows.append(row)

    return rows


# =====================================================
# BUILD DATASET
# =====================================================

def build_dataset():

    print("Connecting MongoDB...")

    client = MongoClient("mongodb://localhost:27017")

    db = client["telecom_logs"]

    collections = {

        "smsc": db["smsc_logs"],
        "smpps": db["smpps_logs"],
        "smppc": db["smppc_logs"],
        "dmc": db["dmc_logs"],
        "mmg": db["mmg_logs"]

    }

    all_rows = []

    for name, col in collections.items():

        print(f"Loading {name}...")

        rows = read_collection(col, name)

        all_rows.extend(rows)

        print(f"{name}: {len(rows)} logs loaded")

    print("\nCreating dataframe...")

    df = pd.DataFrame(all_rows)

    if df.empty:

        print("Dataset empty ❌")

        return

    # =====================================================
    # EXTRA ML FEATURES (IMPORTANT FOR CAUSAL INFERENCE)
    # =====================================================

    print("Generating ML features...")

    df["message_length"] = df["message"].str.len()

    df["is_error"] = df["message"].str.contains(
        "error|fail|timeout",
        case=False,
        regex=True
    ).astype(int)

    df["is_warning"] = df["message"].str.contains(
        "warn",
        case=False
    ).astype(int)

    # =====================================================
    # TELECOM PLATFORM FEATURES (VERY IMPORTANT FOR RCA)
    # =====================================================

    print("Generating telecom-aware features...")

    df["is_smsc"] = (df["platform"] == "smsc").astype(int)
    df["is_mmg"] = (df["platform"] == "mmg").astype(int)
    df["is_dmc"] = (df["platform"] == "dmc").astype(int)
    df["is_smpps"] = (df["platform"] == "smpps").astype(int)
    df["is_smppc"] = (df["platform"] == "smppc").astype(int)

    # =====================================================
    # SAVE DATASET
    # =====================================================

    output_path = Path("data/processed/ml_dataset.parquet")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    print("Saving dataset parquet...")

    df.to_parquet(output_path)

    print("\nDataset FINAL:", df.shape)

    print("\nPlatform distribution:")

    print(df["platform"].value_counts())


# =====================================================
# MAIN ENTRYPOINT
# =====================================================

if __name__ == "__main__":

    build_dataset()