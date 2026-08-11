from collections import defaultdict

class TelecomTopologyEngine:

    def __init__(self):

        self.transitions = defaultdict(int)

    def learn(self, logs):

        for i in range(len(logs)-1):

            src = self.extract_component(logs[i])
            dst = self.extract_component(logs[i+1])

            if src and dst:
                self.transitions[(src, dst)] += 1

    def extract_component(self, log):

        components = ["DMC", "MMG", "SMSC", "SMPP"]

        for c in components:
            if c in log:
                return c

        return None

    def build_topology(self):

        edges = []

        for (src, dst), count in self.transitions.items():

            if count > 5:
                edges.append((src, dst))

        return edges