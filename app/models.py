import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    Table,
    Text,
    Time,
    TIMESTAMP,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

staff_services = Table(
    "staff_services",
    Base.metadata,
    Column("staff_id", UUID(as_uuid=True), ForeignKey("staff.id", ondelete="CASCADE"), primary_key=True),
    Column("service_id", UUID(as_uuid=True), ForeignKey("services.id", ondelete="CASCADE"), primary_key=True),
)


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(Text, unique=True)
    timezone: Mapped[str] = mapped_column(Text, default="America/Bogota")
    locale: Mapped[str] = mapped_column(Text, default="es")
    whatsapp_number: Mapped[str | None] = mapped_column(Text)
    plan_tier: Mapped[str] = mapped_column(Text, default="starter")
    status: Mapped[str] = mapped_column(Text, default="trial")
    cancellation_cutoff_hours: Mapped[int] = mapped_column(Integer, default=24)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    staff: Mapped[list["Staff"]] = relationship(back_populates="tenant")
    services: Mapped[list["Service"]] = relationship(back_populates="tenant")


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="staff")
    working_hours: Mapped[list["StaffWorkingHours"]] = relationship(
        back_populates="staff", cascade="all, delete-orphan"
    )
    time_off: Mapped[list["StaffTimeOff"]] = relationship(
        back_populates="staff", cascade="all, delete-orphan"
    )
    services: Mapped[list["Service"]] = relationship(secondary=staff_services, back_populates="staff")


class StaffWorkingHours(Base):
    __tablename__ = "staff_working_hours"
    __table_args__ = (CheckConstraint("day_of_week BETWEEN 0 AND 6", name="staff_working_hours_day_of_week_check"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="CASCADE"))
    day_of_week: Mapped[int] = mapped_column(SmallInteger)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)

    staff: Mapped["Staff"] = relationship(back_populates="working_hours")


class StaffTimeOff(Base):
    __tablename__ = "staff_time_off"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id", ondelete="CASCADE"))
    start_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    end_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    reason: Mapped[str | None] = mapped_column(Text)

    staff: Mapped["Staff"] = relationship(back_populates="time_off")


class Service(Base):
    __tablename__ = "services"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(Text)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    buffer_minutes: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    is_addon: Mapped[bool] = mapped_column(Boolean, default=False)
    deposit_required: Mapped[bool] = mapped_column(Boolean, default=False)
    deposit_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="services")
    staff: Mapped[list["Staff"]] = relationship(secondary=staff_services, back_populates="services")


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"))
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"))
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"))
    booking_mode: Mapped[str] = mapped_column(Text, default="client_choice")
    start_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    end_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    status: Mapped[str] = mapped_column(Text, default="confirmed")
    price_total: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    deposit_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    cancellation_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    cancelled_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    client: Mapped["Client"] = relationship()
    staff: Mapped["Staff"] = relationship()
    services: Mapped[list["AppointmentService"]] = relationship(
        back_populates="appointment", cascade="all, delete-orphan"
    )


class AppointmentService(Base):
    __tablename__ = "appointment_services"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE")
    )
    service_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("services.id"))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    appointment: Mapped["Appointment"] = relationship(back_populates="services")
    service: Mapped["Service"] = relationship()


class BookingHold(Base):
    __tablename__ = "booking_holds"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"))
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"))
    start_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    end_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    session_token: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE")
    )
    channel: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="pending")
    sent_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
