from datetime import datetime, time
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ServiceBase(BaseModel):
    name: str
    category: str | None = None
    duration_minutes: int = Field(gt=0)
    buffer_minutes: int = Field(default=0, ge=0)
    price: Decimal = Field(ge=0)
    is_addon: bool = False
    deposit_required: bool = False
    deposit_amount: Decimal | None = Field(default=None, ge=0)


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    duration_minutes: int | None = Field(default=None, gt=0)
    buffer_minutes: int | None = Field(default=None, ge=0)
    price: Decimal | None = Field(default=None, ge=0)
    is_addon: bool | None = None
    deposit_required: bool | None = None
    deposit_amount: Decimal | None = Field(default=None, ge=0)
    active: bool | None = None


class ServiceRead(ServiceBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    active: bool
    created_at: datetime


class StaffBase(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None


class StaffCreate(StaffBase):
    pass


class StaffUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    active: bool | None = None


class StaffRead(StaffBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    active: bool
    created_at: datetime


class StaffServicesUpdate(BaseModel):
    service_ids: list[UUID]


class WorkingHourEntry(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def check_order(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class WorkingHoursUpdate(BaseModel):
    hours: list[WorkingHourEntry]


class WorkingHourRead(WorkingHourEntry):
    model_config = ConfigDict(from_attributes=True)

    id: UUID


class TimeOffCreate(BaseModel):
    start_at: datetime
    end_at: datetime
    reason: str | None = None

    @model_validator(mode="after")
    def check_order(self):
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        return self


class TimeOffRead(TimeOffCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
