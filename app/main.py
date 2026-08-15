from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import appointments, booking, notifications, reviews, services, staff, tenant

app = FastAPI(title="Nail Salon Booking")

# V1 is single-tenant with no auth yet, so the API is already fully open --
# permissive CORS doesn't add new exposure. The widget is meant to be
# embedded on the salon's own site (a different origin), which needs this.
# Tighten to the salon's actual domain(s) before a real launch.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(services.router)
app.include_router(staff.router)
app.include_router(booking.router)
app.include_router(appointments.router)
app.include_router(notifications.router)
app.include_router(tenant.router)
app.include_router(reviews.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# Only mounted in local dev. On Vercel (and anywhere else with a read-only
# filesystem at runtime) BLOB_READ_WRITE_TOKEN must be set instead, and
# uploaded images are served directly from Vercel Blob's own URLs -- this
# route would 404 for them regardless, and mkdir() would crash the app's
# very first import on a read-only filesystem if not guarded like this.
if not settings.blob_read_write_token:
    UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
    UPLOAD_DIR.mkdir(exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Mounted last and at "/" so it only catches paths none of the routes
# above matched -- a single-page app (client widget + staff panel,
# switchable in-app) rather than two separate sites under /widget and
# /admin.
WEB_DIR = Path(__file__).resolve().parent.parent / "web"
app.mount("/", StaticFiles(directory=WEB_DIR / "app", html=True), name="app")
