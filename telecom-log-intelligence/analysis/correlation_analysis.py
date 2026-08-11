from pymongo import MongoClient
import pandas as pd


class CorrelationAnalysis:

    def __init__(self):

        self.client = MongoClient("mongodb://localhost:27017")

        self.db = self.client["telecom_logs"]

    def compute_correlation(self):

        collection = self.db["log_features"]

        data = list(collection.find({}, {"_id": 0}))

        if not data:
            print("No data")
            return

        df = pd.DataFrame(data)

        numeric_df = df.select_dtypes(
            include=["int64", "float64", "bool"]
        )

        correlation = numeric_df.corr()

        print("\n📊 Correlation Matrix:\n")

        print(correlation)


if __name__ == "__main__":

    analyzer = CorrelationAnalysis()

    analyzer.compute_correlation()