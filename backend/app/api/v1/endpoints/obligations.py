"""
/api/v1/obligations — obligation extraction and tracking endpoints.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.clerk import ClerkClaims, get_current_user
from app.config import settings
from app.db.session import get_db
from app.models.contract import Contract
from app.models.obligation import Obligation
from app.models.user import User
from app.services import extractor, storage
from app.services.llm import get_fast_llm

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/obligations", tags=["obligations"])

_OBLIGATION_PROMPT = PromptTemplate(
    input_variables=["text", "today"],
    template="""You are a legal analyst specialising in contract obligation extraction.

Extract ALL contractual obligations — duties, responsibilities, and requirements that any party MUST perform.

Today's date: {today}

Return ONLY a valid JSON array of obligation objects (no extra text, no markdown fences). Each object must have exactly these fields:
{{
  "title": "short action-oriented title (max 8 words, start with a verb)",
  "description": "1–2 sentence description of what must be done and why",
  "responsible_party": "name or role of the party who must perform this obligation, or null",
  "due_date": "YYYY-MM-DD if a specific date applies, else null",
  "recurrence": "one-time | monthly | quarterly | annual | null",
  "category": "payment | notice | delivery | reporting | compliance | other",
  "section": "section number or clause heading where this appears, or null",
  "source_clause": "the exact verbatim clause text (max 200 chars) or null"
}}

Rules:
- Extract 5–20 obligations maximum
- Include payment obligations (amounts, schedule)
- Include notice obligations (required notice periods, termination notice)
- Include delivery obligations (goods, services, documents)
- Include reporting obligations (financial reports, audits, certifications)
- Include compliance obligations (regulatory, insurance, confidentiality)
- Only include genuine obligations — skip aspirational language ("shall endeavour to")
- If a recurrence is mentioned (monthly, quarterly, etc.) set the recurrence field
- Skip obvious boilerplate like "parties agree to be bound by this agreement"

Contract text:
{text}""",
)


class ExtractRequest(BaseModel):
    contract_ids: list[str]


class UpdateObligationRequest(BaseModel):
    status: Optional[str] = None          # pending / done / snoozed
    note: Optional[str] = None
    due_date: Optional[str] = None        # YYYY-MM-DD, or "" to clear
    category: Optional[str] = None        # payment | notice | delivery | reporting | compliance | other
    title: Optional[str] = None
    responsible_party: Optional[str] = None
    snooze_until: Optional[str] = None    # YYYY-MM-DD, or "" to clear; sets status=snoozed automatically
    reminder_date: Optional[str] = None   # ISO datetime string, or "" to clear
    reminder_email: Optional[str] = None  # email address, or "" to clear


class CreateObligationRequest(BaseModel):
    contract_id: str
    title: str
    description: str = ""
    category: str = "other"
    due_date: Optional[str] = None        # YYYY-MM-DD
    responsible_party: Optional[str] = None
    recurrence: Optional[str] = None      # one-time / monthly / quarterly / annual


class ObligationOut(BaseModel):
    id: str
    contract_id: str
    contract_name: str
    title: str
    description: str
    responsible_party: Optional[str]
    due_date: Optional[str]
    recurrence: Optional[str]
    category: str
    status: str
    note: Optional[str]
    section: Optional[str]
    source_clause: Optional[str]
    snooze_until: Optional[str]
    reminder_date: Optional[str]
    reminder_email: Optional[str]
    reminder_sent: bool
    created_at: str


def _get_operative_text(text: str, max_chars: int) -> str:
    """Skip boilerplate definitions sections and jump to operative clauses."""
    # Markers that typically signal the start of substantive obligations
    markers = [
        "NOW, THEREFORE",
        "NOW THEREFORE",
        "IT IS AGREED",
        "THE PARTIES AGREE",
        "WITNESSETH",
        "\n2 ",       # Clause 2 heading
        "\n2.\t",
        "\n2. ",
        "\nCLAUSE 2",
    ]
    start = 0
    for marker in markers:
        idx = text.find(marker)
        if 0 < idx < len(text) // 2:  # only skip if marker is in first half
            start = max(start, idx)

    operative = text[start:]
    if len(operative) > max_chars:
        return operative[:max_chars]
    return operative


def _parse_obligations(
    raw: str,
    contract_id: str,
    contract_name: str,
    org_id: Optional[uuid.UUID],
    extracted_by: Optional[uuid.UUID],
) -> list[Obligation]:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
    items: list[dict[str, Any]] = json.loads(raw.strip())
    obligations = []
    for item in items:
        due_date = None
        raw_date = item.get("due_date")
        if raw_date:
            try:
                due_date = date.fromisoformat(raw_date)
            except ValueError:
                pass
        obligations.append(Obligation(
            contract_id=uuid.UUID(contract_id),
            org_id=org_id,
            extracted_by=extracted_by,
            title=item.get("title", "Obligation"),
            description=item.get("description", ""),
            responsible_party=item.get("responsible_party"),
            due_date=due_date,
            recurrence=item.get("recurrence"),
            category=item.get("category", "other"),
            section=item.get("section"),
            source_clause=item.get("source_clause"),
            contract_name=contract_name,
            status="pending",
        ))
    return obligations


async def _get_user(claims: ClerkClaims, db: AsyncSession) -> User:
    result = await db.execute(
        select(User)
        .options(selectinload(User.memberships))
        .where(User.clerk_user_id == claims.sub)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not onboarded")
    return user


def _obligation_out(o: Obligation) -> ObligationOut:
    return ObligationOut(
        id=str(o.id),
        contract_id=str(o.contract_id),
        contract_name=o.contract_name or "",
        title=o.title,
        description=o.description,
        responsible_party=o.responsible_party,
        due_date=o.due_date.isoformat() if o.due_date else None,
        recurrence=o.recurrence,
        category=o.category,
        status=o.status,
        note=o.note,
        section=o.section,
        source_clause=o.source_clause,
        snooze_until=o.snooze_until.isoformat() if o.snooze_until else None,
        reminder_date=o.reminder_date.isoformat() if o.reminder_date else None,
        reminder_email=o.reminder_email,
        reminder_sent=o.reminder_sent,
        created_at=o.created_at.isoformat(),
    )


# ─── Extract obligations from contracts ───────────────────────────────────────

@router.post("/extract")
@limiter.limit("10/minute")
async def extract_obligations(
    request: Request,
    body: ExtractRequest,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not body.contract_ids:
        raise HTTPException(status_code=422, detail="No contract IDs provided")

    user = await _get_user(claims, db)
    org_ids = [m.org_id for m in user.memberships]
    today = date.today()

    all_obligations: list[Obligation] = []

    for raw_id in body.contract_ids:
        try:
            contract_uuid = uuid.UUID(raw_id)
        except ValueError:
            continue

        result = await db.execute(
            select(Contract).where(Contract.id == contract_uuid, Contract.status == "ready")
        )
        contract = result.scalar_one_or_none()
        if contract is None:
            continue
        if contract.uploaded_by != user.id and (not org_ids or contract.org_id not in org_ids):
            continue

        # Check cache — if obligations already extracted for this contract, return them
        existing = await db.execute(
            select(Obligation).where(Obligation.contract_id == contract_uuid)
        )
        cached = existing.scalars().all()
        if cached:
            all_obligations.extend(cached)
            continue

        # Get text — use stored full_text if available, otherwise fall back to S3 download
        if contract.full_text:
            text = contract.full_text
        else:
            logger.warning("Contract %s has no full_text, falling back to S3 download", contract.id)
            file_bytes = await storage.download_file(contract.file_key)
            extraction = await extractor.extract_text(file_bytes, contract.file_type)
            text = extraction.text

        llm = get_fast_llm()
        chain = _OBLIGATION_PROMPT | llm | StrOutputParser()
        raw = await chain.ainvoke({
            "text": _get_operative_text(text, settings.obligations_max_chars),
            "today": today.isoformat(),
        })

        try:
            obligations = _parse_obligations(
                raw, str(contract.id), contract.name,
                contract.org_id, user.id,
            )
        except (json.JSONDecodeError, ValueError, KeyError):
            obligations = []

        for o in obligations:
            db.add(o)
        await db.commit()
        for o in obligations:
            await db.refresh(o)
        all_obligations.extend(obligations)

    all_obligations.sort(key=lambda o: (o.due_date or date.max))
    return {"obligations": [_obligation_out(o).model_dump() for o in all_obligations]}


# ─── List all obligations for current user's contracts ────────────────────────

@router.get("/")
async def list_obligations(
    status_filter: Optional[str] = None,
    category: Optional[str] = None,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(claims, db)
    org_ids = [m.org_id for m in user.memberships]

    # Get all contract IDs the user has access to
    q = select(Contract.id).where(Contract.uploaded_by == user.id, Contract.status == "ready")
    if org_ids:
        from sqlalchemy import or_
        q = select(Contract.id).where(
            or_(Contract.uploaded_by == user.id, Contract.org_id.in_(org_ids)),
            Contract.status == "ready",
        )
    contract_ids_result = await db.execute(q)
    contract_ids = [r[0] for r in contract_ids_result]

    if not contract_ids:
        return {"obligations": []}

    oq = select(Obligation).where(Obligation.contract_id.in_(contract_ids))
    if status_filter:
        oq = oq.where(Obligation.status == status_filter)
    if category:
        oq = oq.where(Obligation.category == category)
    oq = oq.order_by(Obligation.due_date.asc().nulls_last(), Obligation.created_at.desc())

    result = await db.execute(oq)
    obligations = result.scalars().all()
    return {"obligations": [_obligation_out(o).model_dump() for o in obligations]}


# ─── Update obligation status / note ─────────────────────────────────────────

@router.patch("/{obligation_id}")
async def update_obligation(
    obligation_id: uuid.UUID,
    body: UpdateObligationRequest,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(claims, db)
    org_ids = [m.org_id for m in user.memberships]

    result = await db.execute(select(Obligation).where(Obligation.id == obligation_id))
    obligation = result.scalar_one_or_none()
    if obligation is None:
        raise HTTPException(status_code=404, detail="Obligation not found")

    # Verify access via contract
    cr = await db.execute(select(Contract).where(Contract.id == obligation.contract_id))
    contract = cr.scalar_one_or_none()
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.uploaded_by != user.id and (not org_ids or contract.org_id not in org_ids):
        raise HTTPException(status_code=403, detail="Access denied")

    if body.status is not None:
        if body.status not in ("pending", "done", "snoozed"):
            raise HTTPException(status_code=400, detail="status must be pending, done, or snoozed")
        obligation.status = body.status
    if body.title is not None:
        obligation.title = body.title.strip() or obligation.title
    if body.note is not None:
        obligation.note = body.note or None
    if body.category is not None:
        valid_cats = {"payment", "notice", "delivery", "reporting", "compliance", "other"}
        if body.category not in valid_cats:
            raise HTTPException(status_code=400, detail=f"category must be one of {valid_cats}")
        obligation.category = body.category
    if body.responsible_party is not None:
        obligation.responsible_party = body.responsible_party or None
    if body.due_date is not None:
        if body.due_date == "":
            obligation.due_date = None
        else:
            try:
                obligation.due_date = date.fromisoformat(body.due_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="due_date must be YYYY-MM-DD or empty string")
    if body.snooze_until is not None:
        from datetime import datetime, timezone
        if body.snooze_until == "":
            obligation.snooze_until = None
            # Only revert to pending if currently snoozed
            if obligation.status == "snoozed":
                obligation.status = "pending"
        else:
            try:
                snooze_date = date.fromisoformat(body.snooze_until)
                obligation.snooze_until = datetime(snooze_date.year, snooze_date.month, snooze_date.day, 9, 0, 0, tzinfo=timezone.utc)
                obligation.status = "snoozed"
            except ValueError:
                raise HTTPException(status_code=400, detail="snooze_until must be YYYY-MM-DD or empty string")
    if body.reminder_date is not None:
        from datetime import datetime, timezone, timedelta
        if body.reminder_date == "":
            obligation.reminder_date = None
            obligation.reminder_sent = False
        else:
            parsed = datetime.fromisoformat(body.reminder_date)
            if parsed.tzinfo is None:
                # Fallback: treat naive datetimes as IST
                parsed = parsed.replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
            obligation.reminder_date = parsed.astimezone(timezone.utc)
            obligation.reminder_sent = False
    if body.reminder_email is not None:
        obligation.reminder_email = body.reminder_email or None

    await db.commit()
    return _obligation_out(obligation).model_dump()


# ─── Manually create an obligation ───────────────────────────────────────────

@router.post("/manual", status_code=status.HTTP_201_CREATED)
async def create_obligation_manual(
    body: CreateObligationRequest,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(claims, db)
    org_ids = [m.org_id for m in user.memberships]

    try:
        contract_uuid = uuid.UUID(body.contract_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid contract ID")

    result = await db.execute(select(Contract).where(Contract.id == contract_uuid))
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.uploaded_by != user.id and (not org_ids or contract.org_id not in org_ids):
        raise HTTPException(status_code=403, detail="Access denied")

    valid_cats = {"payment", "notice", "delivery", "reporting", "compliance", "other"}
    if body.category not in valid_cats:
        raise HTTPException(status_code=400, detail="Invalid category")

    due_date = None
    if body.due_date:
        try:
            due_date = date.fromisoformat(body.due_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="due_date must be YYYY-MM-DD")

    obligation = Obligation(
        contract_id=contract_uuid,
        org_id=contract.org_id,
        extracted_by=user.id,
        title=body.title.strip(),
        description=body.description.strip(),
        responsible_party=body.responsible_party or None,
        due_date=due_date,
        recurrence=body.recurrence or None,
        category=body.category,
        contract_name=contract.name,
        status="pending",
    )
    db.add(obligation)
    await db.commit()
    await db.refresh(obligation)
    return _obligation_out(obligation).model_dump()


# ─── Delete obligation ────────────────────────────────────────────────────────

@router.delete("/{obligation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_obligation(
    obligation_id: uuid.UUID,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await _get_user(claims, db)
    org_ids = [m.org_id for m in user.memberships]

    result = await db.execute(select(Obligation).where(Obligation.id == obligation_id))
    obligation = result.scalar_one_or_none()
    if obligation is None:
        raise HTTPException(status_code=404, detail="Obligation not found")

    cr = await db.execute(select(Contract).where(Contract.id == obligation.contract_id))
    contract = cr.scalar_one_or_none()
    if contract is None or (contract.uploaded_by != user.id and (not org_ids or contract.org_id not in org_ids)):
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(obligation)
    await db.commit()
