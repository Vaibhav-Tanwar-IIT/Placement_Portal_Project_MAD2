"""Tiny SMTP helper. Delivery failures are logged, never raised."""
import logging
import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import Config

log = logging.getLogger(__name__)


def send_email(to, subject, html_body):
    """Try SMTP (MailHog by default). Always keep a copy on disk under outbox/."""
    outbox = os.path.join(Config.REPORTS_DIR, "outbox")
    os.makedirs(outbox, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    safe_to = to.replace("@", "_at_").replace("/", "_")
    path = os.path.join(outbox, f"{stamp}_{safe_to}.html")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(f"<!-- To: {to}\n     Subject: {subject} -->\n{html_body}")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = Config.MAIL_SENDER
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=5) as server:
            if Config.SMTP_USER:
                server.starttls()
                server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
            server.send_message(msg)
        return True, path
    except Exception as exc:
        log.warning("SMTP delivery to %s failed (%s); saved to %s", to, exc, path)
        return False, path
