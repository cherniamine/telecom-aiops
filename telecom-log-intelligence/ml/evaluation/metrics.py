import pandas as pd


def compute_metrics():

    df = pd.read_parquet("data/processed/ml_dataset.parquet")

    print("📊 Basic stats")
    print(df.describe())

    print("\n🔥 Errors by platform")
    print(df.groupby("platform")["is_error"].mean())

    print("\n⚠️ Warnings by platform")
    print(df.groupby("platform")["is_warning"].mean())


if __name__ == "__main__":
    compute_metrics()