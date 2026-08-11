import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

from monitoring.model_drift_detector import ModelDriftDetector


print("Loading dataset...")
df = pd.read_parquet("data/processed/ml_dataset.parquet")
df = df.sample(200000, random_state=42)

print("Loading trained models...")
iso = joblib.load("ml/models/isolation_forest.pkl")
lof = joblib.load("ml/models/lof.pkl")
vectorizer = joblib.load("ml/models/tfidf.pkl")
features = joblib.load("ml/models/features.pkl")

base_features = [
    "message_length",
    "hour",
    "weekday",
    "is_error",
    "is_warning",
]
platforms = [
    "smsc",
    "smpps",
    "smppc",
    "dmc",
    "mmg",
]

print("Preparing structured features...")
df_struct = df[base_features + ["platform"]].copy()

for platform in platforms:
    df_struct[f"platform_{platform}"] = (
        df_struct["platform"] == platform
    ).astype(int)

df_struct.drop(columns=["platform"], inplace=True)
df_struct = df_struct.reindex(
    columns=features,
    fill_value=0,
)

print("Computing anomaly scores...")
iso_scores = iso.decision_function(df_struct)
lof_scores = lof.decision_function(df_struct.values)
x_text = vectorizer.transform(df["message"])
text_scores = np.asarray(x_text.mean(axis=1)).flatten()

print("Training score scalers...")
iso_scaler = MinMaxScaler()
lof_scaler = MinMaxScaler()
text_scaler = MinMaxScaler()

iso_scaler.fit(iso_scores.reshape(-1, 1))
lof_scaler.fit(lof_scores.reshape(-1, 1))
text_scaler.fit(text_scores.reshape(-1, 1))

joblib.dump(iso_scaler, "ml/models/iso_scaler.pkl")
joblib.dump(lof_scaler, "ml/models/lof_scaler.pkl")
joblib.dump(text_scaler, "ml/models/text_scaler.pkl")

print("Scalers saved")

print("Saving optimized weights...")
weights = {
    "iso": 0.4,
    "lof": 0.3,
    "text": 0.3,
}
joblib.dump(weights, "ml/models/weights.pkl")

print("weights.pkl saved")

iso_normalized = 1 - iso_scaler.transform(
    iso_scores.reshape(-1, 1)
).flatten()
lof_normalized = 1 - lof_scaler.transform(
    lof_scores.reshape(-1, 1)
).flatten()
text_normalized = 1 - text_scaler.transform(
    text_scores.reshape(-1, 1)
).flatten()
hybrid_scores = (
    weights["iso"] * iso_normalized
    + weights["lof"] * lof_normalized
    + weights["text"] * text_normalized
)

drift_detector = ModelDriftDetector()
drift_detector.set_reference(
    scores=hybrid_scores.tolist(),
    texts=df["message"].astype(str).tolist(),
    anomaly_rate=float(np.mean(hybrid_scores > 0.65)),
    metadata={
        "source": "train_anomaly_models_v2.py",
        "model_stage": "hybrid_calibrated",
    },
)

print("Drift reference updated")
print("\nHybrid anomaly model calibration complete")
