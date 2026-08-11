import datetime


class LogNormalizer:
    def __init__(self):
        pass

    def normalize(self, log):
        """
        Normalize different log formats into a unified schema
        """

        normalized_log = {
            "timestamp": self.extract_timestamp(log),
            "source_ip": self.extract_source_ip(log),
            "destination_ip": self.extract_destination_ip(log),
            "user": self.extract_user(log),
            "event_type": self.extract_event_type(log),
            "status": self.extract_status(log),
            "raw_log": log
        }

        return normalized_log


    # ----------------------------
    # Field Extractors
    # ----------------------------

    def extract_timestamp(self, log):
        if "timestamp" in log:
            return log["timestamp"]

        if "time" in log:
            return log["time"]

        return datetime.datetime.utcnow().isoformat()


    def extract_source_ip(self, log):
        if "src_ip" in log:
            return log["src_ip"]

        if "source_ip" in log:
            return log["source_ip"]

        if "client_ip" in log:
            return log["client_ip"]

        return None


    def extract_destination_ip(self, log):
        if "dest_ip" in log:
            return log["dest_ip"]

        if "destination_ip" in log:
            return log["destination_ip"]

        if "server_ip" in log:
            return log["server_ip"]

        return None


    def extract_user(self, log):
        if "user" in log:
            return log["user"]

        if "username" in log:
            return log["username"]

        if "account" in log:
            return log["account"]

        return None


    def extract_event_type(self, log):
        if "event_type" in log:
            return log["event_type"]

        if "action" in log:
            return log["action"]

        if "event" in log:
            return log["event"]

        return "unknown"


    def extract_status(self, log):
        if "status" in log:
            return log["status"]

        if "result" in log:
            return log["result"]

        if "outcome" in log:
            return log["outcome"]

        return "unknown"