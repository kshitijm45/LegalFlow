"""
Workflow execution engine.

Walks the node graph in BFS order from the trigger node, executes each node
using the appropriate runner, and records a per-node log in WorkflowRun.

Supported node types:
  trigger  — records what kicked off the run (no side-effect)
  ai       — calls the LLM for analysis / audit / obligations / timeline / summary
  branch   — evaluates a condition on the execution context; only the matching
              outgoing edge is followed
  action   — performs a side-effect (tag contract, move collection, run audit, etc.)
  notify   — sends an email via SES to the specified recipients
"""
from __future__ import annotations

import logging
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any
import json
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract
from app.models.workflow import Workflow, WorkflowRun

logger = logging.getLogger(__name__)

# ── Execution context ─────────────────────────────────────────────────────────

class ExecutionContext:
    """Mutable bag of state shared across all node runners in one run."""

    def __init__(self, contract: Contract | None) -> None:
        self.contract = contract
        # Values populated as nodes execute — used by branch conditions
        self.risk_score: float | None = None
        self.audit_summary: str | None = None
        self.obligations_count: int | None = None
        self.timeline_count: int | None = None
        # branch_results[node_id] = True/False
        self.branch_results: dict[str, bool] = {}
        # Latest output for each node type, used for template interpolation.
        self.node_outputs: dict[str, dict[str, Any]] = {}

    def get_field(self, field: str) -> Any:
        """Resolve a branch condition field from contract data or runtime context."""
        if field == "risk_score":
            return self.risk_score
        if field == "contract_type" and self.contract:
            return self.contract.contract_type
        if field == "page_count" and self.contract:
            return self.contract.page_count
        if field == "parties_count" and self.contract:
            return len(self.contract.parties or [])
        if field == "days_to_expiry" and self.contract:
            if self.contract.expiry_date:
                delta = (self.contract.expiry_date - datetime.now(timezone.utc).date())
                return delta.days
        return None

    def template_vars(self) -> dict[str, Any]:
        """Return nested template variables for notify/webhook payloads."""
        contract = self.contract
        ai_output = self.node_outputs.get("ai", {})
        action_output = self.node_outputs.get("action", {})
        notify_output = self.node_outputs.get("notify", {})

        if contract:
            contract_date = contract.effective_date.isoformat() if contract.effective_date else ""
            document_type = contract.contract_type or ""
        else:
            contract_date = ""
            document_type = ""

        ai_summary = (
            ai_output.get("summary")
            or ai_output.get("audit_summary")
            or self.audit_summary
            or ""
        )

        return {
            "document": {
                "id": str(contract.id) if contract else "",
                "name": contract.name if contract else "",
                "type": document_type,
                "parties": ", ".join(contract.parties or []) if contract else "",
                "date": contract_date,
                "summary": contract.summary or "",
                "page_count": contract.page_count or "",
            },
            "ai": {
                "summary": ai_summary,
                "risk_score": ai_output.get("risk_score", self.risk_score or ""),
                "risk_level": ai_output.get("risk_level", ""),
                "key_risks": ai_output.get("key_risks", []),
                "findings": ai_output.get("findings", []),
                "missing_clauses": ai_output.get("missing_clauses", []),
                "obligations": ai_output.get("obligations", []),
            },
            "action": action_output,
            "notify": notify_output,
            "workflow": {
                "risk_score": self.risk_score if self.risk_score is not None else "",
                "audit_summary": self.audit_summary or "",
                "obligations_count": self.obligations_count if self.obligations_count is not None else "",
                "timeline_count": self.timeline_count if self.timeline_count is not None else "",
            },
        }


_TEMPLATE_VAR_RE = re.compile(r"{{\s*([a-zA-Z0-9_.-]+)\s*}}")


def _resolve_template_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    return json.dumps(value, ensure_ascii=False)


def _render_template(template: str, variables: dict[str, Any]) -> str:
    def replace(match: re.Match[str]) -> str:
        path = match.group(1).split(".")
        value: Any = variables
        for part in path:
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                return ""
        return _resolve_template_value(value)

    rendered = _TEMPLATE_VAR_RE.sub(replace, template)
    return rendered.replace("{contract}", variables.get("document", {}).get("name", ""))


# ── Graph helpers ─────────────────────────────────────────────────────────────

def _build_graph(nodes: list[dict], edges: list[dict]) -> dict[str, list[dict]]:
    """Return adjacency map: node_id → list of outgoing edge dicts."""
    graph: dict[str, list[dict]] = {n["id"]: [] for n in nodes}
    for e in edges:
        if e["source"] in graph:
            graph[e["source"]].append(e)
    return graph


def _find_trigger(nodes: list[dict]) -> dict | None:
    for n in nodes:
        if n.get("type") == "trigger":
            return n
    # Fall back to first node if no explicit trigger
    return nodes[0] if nodes else None


def _should_follow_edge(edge: dict, branch_result: bool) -> bool:
    """Decide whether to traverse an edge out of a branch node."""
    label = (edge.get("label") or "").lower()
    if not label:
        return True  # unlabelled edges are always followed
    true_words  = {"high", "yes", "true", "match", "flag", "above", "exceed", "risk", "deviations"}
    false_words = {"low", "no", "false", "standard", "default", "normal", "below", "approved"}
    if any(w in label for w in true_words):
        return branch_result
    if any(w in label for w in false_words):
        return not branch_result
    # Unknown label — follow it regardless
    return True


# ── Condition evaluator ───────────────────────────────────────────────────────

def _evaluate_condition(field: str, operator: str, value: str, ctx: ExecutionContext) -> bool:
    actual = ctx.get_field(field)
    if actual is None:
        return False
    try:
        if operator == "gte":
            return float(actual) >= float(value)
        if operator == "lte":
            return float(actual) <= float(value)
        if operator == "eq":
            return str(actual).lower() == str(value).lower()
        if operator == "neq":
            return str(actual).lower() != str(value).lower()
        if operator == "contains":
            return str(value).lower() in str(actual).lower()
    except (ValueError, TypeError):
        pass
    return False


# ── Node runners ──────────────────────────────────────────────────────────────

async def _run_trigger(node: dict, ctx: ExecutionContext, db: AsyncSession) -> dict:
    data = node.get("data", {})
    return {
        "status": "success",
        "message": f"Triggered — type: {data.get('triggerType', 'manual')}",
        "output": {},
    }


async def _run_ai(node: dict, ctx: ExecutionContext, db: AsyncSession) -> dict:
    data = node.get("data", {})
    mode = data.get("analysisMode", "summary")

    if not ctx.contract:
        return {"status": "skipped", "message": "No contract in context", "output": {}}

    contract = ctx.contract
    if not contract.full_text:
        return {"status": "skipped", "message": "Contract has no extracted text", "output": {}}

    try:
        if mode == "clause_audit":
            from app.services.clause_audit import detect_playbook_types, run_clause_audit
            playbook_types = await detect_playbook_types(
                contract.name, contract.contract_type, contract.full_text
            )
            if playbook_types and playbook_types != ["other"]:
                results, score = await run_clause_audit(contract.full_text, playbook_types)
                ctx.risk_score = 100 - score  # risk = inverse of coverage
                ctx.audit_summary = f"Score {score}% across {len(results)} clauses"
                return {
                    "status": "success",
                    "message": f"Clause audit complete — coverage {score}%",
                    "output": {"score": score, "clause_count": len(results), "playbooks": playbook_types},
                }
            return {"status": "skipped", "message": "No matching playbook detected", "output": {}}

        if mode == "obligations":
            from app.services.llm import get_fast_llm
            from langchain_core.prompts import PromptTemplate
            from langchain_core.output_parsers import StrOutputParser
            import json, re
            from datetime import date
            prompt = PromptTemplate(input_variables=["text", "today"], template="""You are a senior legal analyst. Extract ALL contractual obligations from this contract — including duties, covenants, undertakings, restrictions, consent requirements, warranties, and indemnities.
Today: {today}
Return JSON array only, no markdown. Each item must include: {{"title":"verb-led title (max 8 words)","description":"1-2 sentences","responsible_party":"party name or null","due_date":"YYYY-MM-DD or null","recurrence":"one-time|monthly|quarterly|annual|null","category":"payment|notice|delivery|reporting|compliance|covenant|restriction|consent|undertaking|warranty|indemnity|other","section":"section ref or null","source_clause":"verbatim text max 200 chars or null"}}
Scan for: shall/must/will, shall not/must not, covenants to, undertakes to, warrants that, subject to prior written consent, shall indemnify, shall not without approval. Extract both positive AND negative obligations. No cap on count — extract all genuine obligations.
CONTRACT:
{text}""")
            llm = get_fast_llm()
            chain = prompt | llm | StrOutputParser()
            raw = await chain.ainvoke({"text": contract.full_text[:300_000], "today": str(date.today())})
            raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
            items = json.loads(raw.strip())
            ctx.obligations_count = len(items)
            return {
                "status": "success",
                "message": f"Extracted {len(items)} obligations",
                "output": {"obligations_count": len(items)},
            }

        if mode == "full" or mode == "summary":
            from app.services.llm import get_fast_llm
            from langchain_core.prompts import PromptTemplate
            from langchain_core.output_parsers import StrOutputParser
            prompt = PromptTemplate(input_variables=["text"], template="""You are a senior legal analyst. Analyze this contract and return a JSON object:
{{"risk_score": 0-100, "risk_level": "low|medium|high", "key_risks": ["...","..."], "summary": "2-3 sentences"}}
CONTRACT:
{text}""")
            llm = get_fast_llm()
            chain = prompt | llm | StrOutputParser()
            import json, re
            raw = await chain.ainvoke({"text": contract.full_text[:300_000]})
            raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
            result = json.loads(raw.strip())
            ctx.risk_score = float(result.get("risk_score", 50))
            return {
                "status": "success",
                "message": f"Analysis complete — risk {result.get('risk_level', 'unknown')}",
                "output": result,
            }

        if mode == "risk_only":
            from app.services.llm import get_fast_llm
            from langchain_core.prompts import PromptTemplate
            from langchain_core.output_parsers import StrOutputParser
            import json, re
            prompt = PromptTemplate(input_variables=["text"], template="""Identify the top risk clauses in this contract.
Return JSON: {{"risk_score": 0-100, "risk_clauses": [{{"clause": "...", "risk": "high|medium|low", "note": "..."}}]}}
CONTRACT:
{text}""")
            llm = get_fast_llm()
            chain = prompt | llm | StrOutputParser()
            raw = await chain.ainvoke({"text": contract.full_text[:300_000]})
            raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
            result = json.loads(raw.strip())
            ctx.risk_score = float(result.get("risk_score", 50))
            return {
                "status": "success",
                "message": f"Risk analysis complete — score {ctx.risk_score}",
                "output": result,
            }

    except Exception as exc:
        logger.exception("AI node failed for contract %s", contract.id)
        return {"status": "failed", "message": str(exc), "output": {}}

    return {"status": "skipped", "message": f"Unknown analysis mode: {mode}", "output": {}}


async def _run_branch(node: dict, ctx: ExecutionContext, db: AsyncSession) -> dict:
    data = node.get("data", {})
    field    = data.get("field",    "risk_score")
    operator = data.get("operator", "gte")
    value    = data.get("value",    "70")

    result = _evaluate_condition(field, operator, value, ctx)
    ctx.branch_results[node["id"]] = result

    actual = ctx.get_field(field)
    return {
        "status": "success",
        "message": f"Condition [{field} {operator} {value}]: {'TRUE' if result else 'FALSE'} (actual: {actual})",
        "output": {"condition_met": result, "field": field, "actual_value": actual},
    }


async def _run_action(node: dict, ctx: ExecutionContext, db: AsyncSession) -> dict:
    data = node.get("data", {})
    action_type = data.get("actionType", "")

    if not ctx.contract:
        return {"status": "skipped", "message": "No contract in context", "output": {}}

    contract = ctx.contract

    try:
        if action_type == "tag_contract":
            tag = str(data.get("tagValue", "")).strip()
            if tag:
                existing = list(contract.tags or [])
                if tag not in existing:
                    existing.append(tag)
                    contract.tags = existing
                    await db.commit()
            return {"status": "success", "message": f"Tagged contract: {tag}", "output": {"tag": tag}}

        if action_type == "move_collection":
            col_name = str(data.get("collectionName", "")).strip()
            if col_name:
                from app.models.contract import Collection, ContractCollection
                result = await db.execute(
                    select(Collection).where(Collection.name == col_name)
                )
                collection = result.scalar_one_or_none()
                if collection:
                    existing = await db.execute(
                        select(ContractCollection).where(
                            ContractCollection.contract_id == contract.id,
                            ContractCollection.collection_id == collection.id,
                        )
                    )
                    if not existing.scalar_one_or_none():
                        db.add(ContractCollection(contract_id=contract.id, collection_id=collection.id))
                        await db.commit()
                    return {"status": "success", "message": f"Moved to collection: {col_name}", "output": {"collection": col_name}}
                return {"status": "skipped", "message": f"Collection not found: {col_name}", "output": {}}
            return {"status": "skipped", "message": "No collection name specified", "output": {}}

        if action_type == "run_clause_audit":
            from app.services.clause_audit import detect_playbook_types, run_clause_audit
            from app.models.clause_audit import ClauseAudit, ClauseResult
            if not contract.full_text:
                return {"status": "skipped", "message": "Contract has no extracted text", "output": {}}
            playbook_types = await detect_playbook_types(contract.name, contract.contract_type, contract.full_text)
            if not playbook_types or playbook_types == ["other"]:
                return {"status": "skipped", "message": "No matching playbook", "output": {}}
            results, score = await run_clause_audit(contract.full_text, playbook_types)
            ctx.risk_score = 100 - score
            ctx.audit_summary = f"{score}%"
            audit = ClauseAudit(
                contract_id=contract.id,
                playbook_types=playbook_types,
                status="done",
                overall_score=score,
            )
            db.add(audit)
            await db.flush()
            for r in results:
                db.add(ClauseResult(audit_id=audit.id, **r))
            await db.commit()
            return {"status": "success", "message": f"Clause audit done — {score}%", "output": {"score": score}}

        if action_type == "extract_obligations":
            from app.models.obligation import Obligation
            from app.services.llm import get_fast_llm
            from langchain_core.prompts import PromptTemplate
            from langchain_core.output_parsers import StrOutputParser
            import json, re
            from datetime import date
            if not contract.full_text:
                return {"status": "skipped", "message": "Contract has no extracted text", "output": {}}
            prompt = PromptTemplate(input_variables=["text", "today"], template="""You are a senior legal analyst. Extract ALL contractual obligations — duties, covenants, undertakings, restrictions, consent requirements, warranties, and indemnities. Today: {today}.
Return JSON array only, no markdown. Each: {{"title":"verb-led title (max 8 words)","description":"1-2 sentences","responsible_party":"party name or null","due_date":"YYYY-MM-DD or null","recurrence":"one-time|monthly|quarterly|annual|null","category":"payment|notice|delivery|reporting|compliance|covenant|restriction|consent|undertaking|warranty|indemnity|other","section":"section ref or null","source_clause":"verbatim text max 200 chars or null"}}
Scan for: shall/must/will, shall not/must not, covenants to, undertakes to, warrants that, subject to prior written consent, shall indemnify, shall not without approval. Extract both positive AND negative obligations. No cap — extract all genuine obligations.
CONTRACT: {text}""")
            llm = get_fast_llm()
            chain = prompt | llm | StrOutputParser()
            raw = await chain.ainvoke({"text": contract.full_text[:300_000], "today": str(date.today())})
            raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
            items = json.loads(raw.strip())
            from datetime import date as date_cls
            for item in items:
                due = None
                if item.get("due_date"):
                    try: due = date_cls.fromisoformat(item["due_date"])
                    except ValueError: pass
                db.add(Obligation(
                    contract_id=contract.id,
                    contract_name=contract.name,
                    title=item.get("title", "Obligation")[:256],
                    description=item.get("description", ""),
                    responsible_party=item.get("responsible_party"),
                    due_date=due,
                    recurrence=item.get("recurrence"),
                    category=item.get("category", "other"),
                    status="pending",
                    section=item.get("section"),
                    source_clause=item.get("source_clause"),
                ))
            await db.commit()
            ctx.obligations_count = len(items)
            return {"status": "success", "message": f"Extracted {len(items)} obligations", "output": {"count": len(items)}}

        if action_type == "generate_timeline":
            from app.services.llm import get_fast_llm
            from langchain_core.prompts import PromptTemplate
            from langchain_core.output_parsers import StrOutputParser
            import json, re
            if not contract.full_text:
                return {"status": "skipped", "message": "Contract has no extracted text", "output": {}}
            prompt = PromptTemplate(input_variables=["text"], template="""Extract key timeline events from this contract.
Return JSON array: [{{"title":"...","date":"YYYY-MM-DD","type":"start|milestone|deadline|renewal|payment|review","description":"..."}}]
CONTRACT: {text}""")
            llm = get_fast_llm()
            chain = prompt | llm | StrOutputParser()
            raw = await chain.ainvoke({"text": contract.full_text[:300_000]})
            raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
            events = json.loads(raw.strip())
            contract.timeline_events = events
            await db.commit()
            ctx.timeline_count = len(events)
            return {"status": "success", "message": f"Generated {len(events)} timeline events", "output": {"count": len(events)}}

        if action_type == "update_status":
            new_status = str(data.get("newStatus", "")).strip()
            if new_status:
                tags = list(contract.tags or [])
                status_tag = f"status:{new_status}"
                tags = [t for t in tags if not t.startswith("status:")]
                tags.append(status_tag)
                contract.tags = tags
                await db.commit()
            return {"status": "success", "message": f"Status set to: {new_status}", "output": {"status": new_status}}

    except Exception as exc:
        logger.exception("Action node failed")
        return {"status": "failed", "message": str(exc), "output": {}}

    return {"status": "skipped", "message": f"Unknown action: {action_type}", "output": {}}


async def _run_notify(node: dict, ctx: ExecutionContext, db: AsyncSession) -> dict:
    data = node.get("data", {})
    channel   = data.get("channel", "email")
    recipients = str(data.get("recipients", "")).strip()
    template  = str(data.get("messageTemplate", "A workflow step completed.")).strip()

    if not recipients:
        return {"status": "skipped", "message": "No recipients configured", "output": {}}

    message = _render_template(template, ctx.template_vars())

    sent_to: list[str] = []
    errors: list[str] = []

    if channel in ("email", "both"):
        from app.services.email import _ses_client
        from app.config import settings
        if not settings.ses_from_email:
            errors.append("SES_FROM_EMAIL not configured")
        else:
            for addr in [r.strip() for r in recipients.split(",") if r.strip()]:
                try:
                    _ses_client().send_email(
                        Source=settings.ses_from_email,
                        Destination={"ToAddresses": [addr]},
                        Message={
                            "Subject": {"Data": f"Workflow notification — {node['data'].get('label', 'Notify')}", "Charset": "UTF-8"},
                            "Body":    {"Text": {"Data": message, "Charset": "UTF-8"}},
                        },
                    )
                    sent_to.append(addr)
                    logger.info("Workflow notify email sent to %s", addr)
                except Exception as exc:
                    err_msg = str(exc)
                    errors.append(f"{addr}: {err_msg}")
                    logger.warning("Notify email failed for %s: %s", addr, exc)

    if channel in ("slack", "both"):
        logger.info("Workflow Slack notify (not wired): channel=%s message=%s", recipients, message)
        sent_to.append(f"slack:{recipients}")

    if errors and not sent_to:
        return {
            "status": "failed",
            "message": f"All notifications failed: {'; '.join(errors)}",
            "output": {"errors": errors},
        }

    return {
        "status": "success" if not errors else "partial",
        "message": f"Notified {len(sent_to)} recipient(s)" + (f" ({len(errors)} failed)" if errors else ""),
        "output": {"sent_to": sent_to, "errors": errors},
    }


_NODE_RUNNERS = {
    "trigger": _run_trigger,
    "ai":      _run_ai,
    "branch":  _run_branch,
    "action":  _run_action,
    "notify":  _run_notify,
}


# ── Main executor ─────────────────────────────────────────────────────────────

async def execute_workflow(
    workflow: Workflow,
    run: WorkflowRun,
    contract: Contract | None,
    db: AsyncSession,
) -> None:
    """
    Execute all nodes reachable from the trigger, writing results into `run`.
    Runs as a BackgroundTask — creates no new DB session (uses the one passed).
    """
    nodes: list[dict] = workflow.nodes or []
    edges: list[dict] = workflow.edges or []

    if not nodes:
        run.status = "failed"
        run.error  = "Workflow has no nodes"
        run.completed_at = datetime.now(timezone.utc)
        await db.commit()
        return

    node_map  = {n["id"]: n for n in nodes}
    graph     = _build_graph(nodes, edges)
    trigger   = _find_trigger(nodes)
    ctx       = ExecutionContext(contract)
    run_log: list[dict] = []

    run.status     = "running"
    run.started_at = datetime.now(timezone.utc)
    await db.commit()

    # BFS traversal
    visited: set[str] = set()
    queue: deque[str] = deque([trigger["id"]])

    try:
        while queue:
            node_id = queue.popleft()
            if node_id in visited:
                continue
            visited.add(node_id)

            node   = node_map.get(node_id)
            if not node:
                continue

            node_type = node.get("type", "action")
            runner    = _NODE_RUNNERS.get(node_type, _run_action)

            t0 = time.monotonic()
            try:
                result = await runner(node, ctx, db)
            except Exception as exc:
                result = {"status": "failed", "message": str(exc), "output": {}}

            output = result.get("output", {})
            if isinstance(output, dict):
                ctx.node_outputs[node_type] = output
                if node_type == "ai":
                    summary = output.get("summary")
                    if summary:
                        ctx.audit_summary = str(summary)

            elapsed_ms = round((time.monotonic() - t0) * 1000)

            entry = {
                "node_id":    node_id,
                "node_type":  node_type,
                "node_label": node.get("data", {}).get("label", node_type),
                "status":     result["status"],
                "message":    result["message"],
                "output":     output,
                "duration_ms": elapsed_ms,
            }
            run_log.append(entry)
            logger.info("Workflow %s node %s (%s): %s", workflow.id, node_id, node_type, result["message"])

            # Enqueue outgoing nodes
            for edge in graph.get(node_id, []):
                target_id = edge["target"]
                if target_id in visited:
                    continue
                # For branch nodes, filter by condition result
                if node_type == "branch":
                    branch_result = ctx.branch_results.get(node_id, False)
                    if not _should_follow_edge(edge, branch_result):
                        run_log.append({
                            "node_id":    target_id,
                            "node_type":  node_map.get(target_id, {}).get("type", ""),
                            "node_label": node_map.get(target_id, {}).get("data", {}).get("label", ""),
                            "status":     "skipped",
                            "message":    f"Branch condition not met — edge '{edge.get('label', '')}' skipped",
                            "output":     {},
                            "duration_ms": 0,
                        })
                        visited.add(target_id)
                        continue
                queue.append(target_id)

        run.status       = "completed"
        run.error        = None

    except Exception as exc:
        logger.exception("Workflow execution crashed for run %s", run.id)
        run.status = "failed"
        run.error  = str(exc)

    finally:
        run.run_log      = run_log
        run.completed_at = datetime.now(timezone.utc)
        workflow.last_run = run.completed_at
        await db.commit()
