from fastapi import FastAPI

from app.routers import services, staff

app = FastAPI(title="Nail Salon Booking")

app.include_router(services.router)
app.include_router(staff.router)


@app.get("/health")
def health():
    return {"status": "ok"}
