from ai.engine.rca_engine import RCAEngine

class RCAService:

    def __init__(self):
        self.engine = RCAEngine()

    def analyze(self, anomaly_logs):

        return self.engine.find_root_cause(anomaly_logs)
