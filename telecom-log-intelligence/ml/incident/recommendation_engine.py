class IncidentRecommendationEngine:

    def recommend(self, root_causes):

        recommendations = []

        keywords = [

            rc[0]

            for rc in root_causes.get(
                "root_causes",
                []
            )

        ]


        if "fail" in keywords:

            recommendations.append(
                "Investigate failing telecom components"
            )


        if "timeout" in keywords:

            recommendations.append(
                "Check SMPP session timeout configuration"
            )


        if "queue full" in keywords:

            recommendations.append(
                "Increase SMSC queue capacity"
            )


        if "retry" in keywords:

            recommendations.append(
                "Analyze retry storm amplification"
            )


        if "disconnect" in keywords:

            recommendations.append(
                "Inspect unstable network connections"
            )


        if "refused" in keywords:

            recommendations.append(
                "Check authentication or routing rejection"
            )


        return recommendations