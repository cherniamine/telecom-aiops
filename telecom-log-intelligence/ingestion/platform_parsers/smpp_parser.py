import re
from datetime import datetime


class SMPPParser:

    def __init__(self):

        self.header_pattern = re.compile(
            r'^(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d+) '
            r'\[(?P<thread>[^\]]+)\] '
            r'(?P<level>INFO|WARN|ERROR) '
            r'(?P<service>[\w\.\-]+)'
        )

    # ==================================================
    # MAIN PARSER
    # ==================================================

    def parse(self, line, source_file=None, platform="SMPP"):

        if not line.strip():
            return None

        match = self.header_pattern.match(line)

        if not match:
            return None

        data = match.groupdict()

        timestamp = datetime.strptime(
            data["timestamp"],
            "%Y-%m-%d %H:%M:%S,%f"
        )

        thread = data["thread"]
        level = data["level"]
        service = data["service"]

        # ------------------------------------------------
        # Extract node (SMSR1 / SMSR2 / SPL_SYSCOMEDIA)
        # ------------------------------------------------

        node_match = re.search(
            r"smpp(client|server)container\.(\w+)\.",
            service
        )

        node = node_match.group(2) if node_match else "UNKNOWN"

        # ------------------------------------------------
        # Packet direction
        # ------------------------------------------------

        direction = None

        if "writePacket" in line:
            direction = "OUT"

        elif "readPacket" in line:
            direction = "IN"

        # ------------------------------------------------
        # Packet length
        # ------------------------------------------------

        length_match = re.search(r"Len\s*:\s*(\d+)", line)

        packet_length = int(length_match.group(1)) if length_match else None

        # ------------------------------------------------
        # MESSAGE TYPE
        # ------------------------------------------------

        message_type = self._detect_message_type(packet_length)

        # ------------------------------------------------
        # ERROR TYPE
        # ------------------------------------------------

        error_type = self._detect_error(line)

        return {
            "timestamp": timestamp,
            "platform": platform,
            "node": node,
            "thread": thread,
            "log_level": level,
            "service": service,
            "direction": direction,
            "packet_length": packet_length,
            "message_type": message_type,
            "error_type": error_type,
            "source_file": source_file,
            "raw_message": line
        }

    # ==================================================
    # MESSAGE TYPE DETECTION
    # ==================================================

    def _detect_message_type(self, packet_length):

        if not packet_length:
            return None

        if packet_length <= 16:
            return "enquire_link"

        if 17 <= packet_length <= 30:
            return "submit_sm_resp"

        if 31 <= packet_length <= 120:
            return "submit_sm"

        if 121 <= packet_length <= 200:
            return "deliver_sm"

        if packet_length > 200:
            return "long_sms"

        return "unknown"

    # ==================================================
    # ERROR DETECTION
    # ==================================================

    def _detect_error(self, line):

        line_lower = line.lower()

        if "broken pipe" in line_lower:
            return "SMPP_SOCKET_BROKEN"

        if "connection reset" in line_lower:
            return "SMPP_CONNECTION_RESET"

        if "bindexception" in line_lower:
            return "SMPP_PORT_ALREADY_USED"

        if "wronglengthofstringexception" in line_lower:
            return "SMPP_PROTOCOL_DECODE_ERROR"

        if "unable to send packet" in line_lower:
            return "SMPP_SEND_FAILURE"

        if "connection was closed by other side" in line_lower:
            return "SMPP_REMOTE_CLOSE"

        return None