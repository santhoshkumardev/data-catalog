"""Add integration annotation fields to table_lineage

Revision ID: 0005
Revises: 0004
Create Date: 2026-02-16 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("table_lineage", sa.Column("integration_description", sa.Text(), nullable=True))
    op.add_column("table_lineage", sa.Column("integration_method", sa.String(100), nullable=True))
    op.add_column("table_lineage", sa.Column("integration_schedule", sa.String(255), nullable=True))
    op.add_column("table_lineage", sa.Column("integration_notes", sa.Text(), nullable=True))
    op.add_column("table_lineage", sa.Column("integration_updated_by", UUID(as_uuid=True), nullable=True))
    op.add_column("table_lineage", sa.Column("integration_updated_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_lineage_integration_updated_by",
        "table_lineage",
        "users",
        ["integration_updated_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_lineage_integration_updated_by", "table_lineage", type_="foreignkey")
    op.drop_column("table_lineage", "integration_updated_at")
    op.drop_column("table_lineage", "integration_updated_by")
    op.drop_column("table_lineage", "integration_notes")
    op.drop_column("table_lineage", "integration_schedule")
    op.drop_column("table_lineage", "integration_method")
    op.drop_column("table_lineage", "integration_description")
