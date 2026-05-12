"""add market analysis tables

Revision ID: c1d2e3f4a5b6
Revises: ef9affc7ed1d
Create Date: 2026-05-12 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "ef9affc7ed1d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "market_analyses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "contract_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contracts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("org_id", sa.String, nullable=False),
        sa.Column("deal_type", sa.String, nullable=False),
        sa.Column("perspective", sa.String, nullable=False),
        sa.Column("status", sa.String, nullable=False, server_default="pending"),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("overall_position", sa.Float, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_market_analyses_contract_id", "market_analyses", ["contract_id"])
    op.create_index("ix_market_analyses_org_id", "market_analyses", ["org_id"])

    op.create_table(
        "market_analysis_clauses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "analysis_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("market_analyses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("clause_key", sa.String, nullable=False),
        sa.Column("clause_name", sa.String, nullable=False),
        sa.Column("found_text", sa.Text, nullable=True),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("position_label", sa.String, nullable=False),
        sa.Column("market_standard", sa.Text, nullable=True),
        sa.Column("explanation", sa.Text, nullable=True),
        sa.Column("suggested_rewrite", sa.Text, nullable=True),
        sa.Column("risk_level", sa.String, nullable=False, server_default="medium"),
        sa.Column("mandatory", sa.Boolean, nullable=False, server_default="true"),
    )
    op.create_index(
        "ix_market_analysis_clauses_analysis_id",
        "market_analysis_clauses",
        ["analysis_id"],
    )


def downgrade() -> None:
    op.drop_table("market_analysis_clauses")
    op.drop_table("market_analyses")
