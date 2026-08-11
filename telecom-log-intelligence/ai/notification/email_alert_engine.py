import datetime
import os
import smtplib
import ssl

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv


class EmailAlertEngine:
    _auth_failure_detected = False

    def __init__(self):
        load_dotenv()

        self.smtp_server = os.getenv(
            "EMAIL_ALERT_SMTP_SERVER",
            "smtp.gmail.com",
        )
        self.smtp_port = int(
            os.getenv(
                "EMAIL_ALERT_SMTP_PORT",
                "587",
            )
        )
        self.sender_email = self._clean_env_value(
            os.getenv("EMAIL_ALERT_SENDER", "")
        )
        self.sender_password = self._clean_secret(
            os.getenv("EMAIL_ALERT_PASSWORD", "")
        )
        recipients = os.getenv("EMAIL_ALERT_RECIPIENTS", "")
        self.recipients = [
            self._clean_env_value(recipient)
            for recipient in recipients.split(",")
            if self._clean_env_value(recipient)
        ]

    def _clean_env_value(self, value):
        return str(value or "").strip().strip("\"'")

    def _clean_secret(self, value):
        cleaned_value = self._clean_env_value(value)
        return "".join(cleaned_value.split())

    def is_configured(self):
        return bool(
            self.sender_email
            and self.sender_password
            and self.recipients
        )

    def _format_propagation_text(self, propagation_path):
        return " -> ".join(propagation_path or []) or "Unknown"

    def _estimate_technical_risks(self, root_cause_text):
        root_cause_text = str(root_cause_text or "").lower()

        risks = {}

        if "queue" in root_cause_text:
            risks["Queue saturation probability"] = "82%"

        if "retry" in root_cause_text:
            risks["Retry storm amplification"] = "65%"

        if "timeout" in root_cause_text:
            risks["Timeout cascade risk"] = "41%"

        if "refused" in root_cause_text:
            risks["Routing rejection probability"] = "37%"

        if "disconnect" in root_cause_text:
            risks["Session instability probability"] = "52%"

        if "fail" in root_cause_text:
            risks["Connector failure probability"] = "73%"

        if not risks:
            risks["General instability probability"] = "25%"

        return risks

    def _format_risk_section_plain(self, risks):
        text = "\nLikely Technical Risk Signals\n"

        for label, value in risks.items():
            text += f"{label}: {value}\n"

        return text.rstrip()

    def _format_risk_section_html(self, risks):
        html = """
<div style="margin-top:16px;border:1px solid #fee2e2;border-radius:18px;padding:20px;background:#fff5f5;">
  <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#7f1d1d;">
    Likely Technical Risk Signals
  </div>
"""

        for label, value in risks.items():
            html += f"""
  <div style="margin-top:8px;font-size:15px;font-weight:600;color:#7c2d12;">
    {label}: {value}
  </div>
"""

        html += "\n</div>"

        return html

    def _format_plain_body(
        self,
        severity,
        propagation_text,
        root_cause_text,
        impact_text,
        duration_text,
    ):
        risks = self._estimate_technical_risks(root_cause_text)
        risk_section = self._format_risk_section_plain(risks)

        return f"""
Telecom AI Observability Alert

Severity: {severity}

Propagation:
{propagation_text}

Root cause:
{root_cause_text}

Service impact Level:
{impact_text}

Estimated resolution time:
{duration_text} minutes

{risk_section}

Action required immediately.

Generated automatically by AI-assisted telecom incident diagnosis and remediation system on {datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%d %H:%M:%S UTC')}
""".strip()

    def _format_html_body(
        self,
        severity,
        propagation_text,
        root_cause_text,
        impact_text,
        duration_text,
    ):
        severity_color = {
            "CRITICAL": "#dc2626",
            "HIGH": "#ea580c",
            "MEDIUM": "#d97706",
        }.get(str(severity or "").upper(), "#2563eb")
        risks = self._estimate_technical_risks(root_cause_text)
        risk_section_html = self._format_risk_section_html(risks)

        return f"""
<html>
  <body style="margin:0;padding:0;background:#edf2f7;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf2f7;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.12);">
            <tr>
              <td style="padding:32px;background:#eaf2ff;background-image:linear-gradient(135deg,#f8fbff 0%,#dbeafe 100%);color:#0f172a;border-bottom:1px solid #dbeafe;">
                <div style="font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#1d4ed8;font-weight:700;">
                  AI-assisted telecom incident diagnosis and remediation
                </div>
                <div style="margin-top:12px;font-size:30px;font-weight:700;line-height:1.2;color:#0f172a;">
                  Incident Detected
                </div>
                <div style="margin-top:18px;display:inline-block;padding:8px 14px;border-radius:999px;background:{severity_color};color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.4px;">
                  Severity: {severity}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 10px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:0 8px 16px 0;" width="50%">
                      <div style="border:1px solid #e2e8f0;border-radius:16px;padding:18px;background:#f8fafc;">
                        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Service Impact Level</div>
                        <div style="margin-top:8px;font-size:22px;font-weight:700;color:#0f172a;">{impact_text}</div>
                      </div>
                    </td>
                    <td style="padding:0 0 16px 8px;" width="50%">
                      <div style="border:1px solid #e2e8f0;border-radius:16px;padding:18px;background:#f8fafc;">
                        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Estimated Recovery Time</div>
                        <div style="margin-top:8px;font-size:22px;font-weight:700;color:#0f172a;">{duration_text} min</div>
                      </div>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:10px;border:1px solid #dbeafe;border-radius:18px;padding:20px;background:#f8fbff;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#475569;">Propagation Path</div>
                  <div style="margin-top:10px;font-size:18px;font-weight:600;color:#0f172a;line-height:1.5;">
                    {propagation_text}
                  </div>
                </div>
                <div style="margin-top:16px;border:1px solid #e2e8f0;border-radius:18px;padding:20px;background:#ffffff;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#475569;">Root Cause Signals</div>
                  <div style="margin-top:10px;font-size:17px;font-weight:600;color:#0f172a;line-height:1.6;">
                    {root_cause_text}
                  </div>
                </div>
                {risk_section_html}
                <div style="margin-top:16px;padding:18px 20px;border-left:4px solid {severity_color};background:#fff7ed;border-radius:14px;color:#7c2d12;font-size:15px;line-height:1.6;">
                  Action required immediately. Review the affected telecom chain, confirm corrective actions, and validate service recovery.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 28px 32px;font-size:12px;color:#64748b;">
                Generated automatically by AI-assisted telecom incident diagnosis and remediation system on {datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%d %H:%M:%S UTC')}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".strip()

    def send_alert(
        self,
        severity,
        propagation_path,
        root_cause,
        impact,
        duration,
    ):
        if not self.is_configured():
            print(
                "Email alert skipped: email configuration is incomplete."
            )
            return False

        if self.__class__._auth_failure_detected:
            print(
                "Email alert skipped: previous SMTP authentication failure "
                "detected. Fix email credentials and restart the process."
            )
            return False

        try:
            subject = f"[{severity}] Telecom Incident Detected"
            propagation_text = self._format_propagation_text(
                propagation_path
            )
            root_cause_text = root_cause or "unknown"
            duration_text = (
                str(duration)
                if duration is not None
                else "unknown"
            )
            impact_text = impact or "unknown"
            plain_body = self._format_plain_body(
                severity,
                propagation_text,
                root_cause_text,
                impact_text,
                duration_text,
            )
            html_body = self._format_html_body(
                severity,
                propagation_text,
                root_cause_text,
                impact_text,
                duration_text,
            )

            msg = MIMEMultipart("alternative")
            msg["From"] = self.sender_email
            msg["To"] = ", ".join(self.recipients)
            msg["Subject"] = subject
            msg.attach(MIMEText(plain_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(
                self.smtp_server,
                self.smtp_port,
            ) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                server.login(
                    self.sender_email,
                    self.sender_password,
                )
                server.sendmail(
                    self.sender_email,
                    self.recipients,
                    msg.as_string(),
                )

            print("Email alert sent successfully")
            return True
        except smtplib.SMTPAuthenticationError as error:
            self.__class__._auth_failure_detected = True
            print(
                "Email alert failed: Gmail authentication rejected. "
                "Verify EMAIL_ALERT_SENDER, enable 2-Step Verification, "
                "use a valid Gmail App Password, and remove quotes/spaces "
                "from EMAIL_ALERT_PASSWORD."
            )
            print(f"SMTP details: {error}")
            return False
        except Exception as error:
            print(f"Email alert failed: {error}")
            return False
