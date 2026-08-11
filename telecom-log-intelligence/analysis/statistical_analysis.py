from pymongo import MongoClient


class StatisticalAnalysis:

    def __init__(self):

        self.client = MongoClient("mongodb://localhost:27017")

        self.db = self.client["telecom_logs"]

    def error_rate(self):

        features = self.db["log_features"]

        total = features.count_documents({})

        errors = features.count_documents({"is_error": True})

        warnings = features.count_documents({"is_warning": True})

        if total == 0:
            print("No logs available")
            return

        rate = (errors / total) * 100

        print(f"Total logs: {total}")
        print(f"Errors: {errors}")
        print(f"Warnings: {warnings}")
        print(f"Error rate: {rate:.2f}%")
        

if __name__ == "__main__":

    analysis = StatisticalAnalysis()

    analysis.error_rate()