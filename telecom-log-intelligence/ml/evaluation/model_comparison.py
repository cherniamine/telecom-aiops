import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor


def compare_models():

    df = pd.read_parquet("data/processed/ml_dataset.parquet")

    df = df.sample(100000)

    df = pd.get_dummies(df, columns=["platform"])

    features = [
        "message_length",
        "hour",
        "weekday",
        "is_error",
        "is_warning"
    ] + [col for col in df.columns if col.startswith("platform_")]

    X = df[features]

    print("Training IsolationForest...")
    iso = IsolationForest(contamination=0.05)
    iso.fit(X)
    iso_pred = iso.predict(X)

    print("Training LOF...")
    lof = LocalOutlierFactor(novelty=True)
    lof.fit(X)
    lof_pred = lof.predict(X)

    print("Anomalies IF:", (iso_pred == -1).sum())
    print("Anomalies LOF:", (lof_pred == -1).sum())


if __name__ == "__main__":
    compare_models()
