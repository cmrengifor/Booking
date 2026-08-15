"""Thin client for the WhatsApp Business Cloud API.

Real sending requires: a Meta Business account verified for WhatsApp
Business, a phone number registered on the Cloud API, a permanent
access token, and message templates pre-approved by Meta (outbound
proactive messages -- confirmations, reminders -- are only allowed via
approved templates outside an open 24h customer-service window). None
of that can be set up from code; until WHATSAPP_ACCESS_TOKEN and
WHATSAPP_PHONE_NUMBER_ID are configured, send_whatsapp_template logs
instead of sending, so the rest of the notification pipeline is fully
testable without real credentials.
"""
import logging

import requests

from app.config import settings

logger = logging.getLogger("whatsapp")
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(logging.StreamHandler())

# Template names as registered (and approved by Meta) in the WhatsApp
# Business Manager. These are placeholders -- swap for whatever the
# real approved template names end up being.
TEMPLATE_NAMES = {
    "confirmation": "appointment_confirmation",
    "reminder_24h": "appointment_reminder_24h",
    "reminder_2h": "appointment_reminder_2h",
    "cancellation": "appointment_cancellation",
}


def is_configured() -> bool:
    return bool(settings.whatsapp_access_token and settings.whatsapp_phone_number_id)


def send_whatsapp_template(to_phone: str, template_name: str, body_params: list[str]) -> tuple[bool, str]:
    """Send a WhatsApp template message. Returns (success, detail).

    In dev (no credentials configured), logs what would have been sent
    and returns success=True so the rest of the pipeline (status
    tracking, etc.) behaves exactly as it would in production.
    """
    if not is_configured():
        logger.info("[whatsapp:dev] to=%s template=%s params=%s", to_phone, template_name, body_params)
        return True, "dev-logged (no WhatsApp credentials configured)"

    url = f"https://graph.facebook.com/{settings.whatsapp_api_version}/{settings.whatsapp_phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": "es"},
            "components": [
                {"type": "body", "parameters": [{"type": "text", "text": p} for p in body_params]}
            ],
        },
    }
    headers = {"Authorization": f"Bearer {settings.whatsapp_access_token}"}
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        resp.raise_for_status()
        return True, resp.text
    except requests.RequestException as e:
        logger.error("[whatsapp] send failed to=%s template=%s: %s", to_phone, template_name, e)
        return False, str(e)
