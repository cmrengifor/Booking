from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import booking_service
from app.database import get_db
from app.dependencies import get_current_tenant
from app.models import Tenant
from app.schemas import AppointmentDetailRead, AppointmentRead, AppointmentStatusUpdate, ManualBookingCreate

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get("", response_model=list[AppointmentDetailRead])
def list_appointments(
    start_date: date,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    """Day view (end_date omitted) or week/range view across all staff --
    the calendar backing the staff booking screen.
    """
    return booking_service.list_appointments_detailed(db, tenant, start_date, end_date or start_date)


@router.post("", response_model=AppointmentRead, status_code=201)
def create_manual_booking(
    payload: ManualBookingCreate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    """Staff-entered booking for phone/WhatsApp-relayed requests and
    walk-ins -- reuses the exact same availability + confirm logic as
    the public widget.
    """
    return booking_service.manual_book(
        db, tenant, payload.service_id, payload.staff_id, payload.start_time, payload.client
    )


@router.patch("/{appointment_id}/status", response_model=AppointmentRead)
def update_status(
    appointment_id: UUID,
    payload: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    return booking_service.update_appointment_status(
        db, tenant, appointment_id, payload.status, payload.cancellation_reason
    )
