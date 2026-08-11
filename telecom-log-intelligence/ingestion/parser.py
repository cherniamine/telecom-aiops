from ingestion.platform_parsers.smsc_parser import parse_smsc_log
from ingestion.platform_parsers.smpp_parser import SMPPParser
from ingestion.platform_parsers.dmc_parser import DMCParser
from ingestion.platform_parsers.mmg_parser import MMGParser


class LogParserRouter:

    def __init__(self):

        self.smpp_parser = SMPPParser()
        self.dmc_parser = DMCParser()
        self.mmg_parser = MMGParser()

    # ==================================================
    # MAIN ROUTER
    # ==================================================

    def parse(self, line, platform, source_file=None):

        platform = platform.upper()

        parsed = None

        # ------------------------------------------
        # SMSC
        # ------------------------------------------

        if platform == "SMSC":

            parsed = parse_smsc_log(
                line,
                source_file=source_file
            )

        # ------------------------------------------
        # SMPP
        # ------------------------------------------

        elif platform in ["SMPPC", "SMPPS", "SMPP"]:

            parsed = self.smpp_parser.parse(
                line,
                source_file=source_file,
                platform=platform
            )

        # ------------------------------------------
        # DMC
        # ------------------------------------------

        elif platform == "DMC":

            parsed = self.dmc_parser.parse_line(
                line,
                source_file
            )

        # ------------------------------------------
        # MMG
        # ------------------------------------------

        elif platform == "MMG":

            parsed = self.mmg_parser.parse(
                line,
                source_file
            )

        else:
            return None

        if not parsed:
            return None

        # ------------------------------------------
        # Normalize common metadata
        # ------------------------------------------

        parsed["platform"] = platform
        parsed["source_file"] = source_file
        parsed["raw_message"] = line

        return parsed