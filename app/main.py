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

WEB_DIR = Path(__file__).resolve().parent.parent / "web"
app.mount("/widget", StaticFiles(directory=WEB_DIR / "widget", html=True), name="widget")
app.mount("/admin", StaticFiles(directory=WEB_DIR / "admin", html=True), name="admin")


@app.get("/health")
def health():
    return {"status": "ok"}
