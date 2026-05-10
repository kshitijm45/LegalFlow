"""merge workflow and clause override heads

Revision ID: ef9affc7ed1d
Revises: a1b2c3d4e5f6, b2c3d4e5f678
Create Date: 2026-05-10 19:04:27.395752

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ef9affc7ed1d'
down_revision: Union[str, None] = ('a1b2c3d4e5f6', 'b2c3d4e5f678')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
