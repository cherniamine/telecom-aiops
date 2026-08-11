import networkx as nx

class TelecomGNNRCAEngine:

    def __init__(self):

        self.graph = nx.DiGraph()

    def build_graph(self, relations):

        for src, dst in relations:
            self.graph.add_edge(src, dst)

    def find_root_cause(self, faulty_nodes):

        scores = {}

        for node in faulty_nodes:

            ancestors = nx.ancestors(self.graph, node)

            for a in ancestors:
                scores[a] = scores.get(a, 0) + 1

        if not scores:
            return None

        return max(scores, key=scores.get)