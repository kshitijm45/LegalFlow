"""add workflow tables and contract tags

Revision ID: a1b2c3d4e5f6
Revises: f2402dc26296
Create Date: 2026-05-10 00:00:00.000000

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a1b2c3d4e5f6"
down_revision = "f2402dc26296"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workflows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("nodes", sa.JSON, nullable=True),
        sa.Column("edges", sa.JSON, nullable=True),
        sa.Column("last_run", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"],     ["orgs.id"],   ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"],  ondelete="SET NULL"),
    )
    op.create_index("ix_workflows_org_id",     "workflows", ["org_id"])
    op.create_index("ix_workflows_created_by", "workflows", ["created_by"])

    op.create_table(
        "workflow_runs",
        sa.Column("id",           postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workflow_id",  postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contract_id",  postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status",       sa.String(32),  nullable=False, server_default="pending"),
        sa.Column("trigger_type", sa.String(32),  nullable=True),
        sa.Column("run_log",      sa.JSON,        nullable=True),
        sa.Column("error",        sa.Text,        nullable=True),
        sa.Column("started_at",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contract_id"], ["contracts.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_workflow_runs_workflow_id", "workflow_runs", ["workflow_id"])
    op.create_index("ix_workflow_runs_contract_id", "workflow_runs", ["contract_id"])

    # Add tags column to contracts (list of string tags applied by workflow actions)
    op.add_column("contracts", sa.Column("tags", sa.JSON, nullable=True))


def downgrade() -> None:
    op.drop_column("contracts", "tags")
    op.drop_table("workflow_runs")
    op.drop_table("workflows")
