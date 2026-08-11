from collections import defaultdict


class IncidentTimelineEngine:

    def build_timeline(self, logs):

        timeline = defaultdict(int)

        for log in logs:

            if "timestamp" not in log:
                continue

            ts = log["timestamp"]

            minute = ts[:16]

            timeline[minute] += 1

        result = []

        for t in sorted(timeline):

            result.append({

                "time": t,
                "events": timeline[t]
            })

        return result