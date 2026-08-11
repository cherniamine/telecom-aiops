import pandas as pd
from ml.training.hybrid_model import HybridAnomalyDetector


def test_prediction():

    model = HybridAnomalyDetector()

    sample = pd.DataFrame([{
        "platform": "smsc",
        "message": "error connection timeout failed",
        "message_length": 40,
        "hour": 2,
        "weekday": 6,
        "is_error": 1,
        "is_warning": 0
    }])

    score = model.predict(sample)

    # 🔥 seuil (à ajuster)
    threshold = -0.3

    is_anomaly = score[0] < threshold

    print("Score:", score[0])
    print("Anomalie ?", is_anomaly)


if __name__ == "__main__":
    test_prediction()