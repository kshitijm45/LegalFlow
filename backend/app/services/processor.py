"""
Contract processing pipeline.

Flow per upload:
  1. Download file from S3
  2. Extract text (PyMuPDF / python-docx)
  3. Call LLM → extract title, type, parties, dates, summary
  4. Chunk text → generate embeddings → upsert into Pinecone
  5. Update contract record in DB (status: ready)

Runs as a FastAPI BackgroundTask so it doesn't block the upload response.
Creates its own DB session since it runs outside the request lifecycle.
"""
from __future__ import annotations

import re
import uuid
import logging
from datetime import date
from typing import Any

from langchain.text_splitter import RecursiveCharacterTextSplitter
from pinecone import Pinecone

from app.config import settings
from app.db.session import AsyncSessionLocal
from app.services import extractor, storage
from app.services.llm import extract_contract_metadata, get_embeddings

_EMBED_MAX_CHUNKS = settings.embed_max_chunks

logger = logging.getLogger(__name__)

# Fallback splitter for long sections that exceed _MAX_SECTION_CHARS
_SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=150,
    separators=["\n\n", "\n", ". ", " ", ""],
)

# Detects section/clause headings in legal documents.
# Matches numbered clauses ("1.", "1.1", "1.1.1"), CLAUSE/SECTION/ARTICLE keywords,
# Roman numeral sections ("IV. INDEMNIFICATION"), schedules/exhibits, and standard recitals.
_SECTION_RE = re.compile(
    r'(?m)^[ \t]*('
    # "1. Definitions", "1.1 Limitation of Liability", "1.1.1 Scope"
    r'\d{1,2}(?:\.\d{1,2}){0,2}\.?\s+[A-Z][^\n]{2,80}'
    # "CLAUSE 3 - Representations", "SECTION 2. Term", "ARTICLE I General"
    r'|(?:CLAUSE|SECTION|ARTICLE)\s+[\dA-Z][^\n]{0,80}'
    # "ARTICLE IV", "ARTICLE XII — Indemnification"
    r'|ARTICLE\s+(?:I{1,4}|IV|VI{0,3}|IX|XI{0,3}|XII|XIII|XIV|XV)[^\n]{0,80}'
    # "IV. INDEMNIFICATION", "IX. DISPUTE RESOLUTION" — all-caps heading required
    r'|(?:I{1,4}|IV|VI{0,3}|IX|XI{0,3}|XII|XIII|XIV|XV)\.[ \t]+[A-Z][A-Z0-9 \-]{4,60}$'
    r'|SCHEDULE\s+\d+[^\n]{0,80}'                     # "SCHEDULE 1 - Capitalisation Table"
    r'|EXHIBIT\s+[A-Z\d][^\n]{0,80}'                  # "EXHIBIT A - Form of Notice"
    r'|ANNEXURE\s+[\dA-Z][^\n]{0,80}'                 # "ANNEXURE I - Business Plan"
    r'|(?:WHEREAS|NOW[,\s]+THEREFORE|IN WITNESS WHEREOF)[^\n]{0,80}'
    r')[ \t]*$'
)

# A section body longer than this gets further split by _SPLITTER
_MAX_SECTION_CHARS = 1_200


def _split_into_sections(text: str) -> list[tuple[str, str]]:
    """
    Split legal document text into (section_heading, body) pairs.

    Detects numbered clauses, CLAUSE/SECTION/ARTICLE markers, and standard
    legal markers (WHEREAS, SCHEDULE, etc.) as section boundaries.
    Falls back to a single section with an empty heading for unstructured docs.
    """
    matches = list(_SECTION_RE.finditer(text))

    # Need at least 3 detected boundaries to trust the structure
    if len(matches) < 3:
        return [("", text)]

    sections: list[tuple[str, str]] = []
    for i, match in enumerate(matches):
        heading = match.group(1).strip()[:120]
        body_start = match.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[body_start:body_end].strip()
        if body:
            sections.append((heading, body))

    return sections if sections else [("", text)]


def _section_chunks(text: str) -> list[tuple[str, str]]:
    """
    Return (section_heading, chunk_text) pairs ready for embedding.

    Each top-level section becomes one or more chunks.  Sections that fit
    within _MAX_SECTION_CHARS are kept whole; longer ones are further split
    by _SPLITTER so the embedding model sees a coherent window of text.
    All sub-chunks retain their parent section heading.
    """
    sections = _split_into_sections(text)
    result: list[tuple[str, str]] = []

    for heading, body in sections:
        if len(body) <= _MAX_SECTION_CHARS:
            result.append((heading, body))
        else:
            for sub in _SPLITTER.split_text(body):
                result.append((heading, sub))

    return result


def _pinecone_index():
    pc = Pinecone(api_key=settings.pinecone_api_key)
    return pc.Index(settings.pinecone_index)


def _parse_date(value: Any) -> date | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


async def _fire_upload_workflows(contract: Any, db: Any) -> None:
    """Fire all active workflows whose trigger is 'upload' and match this contract."""
    from sqlalchemy import select
    from app.models.workflow import Workflow, WorkflowRun
    from app.services.workflow_executor import execute_workflow

    try:
        result = await db.execute(select(Workflow).where(Workflow.status == "active"))
        workflows = result.scalars().all()

        for wf in workflows:
            nodes: list[dict] = wf.nodes or []
            trigger = next((n for n in nodes if n.get("type") == "trigger"), None)
            if not trigger:
                continue

            data = trigger.get("data", {})
            if data.get("triggerType") != "upload":
                continue

            # Optional contract type filter
            type_filter = (data.get("contractTypeFilter") or "").strip().lower()
            if type_filter and contract.contract_type:
                if type_filter not in (contract.contract_type or "").lower():
                    continue

            logger.info(
                "Firing upload-triggered workflow %s (%s) for contract %s",
                wf.id, wf.name, contract.id,
            )

            run = WorkflowRun(
                workflow_id=wf.id,
                contract_id=contract.id,
                status="pending",
                trigger_type="upload",
            )
            db.add(run)
            await db.flush()

            try:
                await execute_workflow(wf, run, contract, db)
            except Exception:
                logger.exception(
                    "Upload-triggered execution failed for workflow %s", wf.id
                )

    except Exception:
        logger.exception("_fire_upload_workflows failed for contract %s", contract.id)


async def process_contract(contract_id: uuid.UUID) -> None:
    """Full pipeline — called as a background task after upload."""
    from sqlalchemy import select
    from app.models.contract import Contract

    async with AsyncSessionLocal() as db:
        # Mark as processing
        result = await db.execute(select(Contract).where(Contract.id == contract_id))
        contract = result.scalar_one_or_none()
        if contract is None:
            logger.error("process_contract: contract %s not found", contract_id)
            return

        contract.status = "processing"
        await db.commit()

        try:
            # 1. Download from S3
            file_bytes = await storage.download_file(contract.file_key)

            # 2. Extract text
            extraction = await extractor.extract_text(file_bytes, contract.file_type)
            contract.page_count = extraction.page_count

            # 3. Store full text — used by chat, obligations, timeline (avoids repeated S3 re-downloads)
            contract.full_text = extraction.text

            # 4. LLM metadata extraction
            meta = await extract_contract_metadata(extraction.text)
            contract.name = meta.get("title") or contract.original_filename
            contract.contract_type = meta.get("contract_type")
            contract.parties = meta.get("parties") or []
            contract.effective_date = _parse_date(meta.get("effective_date"))
            contract.expiry_date = _parse_date(meta.get("expiry_date"))
            contract.jurisdiction = meta.get("jurisdiction")
            contract.summary = meta.get("summary")

            # 5. Chunk + embed + upsert to Pinecone
            if settings.pinecone_api_key and extraction.text.strip():
                await _embed_and_index(
                    text=extraction.text,
                    contract_id=contract_id,
                    org_id=contract.org_id,
                    uploaded_by=contract.uploaded_by,
                    meta=meta,
                )

            # 6. Done
            contract.status = "ready"
            await db.commit()
            logger.info("process_contract: contract %s ready", contract_id)

            # 7. Fire any active workflows with an upload trigger
            await _fire_upload_workflows(contract, db)

        except Exception as exc:
            logger.exception("process_contract: failed for %s", contract_id)
            contract.status = "failed"
            contract.error_message = str(exc)
            await db.commit()


_EMBED_BATCH_SIZE = 20   # items per batchEmbedContents call
_EMBED_MAX_RETRIES = 3


async def _embed_batch_with_retry(embeddings_model, batch: list[str]) -> list:
    """Call embed_documents for one batch, retrying on 429 RESOURCE_EXHAUSTED."""
    import asyncio
    import re

    for attempt in range(_EMBED_MAX_RETRIES + 1):
        try:
            return await asyncio.to_thread(embeddings_model.embed_documents, batch)
        except Exception as exc:
            err = str(exc)
            is_rate_limit = "429" in err or "RESOURCE_EXHAUSTED" in err or "quota" in err.lower()
            if is_rate_limit and attempt < _EMBED_MAX_RETRIES:
                # Extract the suggested retry delay from the error message
                m = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", err)
                wait = int(m.group(1)) + 5 if m else 65
                logger.warning(
                    "Embedding rate-limited, waiting %ds (attempt %d/%d)",
                    wait, attempt + 1, _EMBED_MAX_RETRIES,
                )
                await asyncio.sleep(wait)
            else:
                raise
    raise RuntimeError("Embedding max retries exceeded")


async def _embed_and_index(
    text: str,
    contract_id: uuid.UUID,
    org_id: uuid.UUID | None,
    uploaded_by: uuid.UUID | None,
    meta: dict,
) -> None:
    """Chunk the text by legal section, generate embeddings, and upsert to Pinecone."""
    import asyncio

    # Section-aware chunking: each chunk knows which clause it came from
    raw_chunks = _section_chunks(text)
    if not raw_chunks:
        return

    if len(raw_chunks) > _EMBED_MAX_CHUNKS:
        logger.info(
            "process_contract: truncating %d chunks to %d for embedding",
            len(raw_chunks), _EMBED_MAX_CHUNKS,
        )
        raw_chunks = raw_chunks[:_EMBED_MAX_CHUNKS]

    headings = [h for h, _ in raw_chunks]
    chunks   = [c for _, c in raw_chunks]

    logger.info(
        "process_contract: indexing %d section-chunks for %s (%d unique sections)",
        len(chunks), contract_id, len({h for h in headings if h}),
    )

    embeddings_model = get_embeddings()

    all_vectors: list = []
    for i in range(0, len(chunks), _EMBED_BATCH_SIZE):
        batch = chunks[i : i + _EMBED_BATCH_SIZE]
        vecs = await _embed_batch_with_retry(embeddings_model, batch)
        all_vectors.extend(vecs)
        if i + _EMBED_BATCH_SIZE < len(chunks):
            await asyncio.sleep(3)

    index = _pinecone_index()
    pinecone_vectors = [
        {
            "id": f"{contract_id}__chunk__{i}",
            "values": vec,
            "metadata": {
                "contract_id":    str(contract_id),
                "org_id":         str(org_id) if org_id else "",
                "uploaded_by":    str(uploaded_by) if uploaded_by else "",
                "chunk_index":    i,
                "text":           chunk,
                "section_heading": heading,
                "contract_type":  meta.get("contract_type", ""),
                "parties":        ", ".join(meta.get("parties") or []),
            },
        }
        for i, (chunk, vec, heading) in enumerate(zip(chunks, all_vectors, headings))
    ]

    batch_size = 100
    for i in range(0, len(pinecone_vectors), batch_size):
        batch = pinecone_vectors[i : i + batch_size]
        await asyncio.to_thread(index.upsert, vectors=batch)


async def delete_from_pinecone(contract_id: uuid.UUID) -> None:
    """Remove all chunks for a contract from Pinecone."""
    import asyncio

    def _delete():
        try:
            index = _pinecone_index()
            # Delete by prefix (Pinecone supports this for serverless)
            index.delete(prefix=f"{contract_id}__chunk__")
        except Exception:
            pass  # best-effort

    await asyncio.to_thread(_delete)
