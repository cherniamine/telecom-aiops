import numpy as np

class AdaptiveThresholdEngine:

    def compute_threshold(self, values):

        mean = np.mean(values)
        std = np.std(values)

        threshold = mean + 3 * std

        return threshold

    def detect(self, values):

        threshold = self.compute_threshold(values)

        anomalies = []

        for i, v in enumerate(values):

            if v > threshold:
                anomalies.append(i)

        return anomalies