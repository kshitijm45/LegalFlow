from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ClauseAudit(Base):
    __tablename__ = "clause_audits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[str] = mapped_column(String, nullable=False)
    playbook_types: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    overall_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    results: Mapped[list["ClauseAuditResult"]] = relationship(
        "ClauseAuditResult",
        back_populates="audit",
        cascade="all, delete-orphan",
    )


class ClauseAuditResult(Base):
    __tablename__ = "clause_audit_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    audit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clause_audits.id", ondelete="CASCADE"), nullable=False
    )
    clause_key: Mapped[str] = mapped_column(String, nullable=False)
    clause_name: Mapped[str] = mapped_column(String, nullable=False)
    playbook_type: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)   # present / partial / missing
    mandatory: Mapped[bool] = mapped_column(Boolean, nullable=False)
    risk: Mapped[str] = mapped_column(String, nullable=False)     # high / medium / low
    found_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    suggested_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    override_status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    override_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    audit: Mapped["ClauseAudit"] = relationship("ClauseAudit", back_populates="results")
