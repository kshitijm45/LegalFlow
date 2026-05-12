from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class MarketAnalysis(Base):
    __tablename__ = "market_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[str] = mapped_column(String, nullable=False)
    deal_type: Mapped[str] = mapped_column(String, nullable=False)   # sha / ssa / bta / spa / loan
    perspective: Mapped[str] = mapped_column(String, nullable=False)  # buyer / seller / lender / borrower / investor / promoter
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    overall_position: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    clauses: Mapped[list["MarketAnalysisClause"]] = relationship(
        "MarketAnalysisClause",
        back_populates="analysis",
        cascade="all, delete-orphan",
    )


class MarketAnalysisClause(Base):
    __tablename__ = "market_analysis_clauses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("market_analyses.id", ondelete="CASCADE"), nullable=False
    )
    clause_key: Mapped[str] = mapped_column(String, nullable=False)
    clause_name: Mapped[str] = mapped_column(String, nullable=False)
    found_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)   # -2 to +2
    position_label: Mapped[str] = mapped_column(String, nullable=False)
    market_standard: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    suggested_rewrite: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_level: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    mandatory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    analysis: Mapped["MarketAnalysis"] = relationship("MarketAnalysis", back_populates="clauses")
