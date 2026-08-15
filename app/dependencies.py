from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tenant


def get_current_tenant(db: Session = Depends(get_db)) -> Tenant:
    """V1 is single-tenant with no login yet: the sole tenant row IS the
    current salon. Once login ships, swap this for a lookup off the
    authenticated session instead of "the only row in the table".
    """
    tenant = db.execute(select(Tenant).limit(1)).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=500, detail="No tenant configured")
    return tenant
