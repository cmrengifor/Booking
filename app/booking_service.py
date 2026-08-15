"""Shared booking logic used by both the public widget and the staff
booking screen, so the two surfaces never diverge (per the brief).
"""
import secrets
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import Appointment, AppointmentService, BookingHold, Client, Notification, Service, Staff, Tenant
from app.queries.availability import assign_least_booked_staff, get_available_slots
from app.schemas import AppointmentDetailRead, ClientInfo

HOLD_DURATION_MINUTES = 5
MAX_ANY_AVAILABLE_RETRIES = 2


def _check_cutoff(tenant: Tenant, appt: Appointment, action: str) -> None:
    cutoff = timedelta(hours=tenant.cancellation_cutoff_hours)
    if appt.start_time - datetime.now(timezone.utc) < cutoff:
        raise HTTPException(
            status_code=409,
            detail=f"{action} must be made at least {tenant.cancellation_cutoff_hours} hours in advance",
        )


def cancel_appointment(db: Session, tenant: Tenant, appointment_id: UUID, reason: str | None) -> Appointment:
    appt = get_appointment_or_404(db, tenant.id, appointment_id)
    if appt.status != "confirmed":
        raise HTTPException(status_code=409, detail="Only confirmed appointments can be cancelled")
    _check_cutoff(tenant, appt, "Cancellations")

    appt.status = "cancelled"
    appt.cancellation_reason = reason
    appt.cancelled_at = datetime.now(timezone.utc)
    db.add(Notification(appointment_id=appt.id, channel="whatsapp", type="cancellation"))
    db.commit()
    db.refresh(appt)
    return appt


def reschedule_appointment(db: Session, tenant: Tenant, appointment_id: UUID, hold_token: str) -> Appointment:
    appt = get_appointment_or_404(db, tenant.id, appointment_id)
    if appt.status != "confirmed":
        raise HTTPException(status_code=409, detail="Only confirmed appointments can be rescheduled")
    _check_cutoff(tenant, appt, "Reschedules")

    hold = db.execute(
        select(BookingHold).where(BookingHold.session_token == hold_token, BookingHold.tenant_id == tenant.id)
    ).scalar_one_or_none()
    if hold is None:
        raise HTTPException(status_code=404, detail="Hold not found or already used")
    if hold.expires_at < datetime.now(timezone.utc):
        db.delete(hold)
        db.commit()
        raise HTTPException(status_code=409, detail="Hold expired, please pick a new time")

    hold_id, new_staff_id, new_start, new_end = hold.id, hold.staff_id, hold.start_time, hold.end_time
    appt.staff_id = new_staff_id
    appt.start_time = new_start
    appt.end_time = new_end
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That new slot was just taken, please pick another time.")

    db.add(Notification(appointment_id=appt.id, channel="whatsapp", type="confirmation"))
    db.execute(BookingHold.__table__.delete().where(BookingHold.id == hold_id))
    db.commit()
    db.refresh(appt)
    return appt


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


def manual_book(
    db: Session, tenant: Tenant, service_id: UUID, staff_id: UUID | None, start_time: datetime, client_info: ClientInfo
) -> Appointment:
    """Staff booking screen entry point -- same hold-then-confirm path as
    the public widget, so a walk-in booked by staff is exactly as
    overlap-safe as a client's self-serve booking.
    """
    hold = create_hold(db, tenant, service_id, start_time, staff_id)
    booking_mode = "client_choice" if staff_id is not None else "any_available"
    return confirm_booking(db, tenant, hold.session_token, service_id, client_info, booking_mode)


def update_appointment_status(
    db: Session, tenant: Tenant, appointment_id: UUID, status: str, cancellation_reason: str | None
) -> Appointment:
    """Staff-side status change -- no cutoff enforcement, unlike the
    client-facing cancel/reschedule endpoints. Staff can always mark an
    appointment complete/no-show/cancelled regardless of timing.
    """
    appt = get_appointment_or_404(db, tenant.id, appointment_id)
    appt.status = status
    if status == "cancelled":
        appt.cancellation_reason = cancellation_reason
        appt.cancelled_at = datetime.now(timezone.utc)
        db.add(Notification(appointment_id=appt.id, channel="whatsapp", type="cancellation"))
    db.commit()
    db.refresh(appt)
    return appt


def list_appointments_detailed(
    db: Session, tenant: Tenant, start_date: date, end_date: date
) -> list[AppointmentDetailRead]:
    """Day/week calendar view across all staff. Bounds are resolved in the
    tenant's own timezone (not the DB session's) for the same reason the
    availability engine does -- see app/queries/availability.py.
    """
    tz = ZoneInfo(tenant.timezone)
    range_start = datetime.combine(start_date, time.min, tzinfo=tz)
    range_end = datetime.combine(end_date, time.min, tzinfo=tz) + timedelta(days=1)

    stmt = (
        select(Appointment)
        .where(
            Appointment.tenant_id == tenant.id,
            Appointment.start_time >= range_start,
            Appointment.start_time < range_end,
        )
        .options(
            selectinload(Appointment.client),
            selectinload(Appointment.staff),
            selectinload(Appointment.services).selectinload(AppointmentService.service),
        )
        .order_by(Appointment.start_time)
    )
    appointments = db.execute(stmt).scalars().all()
    return [
        AppointmentDetailRead(
            id=appt.id,
            staff_id=appt.staff_id,
            client_id=appt.client_id,
            start_time=appt.start_time,
            end_time=appt.end_time,
            status=appt.status,
            booking_mode=appt.booking_mode,
            price_total=appt.price_total,
            created_at=appt.created_at,
            cancelled_at=appt.cancelled_at,
            cancellation_reason=appt.cancellation_reason,
            client_name=appt.client.name,
            client_phone=appt.client.phone,
            staff_name=appt.staff.name,
            service_names=[aps.service.name for aps in appt.services],
        )
        for appt in appointments
    ]
