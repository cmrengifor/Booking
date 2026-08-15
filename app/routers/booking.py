from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import booking_service
from app.database import get_db
from app.dependencies import get_current_tenant
from app.models import Tenant
from app.queries.availability import get_available_slots
from app.schemas import (
    AppointmentRead,
    AvailabilitySlot,
    ConfirmCreate,
    HoldCreate,
    HoldRead,
    StaffRead,
)

router = APIRouter(prefix="/booking", tags=["booking"])


@router.get("/staff", response_model=list[StaffRead])
def staff_for_service(
    service_id: UUID,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    return booking_service.get_qualifying_staff(db, tenant.id, service_id)


@router.get("/availability", response_model=list[AvailabilitySlot])
def availability(
    service_id: UUID,
    target_date: date,
    staff_id: UUID | None = None,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    rows = get_available_slots(db, tenant_id=tenant.id, service_id=service_id, target_date=target_date, staff_id=staff_id)
    return [AvailabilitySlot(staff_id=r.staff_id, start_time=r.start_time, end_time=r.end_time) for r in rows]


@router.post("/hold", response_model=HoldRead, status_code=201)
def create_hold(
    payload: HoldCreate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    hold = booking_service.create_hold(db, tenant, payload.service_id, payload.start_time, payload.staff_id)
    return HoldRead(
        hold_token=hold.session_token,
        staff_id=hold.staff_id,
        start_time=hold.start_time,
        end_time=hold.end_time,
        expires_at=hold.expires_at,
    )


@router.delete("/hold/{hold_token}", status_code=204)
def delete_hold(
    hold_token: str,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    booking_service.release_hold(db, tenant.id, hold_token)


@router.post("/confirm", response_model=AppointmentRead, status_code=201)
def confirm(
    payload: ConfirmCreate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    return booking_service.confirm_booking(
        db, tenant, payload.hold_token, payload.service_id, payload.client, payload.booking_mode
    )


@router.get("/appointments/{appointment_id}", response_model=AppointmentRead)
def get_appointment(
    appointment_id: UUID,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    return booking_service.get_appointment_or_404(db, tenant.id, appointment_id)
