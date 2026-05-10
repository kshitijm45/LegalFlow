"""Clause audit endpoints."""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.clerk import ClerkClaims, get_current_user
from app.db.session import get_db
from app.models.clause_audit import ClauseAudit, ClauseAuditResult
from app.models.contract import Contract
from app.services.clause_audit import PLAYBOOKS, detect_playbook_types, run_clause_audit
from app.services.storage import download_file

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/clause-audit", tags=["clause-audit"])

_VALID_STATUSES = {"present", "partial", "missing"}


# ─── DTOs ─────────────────────────────────────────────────────────────────────

class ClauseResultOut(BaseModel):
    id: str
    clause_key: str
    clause_name: str
    playbook_type: str
    status: str
    mandatory: bool
    risk: str
    found_text: Optional[str]
    ai_notes: Optional[str]
    suggested_text: Optional[str]
    override_status: Optional[str]
    override_note: Optional[str]


class ClauseAuditOut(BaseModel):
    id: str
    contract_id: str
    contract_name: str
    playbook_types: list[str]
    status: str
    error: Optional[str]
    overall_score: Optional[float]
    created_at: str
    results: list[ClauseResultOut]


def _result_out(r: ClauseAuditResult) -> ClauseResultOut:
    return ClauseResultOut(
        id=str(r.id),
        clause_key=r.clause_key,
        clause_name=r.clause_name,
        playbook_type=r.playbook_type,
        status=r.status,
        mandatory=r.mandatory,
        risk=r.risk,
        found_text=r.found_text,
        ai_notes=r.ai_notes,
        suggested_text=r.suggested_text,
        override_status=r.override_status,
        override_note=r.override_note,
    )


def _audit_out(audit: ClauseAudit, contract_name: str, results: list[ClauseAuditResult]) -> ClauseAuditOut:
    return ClauseAuditOut(
        id=str(audit.id),
        contract_id=str(audit.contract_id),
        contract_name=contract_name,
        playbook_types=audit.playbook_types,
        status=audit.status,
        error=audit.error,
        overall_score=audit.overall_score,
        created_at=audit.created_at.isoformat(),
        results=[_result_out(r) for r in results],
    )


def _org_id(user: ClerkClaims) -> str:
    return user.org_id or user.sub


# ─── GET /playbooks ───────────────────────────────────────────────────────────

@router.get("/playbooks")
async def list_playbooks(_: ClerkClaims = Depends(get_current_user)) -> dict:
    return {
        "playbooks": [
            {"key": k, "name": v["name"], "short": v["short"], "clause_count": len(v["clauses"])}
            for k, v in PLAYBOOKS.items()
        ]
    }


# ─── POST /detect/{contract_id} ───────────────────────────────────────────────

@router.post("/detect/{contract_id}")
async def detect_playbook(
    contract_id: str,
    user: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(select(Contract).where(Contract.id == uuid.UUID(contract_id)))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    types = await detect_playbook_types(
        name=contract.name,
        contract_type=contract.contract_type,
        full_text=contract.full_text,
    )
    return {"playbook_types": types}


# ─── POST /run ────────────────────────────────────────────────────────────────

class RunAuditRequest(BaseModel):
    contract_id: str
    playbook_types: list[str]


@router.post("/run", response_model=ClauseAuditOut)
@limiter.limit("10/minute")
async def run_audit(
    request: Request,
    body: RunAuditRequest,
    user: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClauseAuditOut:
    invalid = [pt for pt in body.playbook_types if pt not in PLAYBOOKS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown playbook types: {invalid}")
    if not body.playbook_types:
        raise HTTPException(status_code=400, detail="At least one playbook type required")

    result = await db.execute(select(Contract).where(Contract.id == uuid.UUID(body.contract_id)))
    contract: Contract | None = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.status != "ready":
        raise HTTPException(status_code=400, detail="Contract is not ready for analysis")

    full_text: str | None = contract.full_text
    if not full_text and contract.file_key:
        logger.warning("full_text missing for %s — falling back to S3", contract.id)
        try:
            raw_bytes = await download_file(contract.file_key)
            full_text = raw_bytes.decode("utf-8", errors="replace")
        except Exception:
            pass
    if not full_text:
        raise HTTPException(
            status_code=422,
            detail="Contract text not available. Re-upload the document to enable clause audit.",
        )

    org_id = _org_id(user)
    audit = ClauseAudit(
        contract_id=contract.id,
        org_id=org_id,
        playbook_types=body.playbook_types,
        status="running",
    )
    db.add(audit)
    await db.flush()

    try:
        raw_results, score = await run_clause_audit(
            full_text=full_text,
            playbook_types=body.playbook_types,
        )
    except Exception as exc:
        logger.error("Clause audit failed for %s: %s", contract.id, exc)
        audit.status = "failed"
        audit.error = str(exc)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Audit failed: {exc}")

    db_results: list[ClauseAuditResult] = []
    for r in raw_results:
        row = ClauseAuditResult(
            audit_id=audit.id,
            clause_key=r["clause_key"],
            clause_name=r["clause_name"],
            playbook_type=r["playbook_type"],
            status=r["status"],
            mandatory=r["mandatory"],
            risk=r["risk"],
            found_text=r.get("found_text"),
            ai_notes=r.get("ai_notes"),
            suggested_text=r.get("suggested_text"),
        )
        db.add(row)
        db_results.append(row)

    audit.status = "done"
    audit.overall_score = score
    await db.commit()

    return _audit_out(audit, contract.name, db_results)


# ─── GET /{audit_id} ─────────────────────────────────────────────────────────

@router.get("/{audit_id}", response_model=ClauseAuditOut)
async def get_audit(
    audit_id: str,
    user: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClauseAuditOut:
    result = await db.execute(
        select(ClauseAudit)
        .options(selectinload(ClauseAudit.results))
        .where(
            ClauseAudit.id == uuid.UUID(audit_id),
            ClauseAudit.org_id == _org_id(user),
        )
    )
    audit: ClauseAudit | None = result.scalar_one_or_none()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    contract_result = await db.execute(select(Contract).where(Contract.id == audit.contract_id))
    contract = contract_result.scalar_one_or_none()
    contract_name = contract.name if contract else "Unknown"

    return _audit_out(audit, contract_name, audit.results)


# ─── GET /contract/{contract_id} ─────────────────────────────────────────────

@router.get("/contract/{contract_id}")
async def list_audits_for_contract(
    contract_id: str,
    user: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(ClauseAudit)
        .options(selectinload(ClauseAudit.results))
        .where(
            ClauseAudit.contract_id == uuid.UUID(contract_id),
            ClauseAudit.org_id == _org_id(user),
        )
        .order_by(ClauseAudit.created_at.desc())
        .limit(20)
    )
    audits = list(result.scalars().all())

    contract_result = await db.execute(select(Contract).where(Contract.id == uuid.UUID(contract_id)))
    contract = contract_result.scalar_one_or_none()
    contract_name = contract.name if contract else "Unknown"

    out = [_audit_out(a, contract_name, a.results) for a in audits]
    return {"audits": [a.model_dump() for a in out]}


# ─── PATCH /results/{result_id} ──────────────────────────────────────────────

class UpdateResultRequest(BaseModel):
    override_status: Optional[str] = None
    override_note: Optional[str] = None


@router.patch("/results/{result_id}", response_model=ClauseResultOut)
async def update_result(
    result_id: str,
    body: UpdateResultRequest,
    user: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClauseResultOut:
    result = await db.execute(
        select(ClauseAuditResult)
        .join(ClauseAudit, ClauseAuditResult.audit_id == ClauseAudit.id)
        .where(
            ClauseAuditResult.id == uuid.UUID(result_id),
            ClauseAudit.org_id == _org_id(user),
        )
    )
    row: ClauseAuditResult | None = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found")

    if body.override_status is not None and body.override_status not in _VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"override_status must be one of: {', '.join(_VALID_STATUSES)}",
        )

    row.override_status = body.override_status or None
    row.override_note = body.override_note or None

    await db.commit()
    return _result_out(row)
