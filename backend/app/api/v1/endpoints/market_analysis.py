"""Market analysis endpoints."""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.clerk import ClerkClaims, get_current_user
from app.db.session import get_db
from app.models.contract import Contract
from app.models.market_analysis import MarketAnalysis, MarketAnalysisClause
from app.services.clause_audit import detect_playbook_types
from app.services.market_analysis import (
    get_deal_types,
    get_perspectives,
    run_market_analysis,
)
from app.services.storage import download_file

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/market-analysis", tags=["market-analysis"])


# ─── DTOs ─────────────────────────────────────────────────────────────────────

class MarketClauseOut(BaseModel):
    id: str
    clause_key: str
    clause_name: str
    found_text: Optional[str]
    position: int
    position_label: str
    market_standard: Optional[str]
    explanation: Optional[str]
    suggested_rewrite: Optional[str]
    risk_level: str
    mandatory: bool


class MarketAnalysisOut(BaseModel):
    id: str
    contract_id: str
    contract_name: str
    deal_type: str
    perspective: str
    status: str
    error: Optional[str]
    overall_position: Optional[float]
    created_at: str
    clauses: list[MarketClauseOut]


def _clause_out(c: MarketAnalysisClause) -> MarketClauseOut:
    return MarketClauseOut(
        id=str(c.id),
        clause_key=c.clause_key,
        clause_name=c.clause_name,
        found_text=c.found_text,
        position=c.position,
        position_label=c.position_label,
        market_standard=c.market_standard,
        explanation=c.explanation,
        suggested_rewrite=c.suggested_rewrite,
        risk_level=c.risk_level,
        mandatory=c.mandatory,
    )


def _analysis_out(
    analysis: MarketAnalysis,
    contract_name: str,
    clauses: list[MarketAnalysisClause],
) -> MarketAnalysisOut:
    return MarketAnalysisOut(
        id=str(analysis.id),
        contract_id=str(analysis.contract_id),
        contract_name=contract_name,
        deal_type=analysis.deal_type,
        perspective=analysis.perspective,
        status=analysis.status,
        error=analysis.error,
        overall_position=analysis.overall_position,
        created_at=analysis.created_at.isoformat(),
        clauses=[_clause_out(c) for c in clauses],
    )


def _org_id(user: ClerkClaims) -> str:
    return user.org_id or user.sub


# ─── GET /deal-types ─────────────────────────────────────────────────────────

@router.get("/deal-types")
async def list_deal_types(_: ClerkClaims = Depends(get_current_user)) -> dict:
    types = get_deal_types()
    return {
        "deal_types": [
            {
                "key": k,
                "name": v,
                "perspectives": [
                    {"key": pk, "label": pl}
                    for pk, pl in get_perspectives(k).items()
                ],
            }
            for k, v in types.items()
        ]
    }


# ─── POST /detect/{contract_id} ──────────────────────────────────────────────

@router.post("/detect/{contract_id}")
async def detect_deal_type(
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
    detected = types[0] if types and types[0] != "other" else None
    perspectives = get_perspectives(detected) if detected else {}
    return {
        "detected_deal_type": detected,
        "perspectives": [{"key": k, "label": v} for k, v in perspectives.items()],
    }


# ─── POST /run ────────────────────────────────────────────────────────────────

class RunAnalysisRequest(BaseModel):
    contract_id: str
    deal_type: str
    perspective: str


@router.post("/run", response_model=MarketAnalysisOut)
@limiter.limit("10/minute")
async def run_analysis(
    request: Request,
    body: RunAnalysisRequest,
    user: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MarketAnalysisOut:
    valid_types = get_deal_types()
    if body.deal_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Unknown deal type: {body.deal_type}")

    valid_perspectives = get_perspectives(body.deal_type)
    if body.perspective not in valid_perspectives:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid perspective '{body.perspective}' for {body.deal_type}. Valid: {list(valid_perspectives.keys())}",
        )

    result = await db.execute(select(Contract).where(Contract.id == uuid.UUID(body.contract_id)))
    contract: Contract | None = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.status != "ready":
        raise HTTPException(status_code=400, detail="Contract is not ready for analysis")

    full_text: str | None = contract.full_text
    if not full_text and contract.file_key:
        try:
            raw_bytes = await download_file(contract.file_key)
            full_text = raw_bytes.decode("utf-8", errors="replace")
        except Exception:
            pass
    if not full_text:
        raise HTTPException(
            status_code=422,
            detail="Contract text not available. Re-upload the document to enable market analysis.",
        )

    org_id = _org_id(user)
    analysis = MarketAnalysis(
        contract_id=contract.id,
        org_id=org_id,
        deal_type=body.deal_type,
        perspective=body.perspective,
        status="running",
    )
    db.add(analysis)
    await db.flush()

    try:
        raw_results, overall_position = await run_market_analysis(
            full_text=full_text,
            deal_type=body.deal_type,
            perspective=body.perspective,
        )
    except Exception as exc:
        logger.error("Market analysis failed for %s: %s", contract.id, exc)
        analysis.status = "failed"
        analysis.error = str(exc)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")

    db_clauses: list[MarketAnalysisClause] = []
    for r in raw_results:
        row = MarketAnalysisClause(
            analysis_id=analysis.id,
            clause_key=r["clause_key"],
            clause_name=r["clause_name"],
            found_text=r.get("found_text"),
            position=r["position"],
            position_label=r["position_label"],
            market_standard=r.get("market_standard"),
            explanation=r.get("explanation"),
            suggested_rewrite=r.get("suggested_rewrite"),
            risk_level=r.get("risk_level", "medium"),
            mandatory=r.get("mandatory", True),
        )
        db.add(row)
        db_clauses.append(row)

    analysis.status = "done"
    analysis.overall_position = overall_position
    await db.commit()

    return _analysis_out(analysis, contract.name, db_clauses)


# ─── GET /contract/{contract_id} ─────────────────────────────────────────────

@router.get("/contract/{contract_id}")
async def list_analyses_for_contract(
    contract_id: str,
    user: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(MarketAnalysis)
        .options(selectinload(MarketAnalysis.clauses))
        .where(
            MarketAnalysis.contract_id == uuid.UUID(contract_id),
            MarketAnalysis.org_id == _org_id(user),
        )
        .order_by(MarketAnalysis.created_at.desc())
        .limit(10)
    )
    analyses = list(result.scalars().all())

    contract_result = await db.execute(select(Contract).where(Contract.id == uuid.UUID(contract_id)))
    contract = contract_result.scalar_one_or_none()
    contract_name = contract.name if contract else "Unknown"

    out = [_analysis_out(a, contract_name, a.clauses) for a in analyses]
    return {"analyses": [a.model_dump() for a in out]}


# ─── GET /{analysis_id} ──────────────────────────────────────────────────────

@router.get("/{analysis_id}", response_model=MarketAnalysisOut)
async def get_analysis(
    analysis_id: str,
    user: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MarketAnalysisOut:
    result = await db.execute(
        select(MarketAnalysis)
        .options(selectinload(MarketAnalysis.clauses))
        .where(
            MarketAnalysis.id == uuid.UUID(analysis_id),
            MarketAnalysis.org_id == _org_id(user),
        )
    )
    analysis: MarketAnalysis | None = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    contract_result = await db.execute(
        select(Contract).where(Contract.id == analysis.contract_id)
    )
    contract = contract_result.scalar_one_or_none()
    contract_name = contract.name if contract else "Unknown"

    return _analysis_out(analysis, contract_name, analysis.clauses)
