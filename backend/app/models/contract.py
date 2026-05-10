from __future__ import annotations

import uuid
from datetime import datetime, date
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), index=True, nullable=True
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(256))
    color: Mapped[str] = mapped_column(String(16), default="#4338CA")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    contracts: Mapped[list[Contract]] = relationship(
        secondary="contract_collections", back_populates="collections"
    )


class ContractCollection(Base):
    __tablename__ = "contract_collections"

    contract_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contracts.id", ondelete="CASCADE"), primary_key=True
    )
    collection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True
    )


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), index=True, nullable=True
    )
    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # File info
    name: Mapped[str] = mapped_column(String(512))
    original_filename: Mapped[str] = mapped_column(String(512))
    file_key: Mapped[str] = mapped_column(String(1024))  # S3 object key
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_type: Mapped[str] = mapped_column(String(10))  # pdf | docx | txt

    # Processing pipeline
    status: Mapped[str] = mapped_column(String(32), default="pending")
    # pending → processing → ready | failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    page_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Full extracted text — stored once at processing time, used by chat/obligations/timeline
    full_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # AI-extracted metadata
    contract_type: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    parties: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    effective_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    jurisdiction: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Tags applied by workflow actions or manually
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Cached AI outputs (avoids re-calling LLM on repeated requests)
    timeline_events: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    collections: Mapped[list[Collection]] = relationship(
        secondary="contract_collections", back_populates="contracts"
    )
