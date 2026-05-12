"""add collection parent_id for hierarchical folders

Revision ID: f3g4h5i6j7k8
Revises: c1d2e3f4a5b6
Create Date: 2026-05-12 14:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f3g4h5i6j7k8"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "collections",
        sa.Column(
            "parent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("collections.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index("ix_collections_parent_id", "collections", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_collections_parent_id", table_name="collections")
    op.drop_column("collections", "parent_id")
