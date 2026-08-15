from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_tenant
from app.models import Service, Tenant
from app.schemas import ServiceCreate, ServiceRead, ServiceUpdate

router = APIRouter(prefix="/services", tags=["services"])


def _get_service_or_404(db: Session, tenant_id: UUID, service_id: UUID) -> Service:
    service = db.execute(
        select(Service).where(Service.id == service_id, Service.tenant_id == tenant_id)
    ).scalar_one_or_none()
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


@router.post("", response_model=ServiceRead, status_code=201)
def create_service(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    service = Service(tenant_id=tenant.id, **payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.get("", response_model=list[ServiceRead])
def list_services(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    stmt = select(Service).where(Service.tenant_id == tenant.id)
    if not include_inactive:
        stmt = stmt.where(Service.active.is_(True))
    return db.execute(stmt.order_by(Service.name)).scalars().all()


@router.get("/{service_id}", response_model=ServiceRead)
def get_service(
    service_id: UUID,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    return _get_service_or_404(db, tenant.id, service_id)


@router.patch("/{service_id}", response_model=ServiceRead)
def update_service(
    service_id: UUID,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    service = _get_service_or_404(db, tenant.id, service_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return service
