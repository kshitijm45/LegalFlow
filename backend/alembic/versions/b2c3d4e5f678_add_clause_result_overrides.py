"""add clause audit result override columns

Revision ID: b2c3d4e5f678
Revises: 3f8a1c2d4e57
Create Date: 2026-05-10

"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f678'
down_revision = '3f8a1c2d4e57'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('clause_audit_results', sa.Column('override_status', sa.String(), nullable=True))
    op.add_column('clause_audit_results', sa.Column('override_note', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('clause_audit_results', 'override_note')
    op.drop_column('clause_audit_results', 'override_status')
