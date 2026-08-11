import json
from datetime import datetime
from pathlib import Path


class IncidentReportGenerator:

    def generate(self, results):

        report = {

            "generated_at":
            datetime.utcnow().isoformat(),

            "severity":
            results["severity"],

            "total_logs":
            results["total_logs"],

            "total_anomalies":
            results["total_anomalies"],

            "clusters":
            len(results["clusters"]),

            "causal_links":
            len(results["causal_links"]),

            "timeline":
            results["incident_timeline"],

            "impact":
            results.get("impact"),

            "incident_intelligence":
            results.get("incident_intelligence"),

            "root_cause":
            results["root_cause"]

        }


        Path("data/reports").mkdir(
            parents=True,
            exist_ok=True
        )


        output_file = (
            "data/reports/incident_report_latest.json"
        )


        with open(output_file, "w") as f:

            json.dump(
                report,
                f,
                indent=4
            )


        print(
            f"Incident report saved to {output_file}"
        )
