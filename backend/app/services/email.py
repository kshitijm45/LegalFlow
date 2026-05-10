"""AWS SES email sender for obligation reminders and workflow notifications."""
from __future__ import annotations

import html
import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings

logger = logging.getLogger(__name__)


def _ses_client():
    return boto3.client(
        "ses",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
    )


def _h(value: str) -> str:
    """HTML-escape a string for safe injection into email HTML."""
    return html.escape(str(value), quote=True)


def send_obligation_reminder(
    *,
    to_email: str,
    obligation_title: str,
    contract_name: str,
    due_date: str | None,
    description: str,
) -> bool:
    """Send a reminder email for a single obligation. Returns True on success."""
    if not settings.ses_from_email:
        logger.warning("ses_from_email not configured — skipping reminder email")
        return False

    obligation_url = f"{settings.frontend_url}/app/obligations"

    # Determine urgency for subject line
    if due_date:
        try:
            from datetime import date
            days_left = (date.fromisoformat(due_date) - date.today()).days
            if days_left < 0:
                urgency = f"OVERDUE by {abs(days_left)} day(s)"
            elif days_left == 0:
                urgency = "Due TODAY"
            elif days_left <= 3:
                urgency = f"Due in {days_left} day(s)"
            else:
                urgency = f"Due {due_date}"
        except ValueError:
            urgency = f"Due {due_date}"
    else:
        urgency = "No due date"

    subject = f"[Carta] {urgency} — {obligation_title}"

    body_text = (
        f"Obligation Reminder\n\n"
        f"{obligation_title}\n"
        f"Contract: {contract_name}\n"
        f"{urgency}\n\n"
        f"{description}\n\n"
        f"View in Carta: {obligation_url}"
    )

    body_html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <div style="background:#4338CA;padding:24px 28px;">
      <p style="color:#c7d2fe;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Carta &middot; Obligation Reminder</p>
      <h1 style="color:#fff;font-size:18px;font-weight:700;margin:0;">{_h(obligation_title)}</h1>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;padding:6px 0;width:110px;">Contract</td>
          <td style="font-size:13px;color:#0f172a;padding:6px 0;">{_h(contract_name)}</td>
        </tr>
        <tr>
          <td style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;padding:6px 0;">Status</td>
          <td style="font-size:13px;color:#0f172a;padding:6px 0;font-weight:600;">{_h(urgency)}</td>
        </tr>
      </table>
      <p style="font-size:13px;color:#475569;line-height:1.6;margin:0 0 24px;">{_h(description)}</p>
      <a href="{_h(obligation_url)}" style="display:inline-block;background:#4338CA;color:#fff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:7px;text-decoration:none;">View in Carta &rarr;</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #e2e8f0;">
      <p style="font-size:11px;color:#94a3b8;margin:0;">You&#39;re receiving this because a reminder was set in Carta. To stop reminders for this obligation, open Carta and clear the reminder date.</p>
    </div>
  </div>
</body>
</html>"""

    try:
        _ses_client().send_email(
            Source=settings.ses_from_email,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": body_text, "Charset": "UTF-8"},
                    "Html":  {"Data": body_html, "Charset": "UTF-8"},
                },
            },
        )
        logger.info("Reminder sent to %s for obligation '%s'", to_email, obligation_title)
        return True
    except (BotoCoreError, ClientError) as exc:
        logger.error("SES send failed: %s", exc)
        return False
