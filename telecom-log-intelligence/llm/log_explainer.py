from llm.explainer import IncidentExplainer


class LogExplainer(IncidentExplainer):

    def explain(self, incident_data):
        response = self.explain_incident(incident_data)

        return "\n".join(
            [
                "Manager Summary",
                response["manager_summary"],
                "",
                "Technical Explanation",
                response["technical_explanation"],
                "",
                "Recommended Action",
                response["recommended_action"],
            ]
        )
