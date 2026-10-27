"""Add measured supply volumes to monthly billing entries.

Revision ID: 20261026_supply_volumes
Revises: 232816598793
Create Date: 2026-10-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261026_supply_volumes"
down_revision: Union[str, Sequence[str], None] = "232816598793"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "billing_entries",
        sa.Column("municipal_volume_kl", sa.Float(), nullable=True),
    )
    op.add_column(
        "billing_entries",
        sa.Column("borewell_volume_kl", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("billing_entries", "borewell_volume_kl")
    op.drop_column("billing_entries", "municipal_volume_kl")
