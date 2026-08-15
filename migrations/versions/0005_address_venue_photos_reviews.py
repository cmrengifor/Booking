"""tenant address, venue photos, reviews

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-15

Supports the landing page: a compact address line under the salon
name, venue photos (facade/interior, for finding the place), and a
two-scope review system -- general (whole salon) and particular (per
technician, shown on their profile). One review per appointment,
scoped to whichever staff member performed it, so "general" and
"particular" are just different aggregations of the same table rather
than two separate ones.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE tenants ADD COLUMN address TEXT")

    op.execute(
        """
        CREATE TABLE venue_photos (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            image_path      TEXT NOT NULL,
            caption         TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_venue_photos_tenant ON venue_photos(tenant_id, created_at)")

    op.execute(
        """
        CREATE TABLE reviews (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            appointment_id  UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
            rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comment         TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS reviews")
    op.execute("DROP TABLE IF EXISTS venue_photos")
    op.execute("ALTER TABLE tenants DROP COLUMN address")
