from datetime import datetime


class FeatureUtils:

    # =============================
    # TIME FEATURES
    # =============================

    @staticmethod
    def extract_time_features(timestamp):

        if not timestamp:
            return {}

        if isinstance(timestamp, str):

            try:
                timestamp = datetime.fromisoformat(timestamp)
            except Exception:
                return {}

        if not isinstance(timestamp, datetime):
            return {}

        return {
            "hour": timestamp.hour,
            "day": timestamp.day,
            "month": timestamp.month,
            "weekday": timestamp.weekday(),
            "is_weekend": timestamp.weekday() >= 5
        }

    # =============================
    # MESSAGE LENGTH
    # =============================

    @staticmethod
    def message_length(message):

        if not message:
            return 0

        return len(str(message))

    # =============================
    # ERROR FLAG
    # =============================

    @staticmethod
    def is_error(severity):

        if not severity:
            return False

        severity = severity.upper()

        return severity in [
            "ERROR",
            "CRITICAL",
            "FATAL",
            "ALERT"
        ]

    # =============================
    # WARNING FLAG
    # =============================

    @staticmethod
    def is_warning(severity):

        if not severity:
            return False

        severity = severity.upper()

        return severity in [
            "WARN",
            "WARNING"
        ]