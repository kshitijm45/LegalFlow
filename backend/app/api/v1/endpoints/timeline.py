"""
/api/v1/timeline — contract timeline extraction endpoints.
"""
from __future__ import annotations

import asyncio
import json
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

import logging

from app.auth.clerk import ClerkClaims, get_current_user
from app.config import settings
from app.db.session import get_db
from app.models.contract import Contract
from app.models.user import User
from app.services import extractor, storage
from app.services.llm import get_fast_llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/timeline", tags=["timeline"])

_TIMELINE_PROMPT = PromptTemplate(
    input_variables=["text", "today"],
    template="""You are a legal analyst specializing in contract timeline extraction.

Extract ALL time-bound events from this contract — dates, deadlines, milestones, payments, renewals, reviews, and the contract start date.

Today's date: {today}

Return ONLY a valid JSON array of event objects (no extra text, no markdown fences). Each object must have exactly these fields:
{{
  "title": "short descriptive title (max 8 words)",
  "date": "YYYY-MM-DD",
  "type": "start | milestone | deadline | renewal | payment | review",
  "description": "1 sentence description of this event",
  "section": "section number or clause heading where this appears, or null",
  "sourceClause": "the exact verbatim clause text (max 200 chars) or null",
  "amount": "currency amount string if this is a payment event (e.g. '$50,000'), or null"
}}

Rules:
- Extract 5–15 events maximum
- Include the contract effective/start date as type "start"
- Include expiry/termination date as type "deadline"
- Include every payment schedule entry as type "payment"
- Include every renewal window or notice deadline as type "renewal"
- Include review periods as type "review"
- Include key milestones (delivery, go-live, acceptance, etc.) as type "milestone"
- Only include events with a specific YYYY-MM-DD date — skip vague references

Contract text:
{text}""",
)


class TimelineGenerateRequest(BaseModel):
    contract_ids: list[str]
    force_regenerate: bool = False


class TimelineEventOut(BaseModel):
    id: str
    title: str
    date: str
    type: str
    documentId: str
    documentName: str
    description: str
    status: str
    section: Optional[str] = None
    sourceClause: Optional[str] = None
    amount: Optional[str] = None


class TimelineGenerateResponse(BaseModel):
    events: list[TimelineEventOut]


# Deadline, payment, review, AND renewal are actionable past-due — mark them overdue
_OVERDUE_TYPES = {"deadline", "payment", "review", "renewal"}


def _compute_status(event_date_str: str, event_type: str, today: date) -> str:
    try:
        event_date = date.fromisoformat(event_date_str)
    except ValueError:
        return "upcoming"
    if event_date < today and event_type in _OVERDUE_TYPES:
        return "overdue"
    if event_date < today:
        return "completed"
    return "upcoming"


def _parse_events(raw: str, contract_id: str, contract_name: str, today: date) -> list[TimelineEventOut]:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
    items: list[dict[str, Any]] = json.loads(raw.strip())
    events = []
    for item in items:
        date_str = item.get("date", "")
        event_type = item.get("type", "milestone")
        events.append(TimelineEventOut(
            id=str(uuid.uuid4()),
            title=item.get("title", "Event"),
            date=date_str,
            type=event_type,
            documentId=contract_id,
            documentName=contract_name,
            description=item.get("description", ""),
            status=_compute_status(date_str, event_type, today),
            section=item.get("section"),
            sourceClause=item.get("sourceClause"),
            amount=item.get("amount"),
        ))
    return events


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


async def _events_for_contract(
    contract: Contract,
    today: date,
    force_regenerate: bool = False,
) -> tuple[list[TimelineEventOut], bool]:
    """
    Returns (events, should_cache).
    should_cache is True when fresh LLM events were generated and need writing to DB.
    No DB writes happen here — caller batches them after asyncio.gather.
    """
    if not force_regenerate and contract.timeline_events:
        cached = [
            TimelineEventOut(
                **{**ev, "status": _compute_status(ev.get("date", ""), ev.get("type", "milestone"), today)}
            )
            for ev in contract.timeline_events
        ]
        return cached, False

    # Fetch text
    if contract.full_text:
        text = contract.full_text
    else:
        logger.warning("Contract %s has no full_text, falling back to S3", contract.id)
        try:
            file_bytes = await storage.download_file(contract.file_key)
            extraction = await extractor.extract_text(file_bytes, contract.file_type)
            text = extraction.text
        except Exception as exc:
            logger.error("Failed to fetch text for contract %s: %s", contract.id, exc)
            return [], False

    llm = get_fast_llm()
    chain = _TIMELINE_PROMPT | llm | StrOutputParser()
    raw = await chain.ainvoke({"text": text[:settings.timeline_max_chars], "today": today.isoformat()})

    try:
        events = _parse_events(raw, str(contract.id), contract.name, today)
    except (json.JSONDecodeError, ValueError, KeyError) as exc:
        logger.error(
            "Timeline parse failed for contract %s: %s | Raw output (first 500): %.500s",
            contract.id, exc, raw,
        )
        return [], False

    return events, True


@router.post("/generate", response_model=TimelineGenerateResponse)
@limiter.limit("10/minute")
async def generate_timeline(
    request: Request,
    body: TimelineGenerateRequest,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimelineGenerateResponse:
    if not body.contract_ids:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No contract IDs provided")

    user = await _get_user(claims, db)
    org_ids = [m.org_id for m in user.memberships]
    today = date.today()

    # Parse and validate UUIDs, load all matching contracts in one query
    valid_uuids = []
    for raw_id in body.contract_ids:
        try:
            valid_uuids.append(uuid.UUID(raw_id))
        except ValueError:
            continue

    if not valid_uuids:
        return TimelineGenerateResponse(events=[])

    result = await db.execute(
        select(Contract).where(
            Contract.id.in_(valid_uuids),
            Contract.status == "ready",
        )
    )
    contracts = list(result.scalars().all())

    # Enforce org-level access
    accessible = [
        c for c in contracts
        if c.uploaded_by == user.id or (org_ids and c.org_id in org_ids)
    ]

    if not accessible:
        return TimelineGenerateResponse(events=[])

    # Process all contracts in parallel — LLM calls only, no DB writes inside
    gathered = await asyncio.gather(
        *[_events_for_contract(c, today, body.force_regenerate) for c in accessible]
    )

    # Collect events, write cache updates in a single commit
    all_events: list[TimelineEventOut] = []
    needs_commit = False
    for contract, (events, should_cache) in zip(accessible, gathered):
        if should_cache and events:
            # Exclude status — it's always recomputed from today's date on read
            contract.timeline_events = [e.model_dump(exclude={"status"}) for e in events]
            needs_commit = True
        all_events.extend(events)

    if needs_commit:
        await db.commit()

    all_events.sort(key=lambda e: e.date)
    return TimelineGenerateResponse(events=all_events)
