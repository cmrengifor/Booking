"""Notification sending and reminder scheduling.

Confirmation/cancellation notifications are sent synchronously right
after the triggering booking action (best-effort -- a WhatsApp failure
never rolls back the appointment). Reminders are inherently
time-triggered rather than event-triggered, so they're handled by
schedule_reminders + process_pending_notifications, meant to run
periodically via app/reminder_job.py (an AWS Lambda on a schedule per
the brief's architecture, or a local cron while testing).
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Appointment, Client, Notification, Staff, Tenant
from app.whatsapp import TEMPLATE_NAMES, send_whatsapp_template

REMINDER_WINDOWS = {
    "reminder_24h": timedelta(hours=24),
    "reminder_2h": timedelta(hours=2),
}


def send_notification(db: Session, notification: Notification) -> None:
    appt = db.get(Appointment, notification.appointment_id)
    client = db.get(Client, appt.client_id)
    staff = db.get(Staff, appt.staff_id)
    tenant = db.get(Tenant, appt.tenant_id)

    template_name = TEMPLATE_NAMES.get(notification.type)
    local_time = appt.start_time.astimezone(ZoneInfo(tenant.timezone))
    params = [client.name, local_time.strftime("%d/%m/%Y %H:%M"), staff.name, tenant.name]

    success, detail = send_whatsapp_template(client.phone, template_name, params)
    notification.status = "sent" if success else "failed"
    notification.sent_at = datetime.now(timezone.utc) if success else None
    db.commit()


def process_pending_notifications(db: Session) -> int:
    pending = db.execute(select(Notification).where(Notification.status == "pending")).scalars().all()
    for notification in pending:
        send_notification(db, notification)
    return len(pending)


def schedule_reminders(db: Session) -> int:
    """Create pending reminder notifications for confirmed appointments
    that have just entered their 24h or 2h window and don't already
    have one queued or sent.
    """
    now = datetime.now(timezone.utc)
    created = 0
    for notif_type, window in REMINDER_WINDOWS.items():
        due = db.execute(
            select(Appointment).where(
                Appointment.status == "confirmed",
                Appointment.start_time > now,
                Appointment.start_time <= now + window,
            )
        ).scalars().all()
        for appt in due:
            already_queued = db.execute(
                select(Notification).where(
                    Notification.appointment_id == appt.id, Notification.type == notif_type
                )
            ).scalar_one_or_none()
            if already_queued:
                continue
            db.add(Notification(appointment_id=appt.id, channel="whatsapp", type=notif_type))
            created += 1
    db.commit()
    return created
