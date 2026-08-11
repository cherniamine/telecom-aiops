import networkx as nx

class AnomalyPropagationEngine:

    def __init__(self, graph):

        self.graph = graph

    def propagate(self, start_node, steps=3):

        affected = set([start_node])
        frontier = [start_node]

        for _ in range(steps):

            next_nodes = []

            for node in frontier:

                neighbors = self.graph.successors(node)

                for n in neighbors:

                    if n not in affected:
                        affected.add(n)
                        next_nodes.append(n)

            frontier = next_nodes

        return list(affected)