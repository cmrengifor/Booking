from fastapi import FastAPI

app = FastAPI(title="Nail Salon Booking")


@app.get("/health")
def health():
    return {"status": "ok"}
