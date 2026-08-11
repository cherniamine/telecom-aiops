import re
from datetime import datetime


class MMGParser:

    def __init__(self):

        # application.log pattern
        self.app_pattern = re.compile(
            r'^(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d+) '
            r'\[(?P<thread>[^\]]+)\] '
            r'(?P<level>INFO|WARN|ERROR|DEBUG) '
            r'(?P<component>[\w\.\-]+) - '
            r'(?P<message>.*)'
        )

    def parse(self, line, source_file=None):

        # -------- APPLICATION LOG --------
        match = self.app_pattern.match(line)

        if match:
            data = match.groupdict()

            try:
                timestamp = datetime.strptime(
                    data["timestamp"],
                    "%Y-%m-%d %H:%M:%S,%f"
                )
            except:
                timestamp = None

            return {
                "timestamp": timestamp,
                "level": data["level"],
                "component": data["component"],
                "thread": data["thread"],
                "message": data["message"],
                "platform": "MMG",
                "source_file": source_file,
                "raw_message": line
            }

        # -------- ALERT LOG --------
        if ";" in line:

            parts = line.split(";")

            if len(parts) >= 6:

                try:
                    timestamp = datetime.strptime(
                        parts[0],
                        "%Y-%m-%d %H:%M:%S,%f"
                    )
                except:
                    timestamp = None

                return {
                    "timestamp": timestamp,
                    "level": "ALERT",
                    "component": parts[3],
                    "thread": None,
                    "message": parts[-1],
                    "alert_state": parts[2],
                    "platform": "MMG",
                    "source_file": source_file,
                    "raw_message": line
                }

        return None