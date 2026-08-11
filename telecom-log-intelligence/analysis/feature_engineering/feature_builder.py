from .feature_utils import FeatureUtils


class FeatureBuilder:

    def build_features(self, log):

        if not log:
            return None

        features = {}

        raw = log.get("raw_log", {})

        # =============================
        # TIMESTAMP
        # =============================

        timestamp = raw.get("timestamp") or log.get("timestamp")

        time_features = FeatureUtils.extract_time_features(timestamp)

        features.update(time_features)

        # =============================
        # MESSAGE
        # =============================

        message = raw.get("message")

        features["message_length"] = FeatureUtils.message_length(message)

        # =============================
        # SEVERITY
        # =============================

        severity = (
            raw.get("severity")
            or raw.get("level")
            or raw.get("log_level")
        )

        features["is_error"] = FeatureUtils.is_error(severity)

        features["is_warning"] = FeatureUtils.is_warning(severity)

        # =============================
        # PLATFORM
        # =============================

        features["platform"] = raw.get("platform", "unknown")

        # =============================
        # EVENT TYPE
        # =============================

        features["event_type"] = raw.get("event_type") or log.get("event_type")

        # =============================
        # SOURCE FILE
        # =============================

        features["source_file"] = raw.get("source_file", "unknown")

        return features