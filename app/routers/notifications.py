from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import booking_service
from app.database import get_db
from app.dependencies import get_current_tenant
from app.models import Tenant
from app.schemas import BookingNotificationRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/recent", response_model=list[BookingNotificationRead])
def recent_booking_notifications(
    since: datetime,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    """Polled by the staff panel for its live new-booking alert."""
    return booking_service.get_recent_booking_notifications(db, tenant, since)
