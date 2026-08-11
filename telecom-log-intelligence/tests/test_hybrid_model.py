from ml.training.hybrid_model import HybridAnomalyDetector
import pandas as pd


print("Loading sample dataset...")

df = pd.read_parquet("data/processed/ml_dataset.parquet")


df_sample = df.sample(10)


print("Running HybridAnomalyDetector...")

detector = HybridAnomalyDetector()


scores = detector.predict(df_sample)


print("Scores:")

print(scores[:5])