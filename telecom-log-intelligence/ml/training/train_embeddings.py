import pandas as pd
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer


def train_tfidf():

    print("📥 Chargement dataset...")
    df = pd.read_parquet("data/processed/ml_dataset.parquet")

    df = df.sample(200000)

    vectorizer = TfidfVectorizer(
        max_features=5000,
        ngram_range=(1, 2),
        min_df=5
    )

    X = vectorizer.fit_transform(df["message"])

    joblib.dump(vectorizer, "ml/models/tfidf.pkl")

    print("✅ TF-IDF entraîné")


if __name__ == "__main__":
    train_tfidf()