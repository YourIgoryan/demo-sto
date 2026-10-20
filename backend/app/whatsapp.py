"""WhatsApp Cloud API notifications for new AutoStudio bookings."""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)


def notify_booking_whatsapp(booking: dict[str, Any]) -> bool:
    """Send a template notification; return False when disabled or on failure.

    Notification failures are deliberately swallowed so a booking already saved
    to SQLite remains successful even if Meta's API is unavailable.
    """
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "").strip()
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    recipient = os.getenv("WHATSAPP_RECIPIENT_PHONE", "").strip()
    template_name = os.getenv("WHATSAPP_TEMPLATE_NAME", "booking_notification").strip()
    language = os.getenv("WHATSAPP_TEMPLATE_LANGUAGE", "ru").strip()
    api_version = os.getenv("WHATSAPP_GRAPH_API_VERSION", "v23.0").strip()

    if not all((token, phone_number_id, recipient, template_name, language, api_version)):
        logger.info("WhatsApp notification skipped: credentials are not configured.")
        return False

    raw_start = str(booking.get("start_at") or "")
    try:
        start = datetime.fromisoformat(raw_start.replace("Z", "+00:00")).strftime("%d.%m.%Y в %H:%M")
    except (ValueError, TypeError):
        start = raw_start or "не указано"

    parameters = [
        {"type": "text", "parameter_name": "customer_name",
         "text": str(booking.get("customer_name") or "Не указано")},
        {"type": "text", "parameter_name": "service_title",
         "text": str(booking.get("service_title") or "Не указано")},
        {"type": "text", "parameter_name": "booking_time",
         "text": start},
        {"type": "text", "parameter_name": "car",
         "text": str(booking.get("car") or "Не указан")},
        {"type": "text", "parameter_name": "phone",
         "text": str(booking.get("phone") or "Не указан")},
    ]

    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language},
            "components": [{
                "type": "body",
                "parameters": parameters,
            }],
        },
    }
    url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"

    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=8.0,
        )
        if response.is_error:
            # Never log the access token. Keep the response excerpt short.
            logger.error(
                "WhatsApp notification failed: HTTP %s; response=%s",
                response.status_code, response.text[:1000],
            )
            return False
    except httpx.HTTPError:
        logger.exception("WhatsApp notification request failed due to a network/HTTP error.")
        return False

    logger.info("WhatsApp booking notification accepted by Meta API.")
    return True
