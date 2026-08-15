from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app import booking_service
from app.database import get_db
from app.dependencies import get_current_tenant
from app.models import Tenant
from app.schemas import TenantPublicRead, TenantUpdate, VenuePhotoRead

router = APIRouter(prefix="/tenant", tags=["tenant"])


@router.get("", response_model=TenantPublicRead)
def get_tenant(tenant: Tenant = Depends(get_current_tenant)):
    return tenant


@router.patch("", response_model=TenantPublicRead)
def update_tenant(
    payload: TenantUpdate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    return booking_service.update_tenant(db, tenant, payload)


@router.get("/photos", response_model=list[VenuePhotoRead])
def list_photos(
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    return booking_service.get_venue_photos(db, tenant.id)


@router.post("/photos", response_model=VenuePhotoRead, status_code=201)
async def upload_photo(
    file: UploadFile = File(...),
    caption: str | None = Form(None),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    return await booking_service.add_venue_photo(db, tenant, file, caption)


@router.delete("/photos/{photo_id}", status_code=204)
def delete_photo(
    photo_id: UUID,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    booking_service.delete_venue_photo(db, tenant.id, photo_id)
