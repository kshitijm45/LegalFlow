"""add_clause_audit_tables

Revision ID: 3f8a1c2d4e57
Revises: 45e14344f1ad
Create Date: 2026-05-10 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '3f8a1c2d4e57'
down_revision: Union[str, None] = '45e14344f1ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'clause_audits',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=sa.text('gen_random_uuid()')),
        sa.Column('contract_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('org_id', sa.String(), nullable=False),
        sa.Column('playbook_types', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('overall_score', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_clause_audits_contract_id', 'clause_audits', ['contract_id'])
    op.create_index('ix_clause_audits_org_id', 'clause_audits', ['org_id'])

    op.create_table(
        'clause_audit_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=sa.text('gen_random_uuid()')),
        sa.Column('audit_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('clause_key', sa.String(), nullable=False),
        sa.Column('clause_name', sa.String(), nullable=False),
        sa.Column('playbook_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('mandatory', sa.Boolean(), nullable=False),
        sa.Column('risk', sa.String(), nullable=False),
        sa.Column('found_text', sa.Text(), nullable=True),
        sa.Column('ai_notes', sa.Text(), nullable=True),
        sa.Column('suggested_text', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['audit_id'], ['clause_audits.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_clause_audit_results_audit_id', 'clause_audit_results', ['audit_id'])


def downgrade() -> None:
    op.drop_table('clause_audit_results')
    op.drop_table('clause_audits')
