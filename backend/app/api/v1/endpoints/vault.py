"""
/api/v1/vault — contract storage and search endpoints.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import date, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile, File, status
from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import delete as sql_delete, func, nullsfirst, nullslast, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.auth.clerk import ClerkClaims, get_current_user
from app.config import settings
from app.db.session import get_db
from app.models.contract import Collection, Contract, ContractCollection
from app.models.user import User
from app.services import storage
from app.services.llm import get_embeddings, get_llm
from app.services.processor import delete_from_pinecone, process_contract

router = APIRouter(prefix="/vault", tags=["vault"])

ALLOWED_TYPES = {"pdf", "docx", "txt"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

CONTENT_TYPE_MAP = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


def _access_filter(user: User):
    """SQLAlchemy filter: contracts visible to this user (own uploads + any org they belong to)."""
    org_ids = [m.org_id for m in user.memberships if m.org_id]
    if org_ids:
        return or_(Contract.uploaded_by == user.id, Contract.org_id.in_(org_ids))
    return Contract.uploaded_by == user.id


def _contract_to_dict(c: Contract) -> dict[str, Any]:
    return {
        "id": str(c.id),
        "name": c.name,
        "original_filename": c.original_filename,
        "file_type": c.file_type,
        "file_size": c.file_size,
        "status": c.status,
        "contract_type": c.contract_type,
        "parties": c.parties or [],
        "effective_date": c.effective_date.isoformat() if c.effective_date else None,
        "expiry_date": c.expiry_date.isoformat() if c.expiry_date else None,
        "jurisdiction": c.jurisdiction,
        "summary": c.summary,
        "page_count": c.page_count,
        "created_at": c.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_contract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    collection_id: Optional[str] = Form(None),
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type .{ext} not allowed. Use PDF, DOCX, or TXT.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File exceeds 50 MB limit.",
        )

    user = await _get_user(claims, db)
    contract_id = uuid.uuid4()

    file_key = await storage.upload_file(
        file_bytes=file_bytes,
        original_filename=filename,
        contract_id=contract_id,
        content_type=CONTENT_TYPE_MAP.get(ext, "application/octet-stream"),
    )

    contract = Contract(
        id=contract_id,
        org_id=user.memberships[0].org_id if user.memberships else None,
        uploaded_by=user.id,
        name=filename,
        original_filename=filename,
        file_key=file_key,
        file_size=len(file_bytes),
        file_type=ext,
        status="pending",
    )
    db.add(contract)

    if collection_id:
        try:
            coll_uuid = uuid.UUID(collection_id)
            db.add(ContractCollection(contract_id=contract_id, collection_id=coll_uuid))
        except ValueError:
            pass

    await db.commit()
    background_tasks.add_task(process_contract, contract_id)
    return {"contract_id": str(contract_id), "status": "pending"}


# ---------------------------------------------------------------------------
# List contracts
# ---------------------------------------------------------------------------

@router.get("/contracts")
async def list_contracts(
    collection_id: Optional[str] = None,
    contract_type: Optional[str] = None,
    status_filter: Optional[str] = None,
    expiring_soon: bool = False,        # contracts whose expiry_date is within the next 30 days
    sort_by: str = "date",              # date | name | type | expiry
    sort_dir: str = "desc",             # asc | desc
    limit: int = 200,
    offset: int = 0,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(claims, db)
    access = _access_filter(user)

    conditions = [access]
    join_coll = False
    coll_uuid = None

    if collection_id:
        try:
            coll_uuid = uuid.UUID(collection_id)
            join_coll = True
        except ValueError:
            pass

    if contract_type:
        conditions.append(Contract.contract_type == contract_type)
    if status_filter:
        conditions.append(Contract.status == status_filter)
    if expiring_soon:
        today = date.today()
        conditions.append(Contract.expiry_date.between(today, today + timedelta(days=30)))

    q = select(Contract).where(*conditions)
    count_q = select(func.count()).select_from(Contract).where(*conditions)

    if join_coll:
        q = q.join(ContractCollection, ContractCollection.contract_id == Contract.id).where(
            ContractCollection.collection_id == coll_uuid
        )
        count_q = count_q.join(ContractCollection, ContractCollection.contract_id == Contract.id).where(
            ContractCollection.collection_id == coll_uuid
        )

    # Server-side ordering — needed for correct pagination across pages
    if sort_by == "name":
        order_col = Contract.name.asc() if sort_dir == "asc" else Contract.name.desc()
    elif sort_by == "type":
        order_col = Contract.contract_type.asc() if sort_dir == "asc" else Contract.contract_type.desc()
    elif sort_by == "expiry":
        base = Contract.expiry_date.asc() if sort_dir == "asc" else Contract.expiry_date.desc()
        # Contracts with no expiry date always sort to the bottom
        order_col = nullslast(base) if sort_dir == "asc" else nullsfirst(base)
    else:  # date (default)
        order_col = Contract.created_at.asc() if sort_dir == "asc" else Contract.created_at.desc()

    total = (await db.execute(count_q)).scalar_one()
    result = await db.execute(q.order_by(order_col).offset(offset).limit(limit))
    contracts = result.scalars().all()

    return {"contracts": [_contract_to_dict(c) for c in contracts], "total": total}


# ---------------------------------------------------------------------------
# Single contract
# ---------------------------------------------------------------------------

@router.get("/contracts/{contract_id}")
async def get_contract(
    contract_id: str,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(claims, db)
    try:
        cid = uuid.UUID(contract_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid contract ID")

    result = await db.execute(
        select(Contract).where(Contract.id == cid, _access_filter(user))
    )
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")

    data = _contract_to_dict(contract)
    data["download_url"] = storage.presigned_url(contract.file_key)
    return data


# ---------------------------------------------------------------------------
# Status polling
# ---------------------------------------------------------------------------

@router.get("/contracts/{contract_id}/status")
async def get_contract_status(
    contract_id: str,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(claims, db)
    try:
        cid = uuid.UUID(contract_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid contract ID")

    result = await db.execute(
        select(Contract.status, Contract.error_message).where(
            Contract.id == cid, _access_filter(user)
        )
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Contract not found")

    return {"contract_id": contract_id, "status": row.status, "error": row.error_message}


# ---------------------------------------------------------------------------
# Delete (single) — uploader only
# ---------------------------------------------------------------------------

@router.delete("/contracts/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contract(
    contract_id: str,
    background_tasks: BackgroundTasks,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await _get_user(claims, db)
    try:
        cid = uuid.UUID(contract_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid contract ID")

    result = await db.execute(
        select(Contract).where(Contract.id == cid, Contract.uploaded_by == user.id)
    )
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")

    file_key = contract.file_key
    await db.delete(contract)
    await db.commit()

    background_tasks.add_task(storage.delete_file, file_key)
    background_tasks.add_task(delete_from_pinecone, cid)


# ---------------------------------------------------------------------------
# Contract — rename (uploader only)
# ---------------------------------------------------------------------------

class ContractUpdate(BaseModel):
    name: Optional[str] = None


@router.patch("/contracts/{contract_id}")
async def update_contract(
    contract_id: str,
    body: ContractUpdate,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(claims, db)
    try:
        cid = uuid.UUID(contract_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid contract ID")

    result = await db.execute(
        select(Contract).where(Contract.id == cid, Contract.uploaded_by == user.id)
    )
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")

    if body.name is not None:
        stripped = body.name.strip()
        if not stripped:
            raise HTTPException(status_code=400, detail="Contract name cannot be empty")
        contract.name = stripped

    await db.commit()
    return _contract_to_dict(contract)


# ---------------------------------------------------------------------------
# Contract — move to collection
# ---------------------------------------------------------------------------

class MoveToCollectionRequest(BaseModel):
    collection_id: Optional[str] = None  # null to remove from all collections


@router.patch("/contracts/{contract_id}/collection")
async def move_contract_to_collection(
    contract_id: str,
    body: MoveToCollectionRequest,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(claims, db)
    try:
        cid = uuid.UUID(contract_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid contract ID")

    result = await db.execute(
        select(Contract).where(Contract.id == cid, Contract.uploaded_by == user.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Contract not found")

    await db.execute(sql_delete(ContractCollection).where(ContractCollection.contract_id == cid))

    if body.collection_id:
        try:
            coll_uuid = uuid.UUID(body.collection_id)
            db.add(ContractCollection(contract_id=cid, collection_id=coll_uuid))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid collection ID")

    await db.commit()
    return {"contract_id": str(cid), "collection_id": body.collection_id}


# ---------------------------------------------------------------------------
# Bulk delete — uploader only, single batch query
# ---------------------------------------------------------------------------

class BulkDeleteRequest(BaseModel):
    contract_ids: List[str]


@router.post("/contracts/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_contracts(
    body: BulkDeleteRequest,
    background_tasks: BackgroundTasks,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(claims, db)

    valid_uuids = []
    for raw_id in body.contract_ids:
        try:
            valid_uuids.append(uuid.UUID(raw_id))
        except ValueError:
            continue

    if not valid_uuids:
        return {"deleted": [], "count": 0}

    result = await db.execute(
        select(Contract).where(
            Contract.id.in_(valid_uuids),
            Contract.uploaded_by == user.id,
        )
    )
    contracts_to_delete = list(result.scalars().all())

    deleted = []
    for contract in contracts_to_delete:
        file_key = contract.file_key
        cid = contract.id
        await db.delete(contract)
        deleted.append(str(cid))
        background_tasks.add_task(storage.delete_file, file_key)
        background_tasks.add_task(delete_from_pinecone, cid)

    await db.commit()
    return {"deleted": deleted, "count": len(deleted)}


# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------

class CollectionCreate(BaseModel):
    name: str
    color: str = "#4338CA"


@router.get("/collections")
async def list_collections(
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(claims, db)
    org_id = user.memberships[0].org_id if user.memberships else None

    q = select(Collection)
    if org_id:
        q = q.where(Collection.org_id == org_id)
    else:
        q = q.where(Collection.created_by == user.id)

    result = await db.execute(q.order_by(Collection.created_at.desc()))
    collections = result.scalars().all()
    return {
        "collections": [
            {"id": str(c.id), "name": c.name, "color": c.color, "created_at": c.created_at.isoformat()}
            for c in collections
        ]
    }


@router.post("/collections", status_code=status.HTTP_201_CREATED)
async def create_collection(
    body: CollectionCreate,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(claims, db)
    org_id = user.memberships[0].org_id if user.memberships else None

    coll = Collection(
        org_id=org_id,
        created_by=user.id,
        name=body.name,
        color=body.color,
    )
    db.add(coll)
    await db.commit()
    await db.refresh(coll)
    return {"id": str(coll.id), "name": coll.name, "color": coll.color, "created_at": coll.created_at.isoformat()}


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


@router.patch("/collections/{collection_id}")
async def update_collection(
    collection_id: str,
    body: CollectionUpdate,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await _get_user(claims, db)
    try:
        cid = uuid.UUID(collection_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid collection ID")

    result = await db.execute(select(Collection).where(Collection.id == cid))
    coll = result.scalar_one_or_none()
    if coll is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    if coll.created_by != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if body.name is not None:
        coll.name = body.name.strip()
    if body.color is not None:
        coll.color = body.color

    await db.commit()
    return {"id": str(coll.id), "name": coll.name, "color": coll.color}


@router.delete("/collections/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: str,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await _get_user(claims, db)
    try:
        cid = uuid.UUID(collection_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid collection ID")

    result = await db.execute(select(Collection).where(Collection.id == cid))
    coll = result.scalar_one_or_none()
    if coll is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    if coll.created_by != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(coll)
    await db.commit()


# ---------------------------------------------------------------------------
# Semantic search
# ---------------------------------------------------------------------------

class SearchRequest(BaseModel):
    query: str
    top_k: int = 10


_SEARCH_SCORE_THRESHOLD = 0.45
_SEARCH_TOP_K_INTERNAL  = 60
_SEARCH_MAX_PER_CONTRACT = 3
_SEARCH_MAX_RESULTS     = 15


@router.post("/search")
async def search_vault(
    body: SearchRequest,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from pinecone import Pinecone

    if not body.query or len(body.query.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query too short")

    user = await _get_user(claims, db)
    org_id = user.memberships[0].org_id if user.memberships else None

    embeddings_model = get_embeddings()
    query_vec = await asyncio.to_thread(embeddings_model.embed_query, body.query.strip())

    pc = Pinecone(api_key=settings.pinecone_api_key)
    index = pc.Index(settings.pinecone_index)

    if org_id:
        pinecone_filter = {"org_id": {"$eq": str(org_id)}}
    else:
        pinecone_filter = {"uploaded_by": {"$eq": str(user.id)}}

    resp = await asyncio.to_thread(
        index.query,
        vector=query_vec,
        top_k=_SEARCH_TOP_K_INTERNAL,
        include_metadata=True,
        filter=pinecone_filter,
    )

    matches = [m for m in resp.get("matches", []) if m.get("score", 0) >= _SEARCH_SCORE_THRESHOLD]
    if not matches:
        return {"results": [], "query": body.query}

    best_per_clause: dict[tuple[str, str], dict] = {}
    for m in matches:
        cid     = m["metadata"].get("contract_id", "")
        heading = m["metadata"].get("section_heading", "")
        key = (cid, heading if heading else m["metadata"].get("text", "")[:60])
        if key not in best_per_clause or m["score"] > best_per_clause[key]["score"]:
            best_per_clause[key] = m

    ranked = sorted(best_per_clause.values(), key=lambda m: m["score"], reverse=True)
    seen_per_contract: dict[str, int] = {}
    filtered: list[dict] = []
    for m in ranked:
        cid = m["metadata"].get("contract_id", "")
        if seen_per_contract.get(cid, 0) >= _SEARCH_MAX_PER_CONTRACT:
            continue
        seen_per_contract[cid] = seen_per_contract.get(cid, 0) + 1
        filtered.append(m)
        if len(filtered) >= _SEARCH_MAX_RESULTS:
            break

    # DB ownership check uses the same org-aware filter as the rest of the API
    contract_ids = list({m["metadata"]["contract_id"] for m in filtered})
    uuids = [uuid.UUID(cid) for cid in contract_ids]
    db_result = await db.execute(
        select(Contract).where(Contract.id.in_(uuids), _access_filter(user))
    )
    contracts = {str(c.id): c for c in db_result.scalars().all()}

    results = []
    for m in filtered:
        cid = m["metadata"].get("contract_id", "")
        if cid not in contracts:
            continue
        c = contracts[cid]
        results.append({
            **_contract_to_dict(c),
            "score":           round(m["score"], 4),
            "snippet":         m["metadata"].get("text", "")[:500],
            "section_heading": m["metadata"].get("section_heading", "") or None,
        })

    return {"results": results, "query": body.query}


# ---------------------------------------------------------------------------
# Document Chat (RAG over selected contracts) — org-aware, single batch query
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    contract_ids: List[str]
    message: str
    history: List[ChatMessage] = []


@router.post("/chat")
async def chat_with_contracts(
    body: ChatRequest,
    claims: ClerkClaims = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from pinecone import Pinecone

    user = await _get_user(claims, db)

    valid_uuids = []
    for raw_id in body.contract_ids:
        try:
            valid_uuids.append(uuid.UUID(raw_id))
        except ValueError:
            continue

    if not valid_uuids:
        raise HTTPException(status_code=400, detail="No valid contracts selected")

    result = await db.execute(
        select(Contract).where(
            Contract.id.in_(valid_uuids),
            _access_filter(user),
        )
    )
    valid_contracts = list(result.scalars().all())

    if not valid_contracts:
        raise HTTPException(status_code=400, detail="No valid contracts selected")

    system = (
        "You are a legal AI assistant helping analyse contracts. "
        "Answer questions using ONLY the contract content provided below. "
        "Be precise, structured, and cite the specific contract by name when relevant. "
        "If the information is not present, say so clearly — do not hallucinate."
    )

    history_text = ""
    for msg in body.history[-6:]:
        role = "User" if msg.role == "user" else "Assistant"
        history_text += f"{role}: {msg.content}\n"

    sources: list[dict] = []

    # Single contract with full text → send entire document, no RAG needed
    if len(valid_contracts) == 1:
        contract = valid_contracts[0]
        if contract.full_text:
            meta_lines = [f"Contract: {contract.name}"]
            if contract.contract_type:
                meta_lines.append(f"Type: {contract.contract_type}")
            if contract.parties:
                meta_lines.append(f"Parties: {', '.join(contract.parties)}")
            if contract.effective_date:
                meta_lines.append(f"Effective date: {contract.effective_date.isoformat()}")
            if contract.expiry_date:
                meta_lines.append(f"Expiry date: {contract.expiry_date.isoformat()}")
            if contract.jurisdiction:
                meta_lines.append(f"Jurisdiction: {contract.jurisdiction}")
            if contract.summary:
                meta_lines.append(f"Summary: {contract.summary}")

            body_text = contract.full_text[:150_000]
            context = "\n".join(meta_lines) + "\n\n--- FULL CONTRACT TEXT ---\n\n" + body_text
            sources = [{"contract_id": str(contract.id), "contract_name": contract.name, "snippet": (contract.summary or contract.full_text[:300])}]

            prompt = (
                f"Contract content:\n{context}\n\n"
                f"{history_text}"
                f"User: {body.message}\n\nAssistant:"
            )
            llm = get_llm()
            response = await asyncio.to_thread(llm.invoke, [SystemMessage(content=system), HumanMessage(content=prompt)])
            answer = response.content if hasattr(response, "content") else str(response)
            return {"answer": answer, "sources": sources}

    # Multiple contracts → RAG over Pinecone
    valid_ids = [str(c.id) for c in valid_contracts]
    contract_map = {str(c.id): c for c in valid_contracts}

    embeddings_model = get_embeddings()
    query_vec = await asyncio.to_thread(embeddings_model.embed_query, body.message)

    pc = Pinecone(api_key=settings.pinecone_api_key)
    index = pc.Index(settings.pinecone_index)

    pinecone_filter: dict = {"contract_id": {"$in": valid_ids}} if len(valid_ids) < 20 else {}
    resp = await asyncio.to_thread(
        index.query,
        vector=query_vec,
        top_k=25,
        include_metadata=True,
        filter=pinecone_filter if pinecone_filter else None,
    )

    matches = resp.get("matches", [])
    if pinecone_filter:
        matches = [m for m in matches if m["metadata"].get("contract_id") in valid_ids]

    context_parts: list[str] = []
    seen_per_contract: dict[str, int] = {}

    for m in matches:
        cid_str = m["metadata"].get("contract_id", "")
        chunk_text = m["metadata"].get("text", "").strip()
        if not chunk_text or cid_str not in contract_map:
            continue
        count = seen_per_contract.get(cid_str, 0)
        if count >= 8:
            continue
        seen_per_contract[cid_str] = count + 1
        doc_name = contract_map[cid_str].name
        context_parts.append(f"[{doc_name}]\n{chunk_text}")
        if len(sources) < 5 and not any(s["contract_id"] == cid_str for s in sources):
            sources.append({"contract_id": cid_str, "contract_name": doc_name, "snippet": chunk_text[:300]})

    meta_headers: list[str] = []
    for c in valid_contracts:
        lines = [f"Contract: {c.name}"]
        if c.contract_type:
            lines.append(f"Type: {c.contract_type}")
        if c.parties:
            lines.append(f"Parties: {', '.join(c.parties)}")
        if c.effective_date:
            lines.append(f"Effective: {c.effective_date.isoformat()}")
        if c.expiry_date:
            lines.append(f"Expiry: {c.expiry_date.isoformat()}")
        if c.summary:
            lines.append(f"Summary: {c.summary}")
        meta_headers.append(" | ".join(lines))

    meta_block = "CONTRACT METADATA:\n" + "\n".join(meta_headers)
    chunks_block = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant excerpts found."
    context = meta_block + "\n\nRELEVANT EXCERPTS:\n" + chunks_block

    prompt = (
        f"Contract content:\n{context}\n\n"
        f"{history_text}"
        f"User: {body.message}\n\nAssistant:"
    )

    llm = get_llm()
    response = await asyncio.to_thread(llm.invoke, [SystemMessage(content=system), HumanMessage(content=prompt)])
    answer = response.content if hasattr(response, "content") else str(response)
    return {"answer": answer, "sources": sources}
