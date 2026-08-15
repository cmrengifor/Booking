from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import booking_service
from app.database import get_db
from app.dependencies import get_current_tenant
from app.models import Tenant
from app.schemas import ReviewSummary

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/venue", response_model=ReviewSummary)
def venue_reviews(
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    """General (salon-level) reviews, for the landing page."""
    return booking_service.get_venue_reviews(db, tenant.id)


@router.get("/staff/{staff_id}", response_model=ReviewSummary)
def staff_reviews(
    staff_id: UUID,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    """Particular (per-technician) reviews, for their profile."""
    return booking_service.get_staff_reviews(db, tenant.id, staff_id)
