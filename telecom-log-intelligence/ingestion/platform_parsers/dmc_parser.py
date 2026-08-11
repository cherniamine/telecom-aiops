import re
from datetime import datetime


class DMCParser:

    def __init__(self):
        self.platform = "DMC"

    # =====================================================
    # MAIN ENTRY
    # =====================================================

    def parse_line(self, line, source_file="server"):

        if not line.strip():
            return None

        # ignore Java stacktrace
        if line.strip().startswith("at "):
            return None

        if source_file.startswith("server") or "jboss" in source_file:
            return self._parse_server_log(line)

        elif "dmc_business_soap" in source_file:
            return self._parse_business_soap(line)

        elif "activity.log" in source_file:
            return self._parse_activity_log(line)

        elif "add_backend.log" in source_file:
            return self._parse_add_backend(line)

        elif "delivered_content.log" in source_file:
            return self._parse_delivered_content(line)

        elif "eir_ceirn.log" in source_file:
            return self._parse_eir_ceirn(line)

        elif "mobile_binding_change.log" in source_file:
            return self._parse_mobile_binding(line)

        elif "profile_association.log" in source_file:
            return self._parse_profile_association(line)

        elif "scenario_op_delivered.log" in source_file:
            return self._parse_scenario_delivered(line)

        else:
            return self._default_log(line)

    # =====================================================
    # SERVER LOG
    # =====================================================

    def _parse_server_log(self, line):

        pattern = r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d+)\s+(INFO|WARN|ERROR|WARNING)\s+\[([^\]]+)\]"
        match = re.match(pattern, line)

        if not match:
            return None

        timestamp_str, level, service = match.groups()

        timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S,%f")

        error_type = None
        severity = level

        if "IJ000612" in line:
            error_type = "DB_CONNECTION_POOL"

        elif "IJ000460" in line:
            error_type = "TRANSACTION_CHECK_ERROR"

        elif "ArrayIndexOutOfBoundsException" in line:
            error_type = "JAVA_ARRAY_EXCEPTION"

        elif "EJBTransactionRolledbackException" in line:
            error_type = "EJB_TRANSACTION_ERROR"

        elif "UT005023" in line:
            error_type = "UNDERTOW_REQUEST_EXCEPTION"

        elif "Session" in line and "not found" in line:
            error_type = "SESSION_NOT_FOUND"

        elif "JSF1091" in line:
            error_type = "JSF_MIME_WARNING"

        elif "JSF1064" in line:
            error_type = "JSF_RESOURCE_WARNING"

        elif "PBOX000234" in line:
            error_type = "SECURITY_CONFIG_WARNING"

        elif "Failed to get the subdirs" in line:
            error_type = "RESOURCE_DIRECTORY_ERROR"

        return {
            "timestamp": timestamp,
            "platform": self.platform,
            "node": "DMC_SERVER",
            "service": service,
            "severity": severity,
            "event_type": error_type,
            "message": line.strip(),
            "raw_line": line
        }

    # =====================================================
    # BUSINESS SOAP
    # =====================================================

    def _parse_business_soap(self, line):

        parts = line.strip().split(",")

        if len(parts) < 8:
            return None

        try:
            timestamp = datetime.strptime(parts[0], "%Y-%m-%dT%H:%M:%S+0100")
        except:
            return None

        api = parts[6]
        duration = parts[-1]

        return {
            "timestamp": timestamp,
            "platform": self.platform,
            "node": "DMC_SOAP",
            "service": api,
            "severity": "INFO",
            "event_type": "SOAP_API_CALL",
            "message": f"{api} duration={duration}ms",
            "raw_line": line
        }

    # =====================================================
    # ACTIVITY
    # =====================================================

    def _parse_activity_log(self, line):

        parts = [p.strip('"') for p in line.split(",")]

        if len(parts) < 8:
            return None

        try:
            timestamp = datetime.strptime(parts[0], "%m/%d/%Y %H:%M:%S.%f")
        except:
            return None

        action = parts[7]

        return {
            "timestamp": timestamp,
            "platform": self.platform,
            "node": "DMC_ACTIVITY",
            "service": action,
            "severity": "INFO",
            "event_type": "USER_ACTIVITY",
            "message": line.strip(),
            "raw_line": line
        }

    # =====================================================
    # ADD BACKEND
    # =====================================================

    def _parse_add_backend(self, line):

        parts = [p.strip('"') for p in line.split(",")]

        if len(parts) < 8:
            return None

        timestamp = datetime.strptime(parts[0], "%m/%d/%Y %H:%M:%S.%f")

        imei = parts[6]
        msisdn = parts[7]

        return {
            "timestamp": timestamp,
            "platform": self.platform,
            "node": "DMC_BACKEND",
            "service": "ADD_BACKEND",
            "severity": "INFO",
            "event_type": "DEVICE_REGISTRATION",
            "message": f"IMEI={imei} MSISDN={msisdn}",
            "raw_line": line
        }

    # =====================================================
    # DELIVERY
    # =====================================================

    def _parse_delivered_content(self, line):

        parts = [p.strip('"') for p in line.split(",")]

        if len(parts) < 9:
            return None

        timestamp = datetime.strptime(parts[0], "%m/%d/%Y %H:%M:%S.%f")

        status = parts[8]

        return {
            "timestamp": timestamp,
            "platform": self.platform,
            "node": "DMC_DELIVERY",
            "service": "CONTENT_DELIVERY",
            "severity": "INFO",
            "event_type": "CONTENT_DELIVERED",
            "message": f"status={status}",
            "raw_line": line
        }

    # =====================================================
    # CEIR
    # =====================================================

    def _parse_eir_ceirn(self, line):

        pattern = r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d+)\s+(INFO|WARN|ERROR)"
        match = re.match(pattern, line)

        if not match:
            return None

        timestamp_str, level = match.groups()

        timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S,%f")

        event = "CEIR_EVENT"

        if "EXCEPTION" in line:
            event = "CEIR_EXCEPTION"

        return {
            "timestamp": timestamp,
            "platform": self.platform,
            "node": "DMC_CEIR",
            "service": "CEIR",
            "severity": level,
            "event_type": event,
            "message": line.strip(),
            "raw_line": line
        }

    # =====================================================
    # OTHER BUSINESS LOGS
    # =====================================================

    def _parse_mobile_binding(self, line):
        return self._generic_business(line, "MOBILE_BINDING")

    def _parse_profile_association(self, line):
        return self._generic_business(line, "PROFILE_ASSOCIATION")

    def _parse_scenario_delivered(self, line):
        return self._generic_business(line, "SCENARIO_DELIVERED")

    def _generic_business(self, line, service):

        parts = [p.strip('"') for p in line.split(",")]

        if len(parts) < 2:
            return None

        try:
            timestamp = datetime.strptime(parts[0], "%m/%d/%Y %H:%M:%S.%f")
        except:
            return None

        return {
            "timestamp": timestamp,
            "platform": self.platform,
            "node": "DMC_BUSINESS",
            "service": service,
            "severity": "INFO",
            "event_type": service,
            "message": line.strip(),
            "raw_line": line
        }

    # =====================================================
    # DEFAULT
    # =====================================================

    def _default_log(self, line):

        return {
            "timestamp": None,
            "platform": self.platform,
            "node": "UNKNOWN",
            "service": None,
            "severity": "INFO",
            "event_type": "UNKNOWN",
            "message": line.strip(),
            "raw_line": line
        }