import re


class LogCleaner:
    """
    Clean raw log lines before parsing.

    Responsibilities:
    - remove empty lines
    - remove raw hex dumps
    - remove non-printable characters
    - normalize spaces
    """

    def __init__(self):
        pass

    # ==========================================
    # MAIN CLEAN FUNCTION
    # ==========================================
    def clean_line(self, line):

        if line is None:
            return None

        # remove leading/trailing spaces
        line = line.strip()

        if not line:
            return None

        # remove non printable characters
        line = self._remove_non_printable(line)

        # ignore hex dumps
        if self._is_hex_dump(line):
            return None

        # normalize multiple spaces
        line = re.sub(r"\s+", " ", line)

        # ignore extremely long corrupted logs
        if len(line) > 5000:
            return None

        return line

    # ==========================================
    # Detect Hex Dump (SMPP / binary dumps)
    # ==========================================
    def _is_hex_dump(self, line):
        """
        Detect hex dump lines like:

        00000000  00 00 00 3C 00 00 00 04 00 00
        """

        hex_dump_pattern = r"^[0-9A-Fa-f]{6,}\s+([0-9A-Fa-f]{2}\s+){6,}"

        return bool(re.match(hex_dump_pattern, line))

    # ==========================================
    # Remove non printable characters
    # ==========================================
    def _remove_non_printable(self, line):
        return re.sub(r"[^\x20-\x7E]", "", line)