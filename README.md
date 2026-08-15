# Booking
This is a booking app mainly for nails spas

## Running locally

Requires Python 3.11+ and PostgreSQL (with the `pgcrypto` and `btree_gist` extensions available).

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # or .venv/bin/python on macOS/Linux
cp .env.example .env   # then set DATABASE_URL (and WhatsApp vars if you have them)
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m uvicorn app.main:app --reload
```

- API docs: `http://127.0.0.1:8000/docs`
- Public booking widget: `http://127.0.0.1:8000/widget/`
- Staff admin panel: `http://127.0.0.1:8000/admin/`

The database seeds one placeholder tenant ("Salon") on migration -- V1 is single-salon by design. Rename it directly in the `tenants` table once there's a real pilot salon.

### Reminders

`app/reminder_job.py` sends 24h/2h WhatsApp reminders and needs to run periodically (every 15 min is plenty):

```bash
.venv/Scripts/python.exe -m app.reminder_job
```

In production this is meant to run as a scheduled AWS Lambda, not a long-lived process.

### WhatsApp notifications

Without `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` set, notifications log instead of sending (see `app/whatsapp.py`) -- useful for local dev, but real sending requires a verified Meta Business account, a WhatsApp Business Cloud API phone number, and pre-approved message templates.
