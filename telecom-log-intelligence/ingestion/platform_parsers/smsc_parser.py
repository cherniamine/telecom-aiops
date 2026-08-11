import re
from datetime import datetime


# =========================================================
# SYSLOG PATTERN
# =========================================================

LOG_PATTERN = re.compile(
    r'^(?P<month>\w+)\s+'
    r'(?P<day>\d+)\s+'
    r'(?P<time>\d+:\d+:\d+)\s+'
    r'V_(?P<node>\w+)\s+'
    r'(?P<process>[\w\-\[\]0-9]+):\s+'
    r'(?P<message>.*)'
)


MONTH_MAP = {
    "Jan": 1, "Feb": 2, "Mar": 3,
    "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9,
    "Oct": 10, "Nov": 11, "Dec": 12
}


# =========================================================
# EVENT CLASSIFIER
# =========================================================

def classify_event(process, message):

    msg = message.lower()

    # -------------------------
    # DATABASE / CLUSTER
    # -------------------------

    if "failed to connect to database" in msg:
        return "DB_CONNECTION_FAILED", "ERROR"

    if "failed to setup a connection to the cluster manager" in msg:
        return "CLUSTER_CONNECTION_FAILED", "ERROR"

    # -------------------------
    # SMPP ROUTING
    # -------------------------

    if "submit_sm" in msg and "norulematching" in msg:
        return "SMPP_ROUTING_ERROR", "ERROR"

    if "deliveryattemptsexceeded" in msg:
        return "SMPP_DELIVERY_FAILED", "ERROR"

    if "syntax error in smpp submitsm request" in msg:
        return "SMPP_INVALID_SUBMITSM", "ERROR"

    if "validityperiod is in the past" in msg:
        return "SMPP_INVALID_VALIDITY", "ERROR"

    if "destaddress" in msg:
        return "SMPP_INVALID_DEST_ADDRESS", "ERROR"

    # -------------------------
    # SESSION EVENTS
    # -------------------------

    if "outside session closed" in msg:
        return "SMPP_SESSION_CLOSED", "WARNING"

    # -------------------------
    # SNMP TRAPS
    # -------------------------

    if "snmptrapd" in process:
        return "SNMP_TRAP", "INFO"

    # -------------------------
    # SYSTEM EVENTS
    # -------------------------

    if process in [
        "systemd",
        "systemd-logind",
        "rsyslogd",
        "logrotate"
    ]:
        return "SYSTEM_EVENT", "INFO"

    return "UNKNOWN", "INFO"


# =========================================================
# PARSER
# =========================================================

def parse_smsc_log(line, source_file=None):

    match = LOG_PATTERN.match(line)

    if not match:
        return None

    data = match.groupdict()

    # -----------------------------------------------------
    # Timestamp
    # -----------------------------------------------------

    try:

        h, m, s = data["time"].split(":")

        timestamp = datetime(
            year=datetime.now().year,
            month=MONTH_MAP[data["month"]],
            day=int(data["day"]),
            hour=int(h),
            minute=int(m),
            second=int(s)
        )

    except:
        return None

    # -----------------------------------------------------
    # Detect repetition
    # -----------------------------------------------------

    repeat_match = re.search(r'\[(\d+) times\]', data["message"])
    repeat_count = int(repeat_match.group(1)) if repeat_match else 1

    # remove repetition text
    message = re.sub(r'\[\d+ times\]', '', data["message"]).strip()

    # -----------------------------------------------------
    # Event classification
    # -----------------------------------------------------

    event_type, severity = classify_event(
        data["process"],
        message
    )

    return {

        "timestamp": timestamp,
        "platform": "SMSC",
        "node": data["node"],

        "process": data["process"],

        "event_type": event_type,
        "severity": severity,

        "repeat_count": repeat_count,

        "message": message,

        "source_file": source_file,

        "raw_log": line.strip()
    }