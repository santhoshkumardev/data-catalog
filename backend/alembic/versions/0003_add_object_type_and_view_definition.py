"""add object_type and view_definition to tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-15 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tables", sa.Column("object_type", sa.String(30), server_default="table", nullable=False))
    op.add_column("tables", sa.Column("view_definition", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("tables", "view_definition")
    op.drop_column("tables", "object_type")
