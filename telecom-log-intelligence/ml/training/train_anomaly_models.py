import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor

from monitoring.model_drift_detector import ModelDriftDetector


def train_models():
    df = pd.read_parquet("data/processed/ml_dataset.parquet")
    df = df.groupby("platform").sample(100000, replace=True)

    base_features = [
        "message_length",
        "hour",
        "weekday",
        "is_error",
        "is_warning",
    ]
    platforms = ["smsc", "smpps", "smppc", "dmc", "mmg"]

    for platform in platforms:
        df[f"platform_{platform}"] = (
            df["platform"] == platform
        ).astype(int)

    features = base_features + [
        f"platform_{platform}"
        for platform in platforms
    ]
    x_train = df[features]

    print("Training IsolationForest...")
    iso_model = IsolationForest(
        contamination=0.05,
        random_state=42,
    )
    iso_model.fit(x_train)

    print("Training LOF...")
    lof_model = LocalOutlierFactor(novelty=True)
    lof_model.fit(x_train.values)

    joblib.dump(
        iso_model,
        "ml/models/isolation_forest.pkl",
    )
    joblib.dump(lof_model, "ml/models/lof.pkl")
    joblib.dump(features, "ml/models/features.pkl")

    reference_scores = (
        0.5 * (1 - iso_model.decision_function(x_train))
        + 0.5 * (1 - lof_model.decision_function(x_train.values))
    )
    anomaly_rate = float(
        np.mean(
            reference_scores
            > np.percentile(reference_scores, 95)
        )
    )
    detector = ModelDriftDetector()
    detector.set_reference(
        scores=reference_scores.tolist(),
        texts=(
            df["message"].astype(str).tolist()
            if "message" in df.columns
            else None
        ),
        anomaly_rate=anomaly_rate,
        metadata={
            "source": "train_anomaly_models.py",
            "model_stage": "structured_baseline",
        },
    )

    print("Reference drift baseline updated")
    print("Models trained successfully")


if __name__ == "__main__":
    train_models()
