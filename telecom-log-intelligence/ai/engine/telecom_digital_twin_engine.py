import networkx as nx

class TelecomDigitalTwinEngine:

    def __init__(self):

        self.network = nx.DiGraph()

    def add_link(self, src, dst):

        self.network.add_edge(src, dst)

    def simulate_failure(self, node):

        affected = list(nx.descendants(self.network, node))

        return {
            "failed_node": node,
            "impacted_nodes": affected
        }