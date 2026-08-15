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
    bio: str | None = None
    active: bool | None = None


class StaffRead(StaffBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bio: str | None = None
    active: bool
    created_at: datetime


class StaffServicesUpdate(BaseModel):
    service_ids: list[UUID]


class StaffPublicRead(BaseModel):
    """Public-facing technician info -- deliberately excludes phone/email.
    Used anywhere an anonymous visitor can see staff (booking flow,
    landing page, portfolio), so private contact details never leak.
    """
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    bio: str | None = None


class PortfolioImageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    image_path: str
    caption: str | None = None
    created_at: datetime


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


class AvailabilitySlot(BaseModel):
    staff_id: UUID
    start_time: datetime
    end_time: datetime


class HoldCreate(BaseModel):
    service_id: UUID
    start_time: datetime
    staff_id: UUID | None = None  # None = "any available"


class HoldRead(BaseModel):
    hold_token: str
    staff_id: UUID
    start_time: datetime
    end_time: datetime
    expires_at: datetime


class ClientInfo(BaseModel):
    name: str
    phone: str
    email: str | None = None


class ConfirmCreate(BaseModel):
    hold_token: str
    service_id: UUID
    client: ClientInfo
    booking_mode: str = Field(default="client_choice", pattern="^(client_choice|any_available)$")


class RescheduleCreate(BaseModel):
    hold_token: str


class CancelRequest(BaseModel):
    reason: str | None = None


class AppointmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    staff_id: UUID
    client_id: UUID
    start_time: datetime
    end_time: datetime
    status: str
    booking_mode: str
    price_total: Decimal
    created_at: datetime
    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None


class AppointmentStatusUpdate(BaseModel):
    status: str = Field(pattern="^(confirmed|completed|no_show|cancelled)$")
    cancellation_reason: str | None = None


class ManualBookingCreate(BaseModel):
    service_id: UUID
    staff_id: UUID | None = None  # None = "any available"
    start_time: datetime
    client: ClientInfo


class AppointmentDetailRead(AppointmentRead):
    client_name: str
    client_phone: str | None = None
    staff_name: str
    service_names: list[str]


class BookingNotificationRead(BaseModel):
    id: UUID
    created_at: datetime
    appointment_id: UUID
    client_name: str
    start_time: datetime


class TenantPublicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    address: str | None = None


class TenantUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    whatsapp_number: str | None = None


class VenuePhotoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    image_path: str
    caption: str | None = None
    created_at: datetime


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class ReviewRead(BaseModel):
    id: UUID
    rating: int
    comment: str | None = None
    created_at: datetime
    client_name: str


class ReviewSummary(BaseModel):
    average: float | None = None
    count: int
    reviews: list[ReviewRead]
