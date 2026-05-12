"""Playbook definitions and LLM-powered clause audit service."""
from __future__ import annotations

import json
import logging
import re
from typing import Any, TypedDict

from app.services.llm import get_llm, get_fast_llm
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate

logger = logging.getLogger(__name__)


# ─── Playbook data types ──────────────────────────────────────────────────────

class PlaybookClause(TypedDict):
    key: str
    name: str
    description: str
    mandatory: bool
    risk: str  # high / medium / low


# ─── BTA Playbook ─────────────────────────────────────────────────────────────

BTA_CLAUSES: list[PlaybookClause] = [
    {
        "key": "transfer_of_business_assets",
        "name": "Transfer of Business / Assets",
        "description": "Clause defining the scope of transfer: what assets, contracts, permits, intellectual property, inventory, receivables, and liabilities are being transferred or excluded.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "purchase_price",
        "name": "Purchase Price / Consideration",
        "description": "Clause specifying the consideration, payment schedule, deferred payments, earn-outs, working capital adjustments, and escrow arrangements.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "conditions_precedent",
        "name": "Conditions Precedent",
        "description": "Conditions that must be satisfied before closing, including regulatory approvals, third-party consents, and material adverse change conditions.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "representations_warranties",
        "name": "Representations & Warranties",
        "description": "Representations and warranties by seller (and buyer) regarding title, authority, financial statements, litigation, compliance, and material contracts.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "indemnification",
        "name": "Indemnification",
        "description": "Indemnification obligations for breach of representations/warranties, pre-closing liabilities, third-party claims, and the basket/cap/survival period mechanics.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "employee_transfer",
        "name": "Employee Transfer",
        "description": "Provisions governing the transfer of employees, continuity of service, benefits, gratuity obligations, and compliance with applicable labour laws.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "closing_completion",
        "name": "Closing / Completion",
        "description": "Closing mechanics, deliverables at closing, simultaneous exchange conditions, and post-closing obligations.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "tax_covenant",
        "name": "Tax Covenant",
        "description": "Allocation of pre-closing and post-closing tax liabilities, responsibility for tax audits, and GST/stamp duty treatment of the transfer.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "intellectual_property_transfer",
        "name": "Intellectual Property Transfer",
        "description": "Assignment of IP rights including patents, trademarks, copyrights, domain names, source code, trade secrets, and any required IP registrations post-closing.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "non_compete",
        "name": "Non-Compete / Non-Solicitation",
        "description": "Restrictions on the seller from competing with the transferred business or soliciting customers and employees for a defined period and geography.",
        "mandatory": False,
        "risk": "medium",
    },
    {
        "key": "regulatory_compliance",
        "name": "Regulatory / Compliance",
        "description": "Obligations for obtaining regulatory approvals (CCI, RBI, SEBI), compliance with sector-specific laws, and allocation of regulatory risk.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "governing_law",
        "name": "Governing Law",
        "description": "The law governing the agreement (typically Indian law) and the jurisdiction of courts.",
        "mandatory": True,
        "risk": "low",
    },
    {
        "key": "dispute_resolution",
        "name": "Dispute Resolution",
        "description": "Mechanism for resolving disputes — typically arbitration under the Arbitration and Conciliation Act, 1996, with seat, number of arbitrators, and language specified.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "termination",
        "name": "Termination",
        "description": "Rights to terminate the agreement before closing, including long-stop date, material adverse change, and consequences of termination.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "interim_covenants",
        "name": "Covenants / Interim Covenants",
        "description": "Obligations of the seller to operate the business in the ordinary course between signing and closing, including restrictions on material decisions without buyer consent.",
        "mandatory": False,
        "risk": "medium",
    },
]

# ─── SHA Playbook ─────────────────────────────────────────────────────────────

SHA_CLAUSES: list[PlaybookClause] = [
    {
        "key": "board_composition",
        "name": "Board Composition",
        "description": "Rights of investors/shareholders to nominate directors, board size, quorum requirements, and investor veto rights over board decisions.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "management_rights",
        "name": "Management Rights",
        "description": "Rights of investors to access management information, attend board meetings as observers, and reserved matters requiring investor approval.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "representations_warranties",
        "name": "Representations & Warranties",
        "description": "Representations and warranties by the company and promoters regarding corporate status, capitalization, financial statements, IP, litigation, and material contracts.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "information_rights",
        "name": "Information Rights",
        "description": "Investor rights to receive financial statements, management accounts, annual budgets, and access to books and records for audit purposes.",
        "mandatory": False,
        "risk": "high",
    },
    {
        "key": "tag_along_rights",
        "name": "Tag-Along Rights",
        "description": "Right of minority shareholders to participate (tag along) in a sale by a majority shareholder on the same terms and conditions.",
        "mandatory": False,
        "risk": "high",
    },
    {
        "key": "drag_along_rights",
        "name": "Drag-Along Rights",
        "description": "Right of majority shareholders to compel minority shareholders to sell their shares in a third-party acquisition on the same terms.",
        "mandatory": False,
        "risk": "high",
    },
    {
        "key": "pre_emption_rofr_rofo",
        "name": "Pre-emption / ROFR / ROFO",
        "description": "Right of first refusal or right of first offer on transfer of shares, and pre-emption rights on new share issuances to prevent dilution.",
        "mandatory": False,
        "risk": "high",
    },
    {
        "key": "non_compete",
        "name": "Non-Compete / Non-Solicitation",
        "description": "Restrictions on promoters from competing with the company or soliciting its employees and customers during and after their involvement with the company.",
        "mandatory": False,
        "risk": "medium",
    },
    {
        "key": "share_capital_structure",
        "name": "Share Capital Structure",
        "description": "Details of authorized and issued share capital, rights and preferences of different share classes, and anti-dilution protections.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "covenants",
        "name": "Covenants",
        "description": "Affirmative and negative covenants including maintenance of corporate existence, compliance with laws, and restrictions on incurring debt or making acquisitions.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "indemnification",
        "name": "Indemnification",
        "description": "Indemnification by promoters/company for breach of representations, warranties, and covenants, including basket, cap, and survival period.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "lock_up",
        "name": "Lock-up",
        "description": "Restrictions on promoters and investors from transferring shares for a specified lock-up period post-investment.",
        "mandatory": False,
        "risk": "medium",
    },
    {
        "key": "termination",
        "name": "Termination",
        "description": "Conditions under which the SHA terminates, including upon an IPO, acquisition, or agreement of parties.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "governing_law",
        "name": "Governing Law",
        "description": "The law governing the agreement (typically Indian law) and jurisdiction of courts.",
        "mandatory": True,
        "risk": "low",
    },
    {
        "key": "dispute_resolution",
        "name": "Dispute Resolution",
        "description": "Mechanism for resolving disputes — typically arbitration under the Arbitration and Conciliation Act, 1996.",
        "mandatory": True,
        "risk": "medium",
    },
]

# ─── SSA Playbook ─────────────────────────────────────────────────────────────

SSA_CLAUSES: list[PlaybookClause] = [
    {
        "key": "subscription_price",
        "name": "Subscription of Shares / Price",
        "description": "Number and class of shares to be subscribed, subscription price, price per share, valuation basis, and total subscription amount.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "conditions_precedent",
        "name": "Conditions Precedent",
        "description": "Conditions to be satisfied before closing including board/shareholder approvals, regulatory filings, and execution of ancillary documents.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "closing_completion",
        "name": "Closing / Completion",
        "description": "Closing date, deliverables at closing (board resolutions, share certificates, updated cap table), and post-closing filings.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "representations_warranties",
        "name": "Representations & Warranties",
        "description": "Representations and warranties by the company and promoters regarding corporate status, capitalization, IP, litigation, financial condition, and material contracts.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "indemnification",
        "name": "Indemnification",
        "description": "Indemnification by promoters/company for breach of representations, warranties, and covenants, including basket, cap, and survival period.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "covenants",
        "name": "Covenants / Conduct of Business",
        "description": "Pre-closing covenants on ordinary course of business operations, and post-closing affirmative covenants by the company and promoters.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "board_composition",
        "name": "Board Composition / Investor Rights",
        "description": "Investor rights to nominate directors, board observer rights, and reserved matters — typically in SHA; may appear in SSA or combined document.",
        "mandatory": False,
        "risk": "high",
    },
    {
        "key": "information_rights",
        "name": "Information Rights",
        "description": "Investor right to financial statements, management accounts, and access to company records — typically in SHA; may appear in SSA or combined document.",
        "mandatory": False,
        "risk": "high",
    },
    {
        "key": "anti_dilution",
        "name": "Anti-dilution",
        "description": "Protection for the investor against future down-round dilution — typically broad-based weighted average or full ratchet anti-dilution provisions.",
        "mandatory": False,
        "risk": "high",
    },
    {
        "key": "pre_emption_rofr_rofo",
        "name": "Pre-emption / ROFR",
        "description": "Pre-emption rights on future share issuances and right of first refusal on share transfers — typically in SHA; may appear in combined document.",
        "mandatory": False,
        "risk": "high",
    },
    {
        "key": "tax_covenant",
        "name": "Tax",
        "description": "Tax representations and warranties, allocation of pre-closing tax liabilities, and indemnification for undisclosed tax demands.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "promoter_obligations",
        "name": "Promoter Obligations",
        "description": "Specific obligations of promoters including full-time commitment, non-compete, IP assignment, and obligations not to encumber their shares.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "termination",
        "name": "Termination / Long Stop Date",
        "description": "Long stop date for closing, rights to terminate if conditions are not satisfied, and consequences of termination.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "governing_law",
        "name": "Governing Law",
        "description": "The law governing the agreement (typically Indian law) and jurisdiction of courts.",
        "mandatory": True,
        "risk": "low",
    },
    {
        "key": "dispute_resolution",
        "name": "Dispute Resolution",
        "description": "Mechanism for resolving disputes — typically arbitration under the Arbitration and Conciliation Act, 1996.",
        "mandatory": True,
        "risk": "medium",
    },
]

# ─── SPA Playbook ─────────────────────────────────────────────────────────────

SPA_CLAUSES: list[PlaybookClause] = [
    {
        "key": "purchase_sale_shares",
        "name": "Purchase / Sale of Shares",
        "description": "Identification and number of shares being sold, seller details, title to shares, and free from encumbrances warranty.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "purchase_price",
        "name": "Purchase Price / Consideration",
        "description": "Total purchase price, payment mechanics, escrow arrangements, adjustments based on completion accounts or locked-box, and deferred consideration.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "conditions_precedent",
        "name": "Conditions Precedent",
        "description": "Conditions to closing including regulatory approvals (CCI), board and shareholder approvals, third-party consents, and MAC conditions.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "representations_warranties_seller",
        "name": "Representations & Warranties (Seller)",
        "description": "Comprehensive seller representations and warranties covering corporate status, title, capitalization, financial statements, IP, litigation, material contracts, and compliance.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "representations_warranties_buyer",
        "name": "Representations & Warranties (Buyer)",
        "description": "Buyer representations and warranties covering corporate authority, financing, anti-bribery, and no conflicts.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "indemnification",
        "name": "Indemnification",
        "description": "Indemnification by seller for breach of representations/warranties and pre-closing liabilities, with basket/deductible, cap, and survival period mechanics.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "tax_indemnity",
        "name": "Tax Indemnity",
        "description": "Specific indemnification for pre-closing tax liabilities, withholding tax obligations, transfer pricing risks, and responsibility for ongoing tax proceedings.",
        "mandatory": False,
        "risk": "high",
    },
    {
        "key": "closing_completion",
        "name": "Closing / Completion",
        "description": "Closing date, deliverables (share certificates, board resolutions, resignation letters), simultaneous exchange conditions, and post-closing obligations.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "non_compete",
        "name": "Non-Compete / Non-Solicitation",
        "description": "Post-closing restrictions on seller from competing with the company or soliciting its customers and employees.",
        "mandatory": False,
        "risk": "high",
    },
    {
        "key": "covenants",
        "name": "Covenants",
        "description": "Pre-closing covenants to operate the company in the ordinary course, and post-closing covenants including cooperation on regulatory filings.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "force_majeure",
        "name": "Force Majeure",
        "description": "Relief from obligations due to events beyond the parties' control, including pandemic, war, or acts of god, and consequences for prolonged force majeure events.",
        "mandatory": False,
        "risk": "medium",
    },
    {
        "key": "earn_out",
        "name": "Earn-out",
        "description": "Deferred consideration tied to post-closing performance milestones, calculation mechanics, and dispute resolution for earn-out disputes.",
        "mandatory": False,
        "risk": "medium",
    },
    {
        "key": "termination",
        "name": "Termination",
        "description": "Rights to terminate before closing, long-stop date, MAC right to terminate, and consequences including break fees.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "governing_law",
        "name": "Governing Law",
        "description": "The law governing the agreement (typically Indian law) and jurisdiction of courts.",
        "mandatory": True,
        "risk": "low",
    },
    {
        "key": "dispute_resolution",
        "name": "Dispute Resolution",
        "description": "Mechanism for resolving disputes — typically arbitration under the Arbitration and Conciliation Act, 1996, with seat, arbitrators, and language specified.",
        "mandatory": True,
        "risk": "medium",
    },
]

# ─── Loan Agreement Playbook ─────────────────────────────────────────────────

LOAN_CLAUSES: list[PlaybookClause] = [
    {
        "key": "loan_amount_purpose",
        "name": "Loan Amount & Purpose",
        "description": "Clause specifying the sanctioned loan amount, drawdown mechanics, permitted purpose(s) for which the loan may be used, and restrictions on use of proceeds.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "interest_rate",
        "name": "Interest Rate & Calculation",
        "description": "Interest rate (fixed or floating, benchmark-linked), calculation basis (365/360-day), interest payment dates, default interest rate, and compounding mechanics.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "repayment_schedule",
        "name": "Repayment Schedule",
        "description": "Repayment dates, instalment amounts, amortisation schedule, bullet vs. structured repayment, prepayment rights and prepayment premium, and final maturity date.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "security_collateral",
        "name": "Security / Collateral",
        "description": "Nature and description of security (mortgage, pledge, hypothecation, guarantee), perfection requirements, valuation obligations, and top-up obligations on security shortfall.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "conditions_precedent",
        "name": "Conditions Precedent",
        "description": "Conditions to be satisfied before disbursement including execution of security documents, board and shareholder approvals, legal opinions, insurance, and no-default confirmations.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "representations_warranties",
        "name": "Representations & Warranties",
        "description": "Representations by the borrower regarding corporate status, authority, no-conflict, financial condition, litigation, no material adverse change, and accuracy of information provided.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "positive_covenants",
        "name": "Positive Covenants",
        "description": "Affirmative obligations of the borrower including maintenance of corporate existence, insurance, records, regulatory compliance, financial reporting, and notification of defaults or material events.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "negative_covenants",
        "name": "Negative Covenants",
        "description": "Restrictions on the borrower from creating additional security, incurring further indebtedness, making distributions, disposing of assets, changing business, or undertaking mergers without lender consent.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "events_of_default",
        "name": "Events of Default",
        "description": "Enumerated events of default including payment default, breach of covenants, insolvency, cross-default, change of control, material adverse change, and misrepresentation, with applicable grace and cure periods.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "enforcement_rights",
        "name": "Enforcement Rights",
        "description": "Lender's rights upon an event of default: acceleration of outstanding amounts, enforcement of security, appointment of receiver, set-off rights, and recourse against guarantors. Often implied by statute but should be expressly stated.",
        "mandatory": True,
        "risk": "high",
    },
    {
        "key": "indemnification",
        "name": "Indemnification",
        "description": "Borrower's obligation to indemnify the lender for costs, losses, and expenses arising from breach, enforcement, illegality, and increased cost of funding.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "tax",
        "name": "Tax",
        "description": "Gross-up obligations for withholding tax, allocation of stamp duty and registration charges on security documents, and tax indemnities for changes in applicable tax law.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "assignment",
        "name": "Assignment",
        "description": "Rights of the lender to assign or transfer the loan or participation therein, restrictions on borrower's right to assign its obligations, and notice requirements for any assignment.",
        "mandatory": True,
        "risk": "medium",
    },
    {
        "key": "governing_law",
        "name": "Governing Law",
        "description": "The law governing the facility agreement (typically Indian law) and jurisdiction of courts — important for enforcement of security and guarantees.",
        "mandatory": True,
        "risk": "low",
    },
    {
        "key": "dispute_resolution",
        "name": "Dispute Resolution",
        "description": "Mechanism for resolving disputes — courts or arbitration under the Arbitration and Conciliation Act, 1996. SARFAESI-governed loans may have specific enforcement forums.",
        "mandatory": True,
        "risk": "medium",
    },
]

# ─── Registry ─────────────────────────────────────────────────────────────────

PLAYBOOKS: dict[str, dict[str, Any]] = {
    "bta":  {"name": "Business Transfer Agreement", "short": "BTA",  "clauses": BTA_CLAUSES},
    "sha":  {"name": "Shareholders Agreement",      "short": "SHA",  "clauses": SHA_CLAUSES},
    "ssa":  {"name": "Share Subscription Agreement","short": "SSA",  "clauses": SSA_CLAUSES},
    "spa":  {"name": "Share Purchase Agreement",    "short": "SPA",  "clauses": SPA_CLAUSES},
    "loan": {"name": "Loan Agreement",              "short": "LOAN", "clauses": LOAN_CLAUSES},
}

_RISK_ORDER = {"high": 2, "medium": 1, "low": 0}


def merge_clauses(playbook_types: list[str]) -> list[dict[str, Any]]:
    """Return deduplicated clause list from one or more playbooks.

    When combining SHA+SSA, all clauses become mandatory (combined document
    is expected to carry clauses from both playbooks).
    """
    combined = len(playbook_types) > 1
    seen: dict[str, dict] = {}

    for pt in playbook_types:
        for c in PLAYBOOKS[pt]["clauses"]:
            key = c["key"]
            entry = dict(c)
            entry["_playbook_type"] = pt

            if key in seen:
                existing = seen[key]
                # More mandatory of the two wins; higher risk wins
                if c["mandatory"]:
                    existing["mandatory"] = True
                if _RISK_ORDER[c["risk"]] > _RISK_ORDER[existing["risk"]]:
                    existing["risk"] = c["risk"]
            else:
                seen[key] = entry

    clauses = list(seen.values())

    if combined:
        for c in clauses:
            c["mandatory"] = True

    return clauses


# ─── Auto-detect ──────────────────────────────────────────────────────────────

_DETECT_KEYWORDS: dict[str, list[str]] = {
    "bta":  ["business transfer", "asset purchase", "slump sale", "going concern", "undertaking transfer"],
    "sha":  ["shareholders agreement", "shareholder rights", "investor rights", "tag-along", "drag-along",
             "sha", "board composition", "reserved matters"],
    "ssa":  ["share subscription", "subscription agreement", "subscribe for shares", "ssa",
             "subscription cum", "issue and allot"],
    "spa":  ["share purchase", "purchase of shares", "sale of shares", "spa", "acquisition of shares",
             "transfer of shares"],
    "loan": ["loan agreement", "facility agreement", "term loan", "credit agreement", "sanction letter",
             "promissory note", "loan facility", "working capital facility", "repayment schedule",
             "events of default", "security interest", "hypothecation agreement"],
}


def _heuristic_detect(name: str, contract_type: str | None, text_snippet: str) -> list[str] | None:
    """Return detected types if unambiguous, else None."""
    combined = (name + " " + (contract_type or "") + " " + text_snippet[:2000]).lower()
    hits = {pt for pt, kws in _DETECT_KEYWORDS.items() if any(kw in combined for kw in kws)}
    if not hits:
        return None
    # SHA + SSA combination
    if "sha" in hits and "ssa" in hits:
        return ["sha", "ssa"]
    if len(hits) == 1:
        return list(hits)
    return None


_DETECT_PROMPT = PromptTemplate(
    input_variables=["text"],
    template="""Classify this contract. Which type(s) apply?

- bta:  Business Transfer Agreement / Asset Purchase / Slump Sale
- sha:  Shareholders Agreement / Investment Agreement with investor governance rights
- ssa:  Share Subscription Agreement / Subscription cum Shareholders Agreement
- spa:  Share Purchase Agreement / Share Acquisition Agreement
- loan: Loan Agreement / Facility Agreement / Term Loan / Credit Agreement
- other: None of the above

Return ONLY valid JSON, no other text:
{{"types": ["bta"] or ["sha"] or ["ssa"] or ["spa"] or ["loan"] or ["sha","ssa"] or ["other"]}}

CONTRACT (first 4000 characters):
{text}""",
)


async def detect_playbook_types(
    name: str, contract_type: str | None, full_text: str | None
) -> list[str]:
    snippet = (full_text or "")[:4000]
    heuristic = _heuristic_detect(name, contract_type, snippet)
    if heuristic:
        return heuristic

    try:
        llm = get_fast_llm()
        chain = _DETECT_PROMPT | llm | StrOutputParser()
        raw = await chain.ainvoke({"text": snippet})
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
        raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
        result = json.loads(raw.strip())
        types = [t for t in result.get("types", []) if t in PLAYBOOKS]
        return types if types else ["other"]
    except Exception as exc:
        logger.warning("Playbook auto-detect failed: %s", exc)
        return ["other"]


# ─── LLM Audit ────────────────────────────────────────────────────────────────

_AUDIT_PROMPT = PromptTemplate(
    input_variables=["playbook_name", "clauses_block", "contract_text"],
    template="""You are a senior legal analyst specializing in Indian corporate law (Indian Contract Act 1872, Companies Act 2013, SEBI regulations).

Analyze the contract below against each clause from the {playbook_name} playbook.

For each clause, determine:
- "present"  — Clearly present and adequately covers the key requirements
- "partial"  — Exists but incomplete, one-sided, missing key protective elements, or inadequately drafted
- "missing"  — Absent from the contract

Return ONLY valid JSON (no markdown, no extra text):
{{
  "CLAUSE_KEY": {{
    "status": "present" | "partial" | "missing",
    "found_text": "<verbatim excerpt up to 400 characters, null if missing>",
    "notes": "<1-2 sentences explaining your assessment>",
    "suggested_text": "<concise draft clause for missing or partial clauses; null for present>"
  }},
  ...
}}

CLAUSES TO CHECK:
{clauses_block}

CONTRACT:
{contract_text}""",
)


def _build_clauses_block(clauses: list[dict]) -> str:
    lines = []
    for i, c in enumerate(clauses, 1):
        mandatory = "MANDATORY" if c["mandatory"] else "optional"
        lines.append(f"{i}. [{c['key']}] {c['name']} ({mandatory}, {c['risk']} risk)")
        lines.append(f"   {c['description']}")
    return "\n".join(lines)


def _parse_json_block(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
    return json.loads(raw.strip())


async def run_clause_audit(
    full_text: str,
    playbook_types: list[str],
    audit_max_chars: int = 300_000,
) -> tuple[list[dict[str, Any]], float]:
    """Run clause audit. Returns (results_list, overall_score)."""
    clauses = merge_clauses(playbook_types)
    playbook_names = " + ".join(PLAYBOOKS[pt]["name"] for pt in playbook_types if pt in PLAYBOOKS)
    clauses_block = _build_clauses_block(clauses)
    contract_text = full_text[:audit_max_chars]

    llm = get_llm()
    chain = _AUDIT_PROMPT | llm | StrOutputParser()
    raw = await chain.ainvoke({
        "playbook_name": playbook_names,
        "clauses_block": clauses_block,
        "contract_text": contract_text,
    })

    try:
        parsed = _parse_json_block(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Clause audit JSON parse failed: %s\nRaw: %s", exc, raw[:500])
        raise RuntimeError("LLM returned malformed JSON for clause audit") from exc

    results: list[dict[str, Any]] = []
    for clause in clauses:
        key = clause["key"]
        llm_data = parsed.get(key, {})
        results.append({
            "clause_key": key,
            "clause_name": clause["name"],
            "playbook_type": clause["_playbook_type"],
            "status": llm_data.get("status", "missing"),
            "mandatory": clause["mandatory"],
            "risk": clause["risk"],
            "found_text": llm_data.get("found_text"),
            "ai_notes": llm_data.get("notes"),
            "suggested_text": llm_data.get("suggested_text"),
        })

    # Score: weight mandatory clauses more
    total_weight = sum(2 if r["mandatory"] else 1 for r in results)
    earned = sum(
        (2 if r["mandatory"] else 1) * (1.0 if r["status"] == "present" else 0.5 if r["status"] == "partial" else 0.0)
        for r in results
    )
    score = round((earned / total_weight * 100) if total_weight else 0, 1)

    return results, score
