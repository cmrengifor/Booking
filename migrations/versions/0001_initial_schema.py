"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-15

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.execute(
        """
        CREATE TABLE tenants (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name            TEXT NOT NULL,
            slug            TEXT UNIQUE NOT NULL,
            timezone        TEXT NOT NULL DEFAULT 'America/Bogota',
            locale          TEXT NOT NULL DEFAULT 'es',
            whatsapp_number TEXT,
            plan_tier       TEXT NOT NULL DEFAULT 'starter',
            status          TEXT NOT NULL DEFAULT 'trial',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE staff (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name        TEXT NOT NULL,
            email       TEXT,
            phone       TEXT,
            active      BOOLEAN NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_staff_tenant ON staff(tenant_id)")

    op.execute(
        """
        CREATE TABLE staff_working_hours (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
            start_time  TIME NOT NULL,
            end_time    TIME NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX idx_working_hours_staff ON staff_working_hours(staff_id)")

    op.execute(
        """
        CREATE TABLE staff_time_off (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            start_at    TIMESTAMPTZ NOT NULL,
            end_at      TIMESTAMPTZ NOT NULL,
            reason      TEXT
        )
        """
    )
    op.execute("CREATE INDEX idx_time_off_staff ON staff_time_off(staff_id, start_at)")

    op.execute(
        """
        CREATE TABLE services (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name             TEXT NOT NULL,
            category         TEXT,
            duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
            buffer_minutes   INTEGER NOT NULL DEFAULT 0,
            price            NUMERIC(10,2) NOT NULL,
            is_addon         BOOLEAN NOT NULL DEFAULT false,
            deposit_required BOOLEAN NOT NULL DEFAULT false,
            deposit_amount   NUMERIC(10,2),
            active           BOOLEAN NOT NULL DEFAULT true,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_services_tenant ON services(tenant_id)")

    op.execute(
        """
        CREATE TABLE staff_services (
            staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            PRIMARY KEY (staff_id, service_id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE clients (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name        TEXT NOT NULL,
            phone       TEXT,
            email       TEXT,
            notes       TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_clients_tenant ON clients(tenant_id)")
    op.execute("CREATE INDEX idx_clients_phone ON clients(tenant_id, phone)")

    op.execute(
        """
        CREATE TABLE appointments (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            client_id       UUID NOT NULL REFERENCES clients(id),
            staff_id        UUID NOT NULL REFERENCES staff(id),
            booking_mode    TEXT NOT NULL DEFAULT 'client_choice',
            start_time      TIMESTAMPTZ NOT NULL,
            end_time        TIMESTAMPTZ NOT NULL,
            status          TEXT NOT NULL DEFAULT 'confirmed',
            price_total     NUMERIC(10,2) NOT NULL,
            deposit_paid    BOOLEAN NOT NULL DEFAULT false,
            cancellation_reason TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            cancelled_at    TIMESTAMPTZ,
            CHECK (end_time > start_time)
        )
        """
    )
    op.execute("CREATE INDEX idx_appointments_tenant ON appointments(tenant_id)")
    op.execute("CREATE INDEX idx_appointments_staff_time ON appointments(staff_id, start_time)")
    op.execute(
        """
        ALTER TABLE appointments
          ADD CONSTRAINT no_overlapping_appointments
          EXCLUDE USING gist (
            staff_id WITH =,
            tstzrange(start_time, end_time) WITH &&
          )
          WHERE (status = 'confirmed')
        """
    )

    op.execute(
        """
        CREATE TABLE appointment_services (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            appointment_id      UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
            service_id          UUID NOT NULL REFERENCES services(id),
            duration_minutes    INTEGER NOT NULL,
            price               NUMERIC(10,2) NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX idx_appt_services_appt ON appointment_services(appointment_id)")

    op.execute(
        """
        CREATE TABLE booking_holds (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            staff_id    UUID NOT NULL REFERENCES staff(id),
            start_time  TIMESTAMPTZ NOT NULL,
            end_time    TIMESTAMPTZ NOT NULL,
            session_token TEXT NOT NULL,
            expires_at  TIMESTAMPTZ NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX idx_holds_staff_time ON booking_holds(staff_id, start_time)")

    op.execute(
        """
        CREATE TABLE waitlist_entries (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            client_id           UUID NOT NULL REFERENCES clients(id),
            service_id          UUID NOT NULL REFERENCES services(id),
            preferred_staff_id  UUID REFERENCES staff(id),
            preferred_window_start TIMESTAMPTZ,
            preferred_window_end   TIMESTAMPTZ,
            status              TEXT NOT NULL DEFAULT 'waiting',
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            notified_at         TIMESTAMPTZ
        )
        """
    )
    op.execute("CREATE INDEX idx_waitlist_tenant ON waitlist_entries(tenant_id, status)")

    op.execute(
        """
        CREATE TABLE notifications (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
            channel         TEXT NOT NULL,
            type            TEXT NOT NULL,
            status          TEXT NOT NULL DEFAULT 'pending',
            sent_at         TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_notifications_appt ON notifications(appointment_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS notifications")
    op.execute("DROP TABLE IF EXISTS waitlist_entries")
    op.execute("DROP TABLE IF EXISTS booking_holds")
    op.execute("DROP TABLE IF EXISTS appointment_services")
    op.execute("DROP TABLE IF EXISTS appointments")
    op.execute("DROP TABLE IF EXISTS clients")
    op.execute("DROP TABLE IF EXISTS staff_services")
    op.execute("DROP TABLE IF EXISTS services")
    op.execute("DROP TABLE IF EXISTS staff_time_off")
    op.execute("DROP TABLE IF EXISTS staff_working_hours")
    op.execute("DROP TABLE IF EXISTS staff")
    op.execute("DROP TABLE IF EXISTS tenants")
