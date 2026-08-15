"""seed default tenant

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-15

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO tenants (name, slug, timezone, locale)
        VALUES ('Salon', 'salon', 'America/Bogota', 'es')
        ON CONFLICT (slug) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM tenants WHERE slug = 'salon'")
