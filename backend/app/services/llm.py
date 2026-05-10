"""
LLM factory + contract metadata extraction.

To swap providers, change LLM_PROVIDER in .env:
  gemini     → Gemini via Google AI Studio (current default, free tier)
  anthropic  → Claude (best quality, needs API key)
  openai     → GPT-4o (needs API key)
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.embeddings import Embeddings
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.config import settings

_logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Factory functions
# ---------------------------------------------------------------------------

def get_llm() -> BaseChatModel:
    """Primary model — used for high-reasoning tasks (clause audit, chat)."""
    if settings.llm_provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.gemini_api_key,
            temperature=0,
        )
    if settings.llm_provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=settings.anthropic_api_key,  # type: ignore[arg-type]
            temperature=0,
        )
    if settings.llm_provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model="gpt-4o-mini",
            api_key=settings.openai_api_key,  # type: ignore[arg-type]
            temperature=0,
        )
    raise ValueError(f"Unknown LLM provider: {settings.llm_provider}")


def get_fast_llm() -> BaseChatModel:
    """Cost-optimised model — used for extraction tasks (metadata, timeline, obligations, detection).
    Falls back to the primary model for non-Gemini providers."""
    if settings.llm_provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=settings.gemini_fast_model,
            google_api_key=settings.gemini_api_key,
            temperature=0,
        )
    return get_llm()


def get_embeddings() -> Embeddings:
    if settings.llm_provider == "gemini":
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        return GoogleGenerativeAIEmbeddings(
            model=settings.gemini_embedding_model,
            google_api_key=settings.gemini_api_key,
        )
    raise ValueError(f"No embeddings configured for provider: {settings.llm_provider}")


# ---------------------------------------------------------------------------
# Contract metadata extraction
# ---------------------------------------------------------------------------

# Canonical contract type labels shown in the UI sidebar.
_CANONICAL_TYPES = [
    "NDA",
    "MSA",
    "SaaS Agreement",
    "Employment Agreement",
    "SOW",
    "DPA",
    "Software License",
    "Amendment",
    "JV Agreement",
    "Share Purchase Agreement",
    "Consulting Agreement",
    "Service Agreement",
    "Independent Contractor Agreement",
    "Lease Agreement",
    "Loan Agreement",
    "Settlement Agreement",
    "Distribution Agreement",
    "Reseller Agreement",
    "Supply Agreement",
    "IP Assignment",
    "MOU",
    "Term Sheet",
    "Partnership Agreement",
    "Franchise Agreement",
    "Professional Services Agreement",
    "Shareholders Agreement",
    "Share Subscription Agreement",
    "Business Transfer Agreement",
]

# Maps lowercase aliases → canonical name. Catches common LLM variations.
_TYPE_ALIASES: dict[str, str] = {
    "non-disclosure agreement": "NDA",
    "non disclosure agreement": "NDA",
    "confidentiality agreement": "NDA",
    "nda agreement": "NDA",
    "master service agreement": "MSA",
    "master services agreement": "MSA",
    "master services": "MSA",
    "software as a service agreement": "SaaS Agreement",
    "saas": "SaaS Agreement",
    "employment contract": "Employment Agreement",
    "employment": "Employment Agreement",
    "offer letter": "Employment Agreement",
    "statement of work": "SOW",
    "work order": "SOW",
    "data processing agreement": "DPA",
    "data processing addendum": "DPA",
    "data protection agreement": "DPA",
    "license agreement": "Software License",
    "licence agreement": "Software License",
    "software licence": "Software License",
    "license": "Software License",
    "licence": "Software License",
    "joint venture agreement": "JV Agreement",
    "joint venture": "JV Agreement",
    "share purchase": "Share Purchase Agreement",
    "stock purchase agreement": "Share Purchase Agreement",
    "stock purchase": "Share Purchase Agreement",
    "consulting contract": "Consulting Agreement",
    "consultancy agreement": "Consulting Agreement",
    "services agreement": "Service Agreement",
    "service contract": "Service Agreement",
    "contractor agreement": "Independent Contractor Agreement",
    "independent contractor agreement": "Independent Contractor Agreement",
    "independent contractor": "Independent Contractor Agreement",
    "freelance agreement": "Independent Contractor Agreement",
    "lease": "Lease Agreement",
    "tenancy agreement": "Lease Agreement",
    "rental agreement": "Lease Agreement",
    "loan": "Loan Agreement",
    "credit agreement": "Loan Agreement",
    "promissory note": "Loan Agreement",
    "settlement": "Settlement Agreement",
    "mutual release": "Settlement Agreement",
    "distribution contract": "Distribution Agreement",
    "reseller contract": "Reseller Agreement",
    "value added reseller agreement": "Reseller Agreement",
    "var agreement": "Reseller Agreement",
    "supply contract": "Supply Agreement",
    "supplier agreement": "Supply Agreement",
    "purchase agreement": "Supply Agreement",
    "intellectual property assignment": "IP Assignment",
    "ip transfer": "IP Assignment",
    "memorandum of understanding": "MOU",
    "letter of intent": "MOU",
    "loi": "MOU",
    "mou": "MOU",
    "partnership contract": "Partnership Agreement",
    "franchise": "Franchise Agreement",
    "professional services": "Professional Services Agreement",
    "psa": "Professional Services Agreement",
    "shareholders' agreement": "Shareholders Agreement",
    "shareholder agreement": "Shareholders Agreement",
    "shareholder's agreement": "Shareholders Agreement",
    "sha": "Shareholders Agreement",
    "share subscription": "Share Subscription Agreement",
    "subscription agreement": "Share Subscription Agreement",
    "ssa": "Share Subscription Agreement",
    "business transfer": "Business Transfer Agreement",
    "bta": "Business Transfer Agreement",
    "business sale agreement": "Business Transfer Agreement",
}

_CANONICAL_LOWER = {t.lower(): t for t in _CANONICAL_TYPES}


def _normalize_contract_type(raw_type: str | None) -> str | None:
    """Map LLM output to a canonical type, or return the raw value trimmed."""
    if not raw_type:
        return None
    cleaned = raw_type.strip()
    lower = cleaned.lower()
    # Exact canonical match (case-insensitive)
    if lower in _CANONICAL_LOWER:
        return _CANONICAL_LOWER[lower]
    # Alias lookup
    if lower in _TYPE_ALIASES:
        return _TYPE_ALIASES[lower]
    # Partial alias match — handles "Non-Disclosure Agreement (NDA)" etc.
    for alias, canonical in _TYPE_ALIASES.items():
        if alias in lower:
            return canonical
    # Return as-is (LLM gave a descriptive name not in the list — still better than "Other")
    return cleaned


_CANONICAL_LIST_STR = ", ".join(_CANONICAL_TYPES)

_EXTRACTION_PROMPT = PromptTemplate(
    input_variables=["text", "canonical_types"],
    template="""You are a legal analyst. Extract structured metadata from the contract text below.

Return ONLY a valid JSON object with exactly these fields (no extra text, no markdown):
{{
  "title": "string — contract title or a short descriptive name",
  "contract_type": "string — choose the best match from this list: {canonical_types}. If none match precisely, use a short descriptive 2-4 word name that accurately describes this contract type. Do NOT use 'Other'.",
  "parties": ["array", "of", "party names"],
  "effective_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "jurisdiction": "governing law / jurisdiction string or null",
  "summary": "2-3 sentence plain English summary of what this contract is about"
}}

Contract text (truncated to first 60,000 characters):
{text}""",
)


def _parse_json_from_response(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
    return json.loads(raw.strip())


async def extract_contract_metadata(text: str) -> dict[str, Any]:
    llm = get_fast_llm()
    chain = _EXTRACTION_PROMPT | llm | StrOutputParser()
    raw = await chain.ainvoke({
        "text": text[:settings.llm_max_chars],
        "canonical_types": _CANONICAL_LIST_STR,
    })
    try:
        result = _parse_json_from_response(raw)
        result["contract_type"] = _normalize_contract_type(result.get("contract_type"))
        return result
    except (json.JSONDecodeError, ValueError):
        _logger.warning("extract_contract_metadata: JSON parse failed. Raw response: %r", raw[:500])
        return {
            "title": None,
            "contract_type": None,
            "parties": [],
            "effective_date": None,
            "expiry_date": None,
            "jurisdiction": None,
            "summary": "",
        }
