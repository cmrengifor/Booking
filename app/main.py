from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import appointments, booking, services, staff

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


@app.get("/health")
def health():
    return {"status": "ok"}


# Mounted last and at "/" so it only catches paths none of the routes
# above matched -- a single-page app (client widget + staff panel,
# switchable in-app) rather than two separate sites under /widget and
# /admin.
WEB_DIR = Path(__file__).resolve().parent.parent / "web"
app.mount("/", StaticFiles(directory=WEB_DIR / "app", html=True), name="app")
