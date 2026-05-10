from __future__ import annotations

import uuid
from datetime import datetime, date
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Obligation(Base):
    __tablename__ = "obligations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contracts.id", ondelete="CASCADE"), index=True
    )
    org_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), index=True, nullable=True
    )
    extracted_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(512))
    description: Mapped[str] = mapped_column(Text)
    responsible_party: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    recurrence: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # one-time / monthly / quarterly / annual
    category: Mapped[str] = mapped_column(String(64), default="other")  # payment / notice / delivery / reporting / compliance / other

    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending / done / snoozed
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    section: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    source_clause: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    contract_name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    snooze_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    reminder_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reminder_email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
