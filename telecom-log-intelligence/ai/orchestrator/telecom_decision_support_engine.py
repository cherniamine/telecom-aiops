from datetime import datetime


class TelecomDecisionSupportEngine:

    def __init__(self):
        pass

    # ------------------------------------------------

    def build_incident_report(
        self,
        anomalies,
        rca,
        telecom_rca,
        alerts
    ):

        report = {
            "timestamp": datetime.utcnow(),
            "incident_summary": {
                "total_anomalies": len(anomalies),
                "alerts": len(alerts)
            },
            "root_cause_analysis": rca,
            "telecom_dependency_analysis": telecom_rca,
            "recommended_actions": self._generate_actions(rca),
            "status": "WAITING_HUMAN_VALIDATION"
        }

        return report

    # ------------------------------------------------

    def _generate_actions(self, rca):
        actions = []

        # Handle case where rca is None or empty
        if not rca:
            return ["Investigate logs manually - No RCA data available"]

        # Get root_causes with safe access
        causes = rca.get("root_causes", [])
        
        # ROBUST CHECK: Verify causes is a list
        if not isinstance(causes, list):
            return ["Investigate logs manually - Invalid RCA format"]
        
        # Process each cause with safe item access
        for item in causes:
            # Skip if item is not a tuple/list or doesn't have at least 2 elements
            if not isinstance(item, (list, tuple)) or len(item) < 2:
                continue
                
            component = item[0]  # First element is component name
            # count = item[1]    # Second element is count (if needed)
            
            # Convert to string if it's not already
            if not isinstance(component, str):
                component = str(component)
            
            # Check component and add appropriate actions
            if "MMG" in component:
                actions.append("Check MMG queue status")
            elif "SMSC" in component:
                actions.append("Restart SMSC connection pool")
            elif "SMPP" in component:
                actions.append("Verify SMPP sessions")
            elif "DMC" in component:
                actions.append("Check DMC routing configuration")

        # If no actions were generated, add manual investigation
        if not actions:
            actions.append("Perform manual investigation - No automated actions available")

        return actions