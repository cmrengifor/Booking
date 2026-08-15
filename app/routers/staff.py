from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import booking_service
from app.database import get_db
from app.dependencies import get_current_tenant
from app.models import Service, Staff, StaffTimeOff, StaffWorkingHours, Tenant
from app.schemas import (
    PortfolioImageRead,
    StaffCreate,
    StaffRead,
    StaffServicesUpdate,
    StaffUpdate,
    TimeOffCreate,
    TimeOffRead,
    WorkingHourRead,
    WorkingHoursUpdate,
)

router = APIRouter(prefix="/staff", tags=["staff"])


def _get_staff_or_404(db: Session, tenant_id: UUID, staff_id: UUID) -> Staff:
    staff = db.execute(
        select(Staff).where(Staff.id == staff_id, Staff.tenant_id == tenant_id)
    ).scalar_one_or_none()
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff


@router.post("", response_model=StaffRead, status_code=201)
def create_staff(
    payload: StaffCreate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    staff = Staff(tenant_id=tenant.id, **payload.model_dump())
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.get("", response_model=list[StaffRead])
def list_staff(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    stmt = select(Staff).where(Staff.tenant_id == tenant.id)
    if not include_inactive:
        stmt = stmt.where(Staff.active.is_(True))
    return db.execute(stmt.order_by(Staff.name)).scalars().all()


@router.get("/{staff_id}", response_model=StaffRead)
def get_staff(
    staff_id: UUID,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    return _get_staff_or_404(db, tenant.id, staff_id)


@router.patch("/{staff_id}", response_model=StaffRead)
def update_staff(
    staff_id: UUID,
    payload: StaffUpdate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    staff = _get_staff_or_404(db, tenant.id, staff_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(staff, field, value)
    db.commit()
    db.refresh(staff)
    return staff


@router.put("/{staff_id}/services", response_model=list[UUID])
def set_staff_services(
    staff_id: UUID,
    payload: StaffServicesUpdate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    """Replace the full set of services this staff member is qualified to perform."""
    staff = _get_staff_or_404(db, tenant.id, staff_id)
    services = db.execute(
        select(Service).where(Service.id.in_(payload.service_ids), Service.tenant_id == tenant.id)
    ).scalars().all()
    found_ids = {s.id for s in services}
    missing = set(payload.service_ids) - found_ids
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown service ids: {sorted(missing)}")
    staff.services = services
    db.commit()
    return [s.id for s in services]


@router.get("/{staff_id}/services", response_model=list[UUID])
def get_staff_services(
    staff_id: UUID,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    staff = _get_staff_or_404(db, tenant.id, staff_id)
    return [s.id for s in staff.services]


@router.put("/{staff_id}/working-hours", response_model=list[WorkingHourRead])
def set_working_hours(
    staff_id: UUID,
    payload: WorkingHoursUpdate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    """Replace the staff member's full recurring weekly schedule."""
    staff = _get_staff_or_404(db, tenant.id, staff_id)
    db.execute(
        StaffWorkingHours.__table__.delete().where(StaffWorkingHours.staff_id == staff.id)
    )
    entries = [
        StaffWorkingHours(staff_id=staff.id, **entry.model_dump()) for entry in payload.hours
    ]
    db.add_all(entries)
    db.commit()
    for entry in entries:
        db.refresh(entry)
    return entries


@router.get("/{staff_id}/working-hours", response_model=list[WorkingHourRead])
def get_working_hours(
    staff_id: UUID,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    staff = _get_staff_or_404(db, tenant.id, staff_id)
    return db.execute(
        select(StaffWorkingHours)
        .where(StaffWorkingHours.staff_id == staff.id)
        .order_by(StaffWorkingHours.day_of_week)
    ).scalars().all()


@router.post("/{staff_id}/time-off", response_model=TimeOffRead, status_code=201)
def add_time_off(
    staff_id: UUID,
    payload: TimeOffCreate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    staff = _get_staff_or_404(db, tenant.id, staff_id)
    time_off = StaffTimeOff(staff_id=staff.id, **payload.model_dump())
    db.add(time_off)
    db.commit()
    db.refresh(time_off)
    return time_off


@router.get("/{staff_id}/time-off", response_model=list[TimeOffRead])
def list_time_off(
    staff_id: UUID,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    staff = _get_staff_or_404(db, tenant.id, staff_id)
    return db.execute(
        select(StaffTimeOff).where(StaffTimeOff.staff_id == staff.id).order_by(StaffTimeOff.start_at)
    ).scalars().all()


@router.delete("/{staff_id}/time-off/{time_off_id}", status_code=204)
def delete_time_off(
    staff_id: UUID,
    time_off_id: UUID,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    staff = _get_staff_or_404(db, tenant.id, staff_id)
    time_off = db.execute(
        select(StaffTimeOff).where(StaffTimeOff.id == time_off_id, StaffTimeOff.staff_id == staff.id)
    ).scalar_one_or_none()
    if time_off is None:
        raise HTTPException(status_code=404, detail="Time-off block not found")
    db.delete(time_off)
    db.commit()


@router.post("/{staff_id}/portfolio", response_model=PortfolioImageRead, status_code=201)
async def upload_portfolio_image(
    staff_id: UUID,
    file: UploadFile = File(...),
    caption: str | None = Form(None),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    return await booking_service.add_portfolio_image(db, tenant.id, staff_id, file, caption)


@router.delete("/{staff_id}/portfolio/{image_id}", status_code=204)
def delete_portfolio_image(
    staff_id: UUID,
    image_id: UUID,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    booking_service.delete_portfolio_image(db, tenant.id, staff_id, image_id)
