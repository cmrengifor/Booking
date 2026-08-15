"""Entry point for the scheduled reminder job.

Run periodically -- every 15 min is plenty granular against 24h/2h
reminder windows. Intended deployment is an AWS Lambda on an
EventBridge schedule (per the brief's architecture); for local
development, run it manually or via cron / Windows Task Scheduler:

    python -m app.reminder_job
"""
from app.database import SessionLocal
from app.notifications import process_pending_notifications, schedule_reminders


def run() -> None:
    db = SessionLocal()
    try:
        created = schedule_reminders(db)
        sent = process_pending_notifications(db)
        print(f"Reminder job: {created} reminder(s) queued, {sent} notification(s) processed")
    finally:
        db.close()


if __name__ == "__main__":
    run()
