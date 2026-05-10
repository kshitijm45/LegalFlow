"""
/api/v1/workflows — Workflow Builder CRUD and execution endpoints.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.clerk import ClerkClaims, get_current_user
from app.db.session import get_db
from app.models.contract import Contract
from app.models.user import User
from app.models.workflow import Workflow, WorkflowRun

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/workflows", tags=["workflows"])


# ── Auth helper ───────────────────────────────────────────────────────────────

async def _get_user(claims: ClerkClaims, db: AsyncSession) -> User:
    result = await db.execute(
        select(User)
        .options(selectinload(User.memberships))
        .where(User.clerk_user_id == claims.sub)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not onboarded")
    return user


def _org_ids(user: User) -> list[uuid.UUID]:
    return [m.org_id for m in user.memberships if m.org_id]


def _workflow_filter(user: User):
    """Workflows visible to this user: their own or their org's."""
    from sqlalchemy import or_
    org_ids = _org_ids(user)
    if org_ids:
        return or_(Workflow.created_by == user.id, Workflow.org_id.in_(org_ids))
    return Workflow.created_by == user.id


# ── Schemas ───────────────────────────────────────────────────────────────────

class WorkflowNodeIn(BaseModel):
    id: str
    type: str
    position: dict[str, float]
    data: dict[str, Any]


class WorkflowEdgeIn(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "draft"
    nodes: Optional[list[dict]] = None
    edges: Optional[list[dict]] = None


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    nodes: Optional[list[dict]] = None
    edges: Optional[list[dict]] = None


class WorkflowRunRequest(BaseModel):
    contract_id: Optional[str] = None
    trigger_type: Optional[str] = "manual"


def _serialize_workflow(wf: Workflow) -> dict:
    return {
        "id":          str(wf.id),
        "name":        wf.name,
        "description": wf.description,
        "status":      wf.status,
        "nodes":       wf.nodes or [],
        "edges":       wf.edges or [],
        "last_run":    wf.last_run.isoformat() if wf.last_run else None,
        "created_at":  wf.created_at.isoformat(),
        "updated_at":  wf.updated_at.isoformat(),
    }


def _serialize_run(run: WorkflowRun) -> dict:
    return {
        "id":           str(run.id),
        "workflow_id":  str(run.workflow_id),
        "contract_id":  str(run.contract_id) if run.contract_id else None,
        "status":       run.status,
        "trigger_type": run.trigger_type,
        "run_log":      run.run_log or [],
        "error":        run.error,
        "started_at":   run.started_at.isoformat()   if run.started_at   else None,
        "completed_at": run.completed_at.isoformat()  if run.completed_at else None,
        "created_at":   run.created_at.isoformat(),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_workflows(
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user(claims, db)
    result = await db.execute(
        select(Workflow)
        .where(_workflow_filter(user))
        .order_by(Workflow.updated_at.desc())
    )
    workflows = result.scalars().all()
    return {"workflows": [_serialize_workflow(w) for w in workflows]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workflow(
    body: WorkflowCreate,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user(claims, db)
    org_ids = _org_ids(user)
    wf = Workflow(
        org_id=org_ids[0] if org_ids else None,
        created_by=user.id,
        name=body.name.strip() or "New Workflow",
        description=body.description,
        status=body.status or "draft",
        nodes=body.nodes or [],
        edges=body.edges or [],
    )
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return _serialize_workflow(wf)


@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: uuid.UUID,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user(claims, db)
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, _workflow_filter(user))
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _serialize_workflow(wf)


@router.patch("/{workflow_id}")
async def update_workflow(
    workflow_id: uuid.UUID,
    body: WorkflowUpdate,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user(claims, db)
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, _workflow_filter(user))
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if body.name is not None:
        stripped = body.name.strip()
        if stripped:
            wf.name = stripped
    if body.description is not None:
        wf.description = body.description
    if body.status is not None:
        wf.status = body.status
    if body.nodes is not None:
        wf.nodes = body.nodes
    if body.edges is not None:
        wf.edges = body.edges

    await db.commit()
    await db.refresh(wf)
    return _serialize_workflow(wf)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: uuid.UUID,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user(claims, db)
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.created_by == user.id)
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await db.delete(wf)
    await db.commit()


# ── Run ───────────────────────────────────────────────────────────────────────

@router.post("/{workflow_id}/run", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("20/minute")
async def run_workflow(
    request: Request,
    workflow_id: uuid.UUID,
    body: WorkflowRunRequest,
    background_tasks: BackgroundTasks,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user(claims, db)
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, _workflow_filter(user))
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if not wf.nodes:
        raise HTTPException(status_code=400, detail="Workflow has no nodes")

    # Resolve contract
    contract: Contract | None = None
    contract_uuid: uuid.UUID | None = None
    if body.contract_id:
        try:
            contract_uuid = uuid.UUID(body.contract_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid contract_id")
        c_result = await db.execute(
            select(Contract).where(Contract.id == contract_uuid)
        )
        contract = c_result.scalar_one_or_none()

    run = WorkflowRun(
        workflow_id=wf.id,
        contract_id=contract_uuid,
        status="pending",
        trigger_type=body.trigger_type or "manual",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    from app.services.workflow_executor import execute_workflow
    from app.db.session import AsyncSessionLocal

    async def _run_in_background():
        async with AsyncSessionLocal() as bg_db:
            try:
                bg_run_res = await bg_db.execute(select(WorkflowRun).where(WorkflowRun.id == run.id))
                bg_run = bg_run_res.scalar_one()
                bg_wf_res  = await bg_db.execute(select(Workflow).where(Workflow.id == wf.id))
                bg_wf  = bg_wf_res.scalar_one()
                bg_contract = None
                if contract_uuid:
                    bg_c_res = await bg_db.execute(select(Contract).where(Contract.id == contract_uuid))
                    bg_contract = bg_c_res.scalar_one_or_none()
                await execute_workflow(bg_wf, bg_run, bg_contract, bg_db)
            except Exception as exc:
                logger.exception("Background workflow run %s crashed: %s", run.id, exc)
                try:
                    fail_res = await bg_db.execute(select(WorkflowRun).where(WorkflowRun.id == run.id))
                    fail_run = fail_res.scalar_one_or_none()
                    if fail_run and fail_run.status == "pending":
                        from datetime import datetime, timezone
                        fail_run.status = "failed"
                        fail_run.error = str(exc)
                        fail_run.completed_at = datetime.now(timezone.utc)
                        await bg_db.commit()
                except Exception:
                    pass

    background_tasks.add_task(_run_in_background)

    return {"run_id": str(run.id), "status": "pending"}


# ── Run history ───────────────────────────────────────────────────────────────

@router.get("/{workflow_id}/runs")
async def list_runs(
    workflow_id: uuid.UUID,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user(claims, db)
    wf_result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, _workflow_filter(user))
    )
    if not wf_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workflow not found")

    result = await db.execute(
        select(WorkflowRun)
        .where(WorkflowRun.workflow_id == workflow_id)
        .order_by(WorkflowRun.created_at.desc())
        .limit(50)
    )
    runs = result.scalars().all()
    return {"runs": [_serialize_run(r) for r in runs]}


@router.get("/runs/{run_id}")
async def get_run(
    run_id: uuid.UUID,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user(claims, db)
    result = await db.execute(
        select(WorkflowRun)
        .options(selectinload(WorkflowRun.workflow))
        .where(WorkflowRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    # Auth check via the parent workflow
    wf_result = await db.execute(
        select(Workflow).where(Workflow.id == run.workflow_id, _workflow_filter(user))
    )
    if not wf_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Run not found")
    return _serialize_run(run)
