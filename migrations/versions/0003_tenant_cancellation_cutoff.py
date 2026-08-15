"""add tenant cancellation cutoff setting

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-15

Adds a column the original brief's schema didn't have: V1 explicitly
requires "self-service reschedule/cancel with an automatically enforced
cutoff policy" but never defined where that policy lives. Storing it
per-tenant (rather than hardcoding it) costs one column now and avoids
a hardcoded constant later, since different pilot salons will want
different cutoffs.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE tenants ADD COLUMN cancellation_cutoff_hours INTEGER NOT NULL DEFAULT 24"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE tenants DROP COLUMN cancellation_cutoff_hours")
