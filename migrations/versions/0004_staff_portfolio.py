"""staff bio and portfolio images

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-15

Supports the public landing page's "faceless" technician profiles --
no personal photo anywhere, just an optional bio and a gallery of
work (portfolio images).
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE staff ADD COLUMN bio TEXT")
    op.execute(
        """
        CREATE TABLE staff_portfolio_images (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            image_path      TEXT NOT NULL,
            caption         TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_portfolio_images_staff ON staff_portfolio_images(staff_id, created_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS staff_portfolio_images")
    op.execute("ALTER TABLE staff DROP COLUMN bio")
