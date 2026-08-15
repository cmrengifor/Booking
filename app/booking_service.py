"""Shared booking logic used by both the public widget and the staff
booking screen, so the two surfaces never diverge (per the brief).
"""
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Appointment, AppointmentService, BookingHold, Client, Notification, Service, Staff, Tenant
from app.queries.availability import assign_least_booked_staff, get_available_slots
from app.schemas import ClientInfo

HOLD_DURATION_MINUTES = 5
MAX_ANY_AVAILABLE_RETRIES = 2


def get_appointment_or_404(db: Session, tenant_id: UUID, appointment_id: UUID) -> Appointment:
    appt = db.get(Appointment, appointment_id)
    if appt is None or appt.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


def get_qualifying_staff(db: Session, tenant_id: UUID, service_id: UUID) -> list[Staff]:
    service = db.get(Service, service_id)
    if service is None or service.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Service not found")
    return [s for s in service.staff if s.active]


def _get_service_or_404(db: Session, tenant_id: UUID, service_id: UUID) -> Service:
    service = db.get(Service, service_id)
    if service is None or service.tenant_id != tenant_id or not service.active:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


def _candidate_staff_ids_at(
    db: Session,
    tenant_id: UUID,
    service_id: UUID,
    start_time: datetime,
    staff_id: UUID | None,
) -> list[UUID]:
    rows = get_available_slots(
        db, tenant_id=tenant_id, service_id=service_id, target_date=start_time.date(), staff_id=staff_id
    )
    return [r.staff_id for r in rows if r.start_time == start_time]


def create_hold(
    db: Session, tenant: Tenant, service_id: UUID, start_time: datetime, requested_staff_id: UUID | None
) -> BookingHold:
    service = _get_service_or_404(db, tenant.id, service_id)
    candidates = _candidate_staff_ids_at(db, tenant.id, service.id, start_time, requested_staff_id)
    if not candidates:
        raise HTTPException(status_code=409, detail="That slot is no longer available")

    assigned_staff_id = (
        requested_staff_id
        if requested_staff_id is not None
        else assign_least_booked_staff(db, candidates, start_time.date())
    )

    end_time = start_time + timedelta(minutes=service.duration_minutes + service.buffer_minutes)
    hold = BookingHold(
        tenant_id=tenant.id,
        staff_id=assigned_staff_id,
        start_time=start_time,
        end_time=end_time,
        session_token=secrets.token_urlsafe(24),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=HOLD_DURATION_MINUTES),
    )
    db.add(hold)
    db.commit()
    db.refresh(hold)
    return hold


def release_hold(db: Session, tenant_id: UUID, hold_token: str) -> None:
    hold = db.execute(
        select(BookingHold).where(BookingHold.session_token == hold_token, BookingHold.tenant_id == tenant_id)
    ).scalar_one_or_none()
    if hold is not None:
        db.delete(hold)
        db.commit()


def get_or_create_client(db: Session, tenant_id: UUID, info: ClientInfo) -> Client:
    existing = db.execute(
        select(Client).where(Client.tenant_id == tenant_id, Client.phone == info.phone)
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    client = Client(tenant_id=tenant_id, name=info.name, phone=info.phone, email=info.email)
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def confirm_booking(
    db: Session,
    tenant: Tenant,
    hold_token: str,
    service_id: UUID,
    client_info: ClientInfo,
    booking_mode: str,
) -> Appointment:
    hold = db.execute(
        select(BookingHold).where(BookingHold.session_token == hold_token, BookingHold.tenant_id == tenant.id)
    ).scalar_one_or_none()
    if hold is None:
        raise HTTPException(status_code=404, detail="Hold not found or already used")

    if hold.expires_at < datetime.now(timezone.utc):
        db.delete(hold)
        db.commit()
        raise HTTPException(status_code=409, detail="Hold expired, please pick a new time")

    service = _get_service_or_404(db, tenant.id, service_id)
    client = get_or_create_client(db, tenant.id, client_info)

    # Capture as plain values so nothing here depends on ORM object state
    # surviving a rollback inside the retry loop below.
    client_id = client.id
    hold_id = hold.id
    staff_id = hold.staff_id
    start_time, end_time = hold.start_time, hold.end_time
    service_id_, duration_minutes, price = service.id, service.duration_minutes, service.price

    attempt = 0
    while True:
        attempt += 1
        appt = Appointment(
            tenant_id=tenant.id,
            client_id=client_id,
            staff_id=staff_id,
            booking_mode=booking_mode,
            start_time=start_time,
            end_time=end_time,
            status="confirmed",
            price_total=price,
        )
        db.add(appt)
        try:
            db.flush()
            break
        except IntegrityError:
            db.rollback()
            if booking_mode != "any_available" or attempt >= MAX_ANY_AVAILABLE_RETRIES:
                raise HTTPException(
                    status_code=409,
                    detail="That slot was just booked by someone else. Please pick another time.",
                )
            candidates = _candidate_staff_ids_at(db, tenant.id, service_id_, start_time, None)
            if not candidates:
                raise HTTPException(status_code=409, detail="That slot is no longer available")
            staff_id = assign_least_booked_staff(db, candidates, start_time.date())

    db.add(
        AppointmentService(
            appointment_id=appt.id, service_id=service_id_, duration_minutes=duration_minutes, price=price
        )
    )
    db.add(Notification(appointment_id=appt.id, channel="whatsapp", type="confirmation"))
    db.execute(BookingHold.__table__.delete().where(BookingHold.id == hold_id))
    db.commit()
    db.refresh(appt)
    return appt
