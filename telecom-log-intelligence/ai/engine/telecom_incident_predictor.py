from sklearn.ensemble import RandomForestClassifier

class TelecomIncidentPredictor:

    def __init__(self):

        self.model = RandomForestClassifier(
            n_estimators=100
        )

    def train(self, X, y):

        self.model.fit(X, y)

    def predict(self, X):

        return self.model.predict(X)