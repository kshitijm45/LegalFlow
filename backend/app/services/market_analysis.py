"""Market analysis service — AI-powered clause benchmarking against Indian market standards."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate

from app.services.clause_audit import PLAYBOOKS
from app.services.llm import get_llm

logger = logging.getLogger(__name__)


# ─── Deal-type market context blocks ─────────────────────────────────────────

_DEAL_CONTEXTS: dict[str, dict[str, Any]] = {
    "sha": {
        "name": "Shareholders Agreement",
        "perspectives": {"promoter": "Promoter/Company", "investor": "Investor"},
        "context": """
Shareholders Agreements in India (VC/PE investments or joint ventures) are governed by the Companies Act 2013 and Indian Contract Act 1872. Transfer restrictions and governance rights must be mirrored in the AoA to be enforceable against the company (per Supreme Court in V.B. Gopalkrishnan). IVCA model documents and AZB/Khaitan & Co market practice heavily influence drafting standards.

Critical Indian-specific constraint: Any special rights granted in the SHA (veto rights, board nomination, tag-along, drag-along) cannot survive an IPO listing — post-listing only director nomination rights and information rights are permissible under Indian securities law.

Market norms:
- Board Composition: Investors holding ≥10% typically get one nominee director; ≥25% may negotiate two nominees. Promoters retain majority board control in minority investments. Investor director must be present for valid board quorum (this is investor-favorable and heavily negotiated). Observer rights (without voting) are a promoter-friendly alternative for smaller investors.
- Reserved Matters: 10–20 items at board and shareholder level is market standard. Board-level reserved matters cover: annual budget approval, capital expenditure above threshold, new indebtedness above threshold, related-party transactions, key management hires/terminations. Shareholder-level reserved matters cover: new share issuances, amendments to AOA/MOA, M&A above threshold, liquidation/winding-up, change of business. An overly broad reserved matter list (covering operational decisions) is investor-favorable and strongly resisted by promoters.
- Tag-Along: Full tag-along at same price and terms is market standard for investors holding ≥5%. Partial pro-rata tag-along (investor can tag only proportionate to the stake being sold) is a promoter-favorable carve-out in larger transactions.
- Drag-Along: Drag-along triggered by majority investor vote alone is investor-favorable and resisted by promoters. Market standard requires 75% shareholder approval (by value) and a minimum price floor equal to the higher of original investment amount or a defined IRR (typically 1.0–1.5× invested capital). Drag-along at below-floor price requires unanimous consent.
- Anti-Dilution: Broad-based weighted average is market standard — adjusts conversion price based on all dilutive issuances weighted by their price and size. Full ratchet (adjusts to the lowest price of any new issuance regardless of size) is aggressive, investor-favorable, and rarely accepted. Standard carve-outs from anti-dilution: ESOP issuances, rights issues on a pro-rata basis, bonus shares, issuances pursuant to court-sanctioned schemes.
- Information Rights: Monthly MIS within 15 days, quarterly management accounts within 30 days of quarter-end, audited annual financials within 90 days of financial year-end — this is market standard for institutional PE/VC investors. Inspection rights (right to audit company books) are standard but may be limited to once per year.
- Non-Compete: 2–3 years post-exit restricted to the same line of business and geography is market standard for promoters. Non-solicitation of employees and customers runs alongside. Broader scope or longer duration is investor-favorable and scrutinized by Indian courts under Section 27 of the Indian Contract Act — post-termination restraints must be reasonable in scope to be enforceable.
- ROFR/ROFO: Right of First Refusal (ROFR) at the third-party offered price is market standard and investor-favorable — investor matches any third-party offer before promoter can transfer. Right of First Offer (ROFO) requires investor to name a price before the promoter approaches third parties, which is promoter-favorable. ROFR is significantly more common in Indian PE transactions.
- Liquidation Preference: 1× non-participating liquidation preference on CCPS is market standard for Series A/B — investor gets back invested capital before any equity distribution in a liquidation or downside exit. 2× or participating preference (investor gets preference amount plus participates in remaining proceeds) is aggressive and investor-favorable. Post-Series C, non-participating 1× is almost universal as founders gain leverage.
- Lock-up: 18–36 months for promoters post-investment is market standard. Investor lock-up (if any) is 6–12 months; institutional investors typically resist any lock-up on their own shares.
- Exit Rights: QIPO (Qualified IPO — minimum size and listing exchange defined) within 4–6 years is the primary exit mechanism. Secondary sale rights (investor can sell to a third party after a defined period) and put options (right to sell back to promoter at a defined price/IRR floor) are market standard as fallback exit mechanisms. Drag-along is the backstop exit right where no other mechanism works.
- Dispute Resolution: Arbitration under the Arbitration and Conciliation Act 1996, with Mumbai or Delhi as seat, is market standard. SIAC rules with Singapore seat are preferred for foreign investors due to enforceability concerns, though domestic arbitration has improved significantly post-2016 amendments.
""",
    },
    "ssa": {
        "name": "Share Subscription Agreement",
        "perspectives": {"company": "Company/Promoter", "investor": "Investor"},
        "context": """
Share Subscription Agreements in India govern fresh issuance of new shares to investors (funding rounds). Often combined with SHA (SSA cum SHA) for early-stage deals; separate documents are more common for later-stage PE transactions. Governed by Companies Act 2013 (Section 62 for rights issues, Section 42 for private placements), FEMA and the FEM (Non-Debt Instruments) Rules 2019 (for foreign investors), and AIF/SEBI Regulations.

Critical Indian-specific constraints: (1) Shares must be issued at or above fair market value for foreign investors — price below FMV is a FEMA violation. FMV must be certified by a SEBI-registered Category I Merchant Banker (for income-tax DCF purposes) or a registered valuer. (2) Shares must be allotted within 60 days of receipt of subscription amount under FEMA. (3) Form FC-GPR must be filed with RBI within 30 days of allotment for foreign investments.

Market norms:
- Subscription Price/Valuation: Fair market value using DCF or comparable company method is mandatory under FEM (NDI) Rules 2019 for foreign investors. For domestic investors, Section 56(2)(x) of the Income Tax Act imposes tax on issuances below FMV. Valuation reports are always attached as annexures.
- Share Class: CCPS (Compulsorily Convertible Preference Shares) is market standard for institutional PE/VC investments — provides liquidation preference and anti-dilution protection while deferring equity dilution to conversion. Equity shares are used for angel/seed rounds and rights issues. CCD (Compulsorily Convertible Debentures) is used for debt-like structures with equity upside.
- Conditions Precedent: Company CP (obligations before investor funds): board resolution approving allotment, special resolution for new share class under Section 62(1)(c), AoA amendment to incorporate new rights, execution of SHA, FEMA/RBI approvals, valuation report, NOC from existing investors, due diligence satisfactory completion. Investor CP (obligations before closing): no material adverse change, bring-down certificate from company confirming R&W accuracy at closing.
- Two-Closing Structure: First Closing (initial tranche against initial set of CPs) + Second Closing (remaining tranche against milestone-linked CPs) is market standard for larger rounds (above ₹50 cr) and for transactions where regulatory approvals take time.
- Representations & Warranties: Company and promoters give broad R&Ws covering: corporate status and authority, capitalization and cap table accuracy, audited financials (true and fair), litigation (no undisclosed material litigation), IP ownership (no infringement), material contracts (no defaults), compliance with all applicable laws, no undisclosed related-party transactions. Materiality qualifiers are common but should be narrowly defined. Disclosure letter qualifications — where known issues are carved out by specific disclosure — are market standard and essential.
- Indemnification: Basket/deductible of 0.5–1% of investment amount is market standard — no claims until losses cross this threshold. General R&W cap of 0.5–1× investment for most PE transactions; fundamental R&W cap (title, authority, capitalization, fraud) is typically uncapped or at 1× investment. Survival period: 18–24 months post-closing for general R&Ws; indefinite for fraud, title, and fundamental R&Ws.
- Anti-Dilution: Broad-based weighted average anti-dilution on CCPS conversion price, triggered by down-rounds (issuances below the original subscription price), is market standard. Standard carve-outs: ESOP pool (typically 10–15% of fully diluted capital), rights issues, conversion of existing CCPS, court-sanctioned schemes.
- Promoter Obligations: Full-time commitment covenant (promoter cannot take up outside employment), IP assignment to the company (all IP created by founder attributed to company), share pledge by promoter (pledge of promoter's equity as security for R&W indemnity obligations) are market standard for early-stage deals. Later-stage PE deals for established companies negotiate these more heavily.
- FEMA/RBI Reporting: FC-GPR filing within 30 days of allotment, ARF (Advance Remittance Form) filing before remittance for government route deals, and FIRMS portal reporting are mandatory compliance items typically documented as post-closing conditions in the SSA.
- Closing Timeline: T+30 to T+60 days post-signing for domestic investments; T+60 to T+90 for FEMA-regulated foreign investments (accounting for FC-GPR preparation and RBI/FIRMS portal filings). Deals requiring CCI approval (typically triggered above ₹2,000 cr deal value under the new deal value threshold introduced in 2023) take T+120 or longer.
- Governing Law: Indian law; arbitration with Mumbai or Delhi seat is market standard. SIAC (Singapore seat) is common for foreign investors.
""",
    },
    "bta": {
        "name": "Business Transfer Agreement",
        "perspectives": {"buyer": "Buyer", "seller": "Seller"},
        "context": """
Business Transfer Agreements (slump sale / going concern transfers) in India are governed by the Indian Contract Act 1872, Companies Act 2013 (Section 180 requires shareholder special resolution to transfer whole or substantially the whole of an undertaking), and Income Tax Act 1961 (Section 2(42C) defines slump sale; Section 50B governs capital gains computation; Form 3CEA Chartered Accountant certificate is mandatory). Transfer of employees triggers Industrial Disputes Act 1947 (Section 25FF). GST on slump sales is exempt only if transferred as a going concern (Notification 12/2017 Central Tax Rate — "transfer of a going concern as a whole" is exempt from GST).

Critical Indian-specific constraint: No individual values can be assigned to assets and liabilities in a slump sale — only a lump-sum consideration is permissible. Any itemized breakup (even for stamp duty purposes) must be clearly stated as being only for stamp duty allocation and not as valuation of individual assets, to avoid the transaction being re-characterized as an individual asset sale (see Piramal Enterprises Ltd v. Maharashtra Revenue Authority). A CA-certified Form 3CEA is mandatory.

Market norms:
- Consideration: Lump-sum slump sale price with working capital adjustment (above/below normalized net working capital level as of a reference date) and net debt adjustment is market standard for mid-market BTAs. Locked-box mechanism (fixed price based on a historical balance sheet, with leakage protections) is increasingly used for clean exits. Earn-outs (linked to post-closing EBITDA or revenue targets) are used for businesses with uncertain near-term cash flows but create post-closing disputes and are less preferred.
- Appointed Date vs. Closing Date: The "Appointed Date" (economic effective date of transfer, typically set before signing) is distinct from the "Closing Date" (legal completion date). All business revenues and expenses from the Appointed Date onwards are for the buyer's account. This is unique to Indian BTAs and not found in international M&A. Courts have upheld Appointed Date mechanics in tax disputes.
- Representations & Warranties: Seller gives broad R&Ws covering: title to all transferred assets (free from encumbrances), authority and corporate approvals, accuracy of business financials, no undisclosed material contracts or litigation, compliance with all applicable laws, IP ownership and no infringement, employee matters (no undisclosed disputes, PF/ESIC compliance), environmental compliance, all statutory licenses valid and transferable. Disclosure schedule qualifications are market standard — only "fairly disclosed" exceptions accepted by buyers.
- Indemnification: Basket of 1–2% of transaction value (tipping basket, not deductible, is buyer-favorable) is market standard. General R&W indemnity cap of 15–25% of purchase price; fundamental R&W cap (title, authority, no encumbrances) of 100% of purchase price. Fraud is uncapped. Survival: 18–24 months post-closing for general R&Ws; indefinitely for title, fraud, tax, and environmental matters. Specific indemnities for identified DD issues (disclosed but not warranted away) are market standard.
- Non-Compete: Seller and key management restricted from competing in the same business and geography for 2–3 years post-closing — market standard and upheld by Indian courts in M&A contexts (unlike employment contracts where post-termination restraints are more strictly scrutinized). Non-solicitation of employees and customers runs concurrently.
- Employee Transfer: Automatic transfer under Industrial Disputes Act 1947, Section 25FF — buyer must offer continued employment on same or better terms. Seller indemnifies buyer for all pre-transfer employee claims (unpaid wages, PF/ESIC arrears, gratuity disputes, retrenchment claims). Buyer obtains NOC from key employees as a CP. EPFO transfer (EPF account transfer) and ESIC registration in buyer's name are post-closing actions.
- Tax: Seller bears capital gains tax on slump sale under Section 50B — computed as sale consideration minus net worth of undertaking (not individual asset values). Long-term capital gain (holding > 36 months) at 20% with indexation; short-term at slab rates. Tax covenant (seller indemnifies buyer for all pre-closing tax liabilities, including transfer pricing adjustments) is market standard. Buyer bears stamp duty on BTA — rate varies by state (typically 0.1–0.5% for agreements to sell; higher if structured as a conveyance deed). GST exemption for going concern transfer applies if all conditions of Notification 12/2017 are met.
- Conditions Precedent: Board resolution + special shareholder resolution (Section 180), CCI approval (if thresholds met), NCLT/NCLAT approval (if regulated entity), regulatory consents for specific licenses (drug licenses, FSSAI, spectrum, mining leases — sector-specific), third-party contract novations (key customer/supplier contracts), lender NOCs for charge release, tax clearance certificates — all standard CPs. Long-stop date of 3–6 months from signing is market standard; either party can terminate if CPs not satisfied by long-stop date.
- Stamp Duty: BTA structured as "agreement to sell" (not conveyance deed) attracts lower stamp duty in most states. A separate conveyance deed for immovable property is executed at closing and attracts applicable property stamp duty (state-specific, typically 3–7% on immovable property value). Parties should agree on stamp duty allocation in the BTA — market practice is buyer bears stamp duty on all assets; seller bears capital gains tax.
""",
    },
    "spa": {
        "name": "Share Purchase Agreement",
        "perspectives": {"buyer": "Buyer", "seller": "Seller"},
        "context": """
Share Purchase Agreements for secondary share transfers in India are governed by the Companies Act 2013, SEBI Takeover Regulations 2011 (for acquisitions triggering 25%+ in listed companies), FEMA and FEM (NDI) Rules 2019 (for cross-border transactions), and Competition Act 2002 (CCI approval mandatory if thresholds exceeded). Market standard is influenced by IVCA model documents and international PE/M&A practice adapted for Indian law.

Critical Indian-specific constraints: (1) FEMA pricing norms — shares transferred to non-residents must be at fair market value; shares transferred from non-residents to residents must also comply with FMV pricing. (2) CCI approval is mandatory if combined assets/turnover exceed thresholds (₹2,500 cr Indian assets or ₹7,500 cr Indian turnover; or global thresholds). New deal value threshold (₹2,000 cr deal value + target with substantial Indian business) was introduced in 2023. (3) Stamp duty on share transfer: 0.015% of consideration (SEBI circular 2019 — uniform rate for demat shares under Indian Stamp Act 1899). Physical share transfers attract state-specific stamp duty.

Market norms:
- Purchase Price: Fixed consideration with locked-box mechanism (buyer bears economic risk/benefit from a locked-box date based on a historical balance sheet, with seller indemnifying for any "leakage" between locked-box date and closing) is increasingly preferred over completion accounts (post-closing price adjustment based on closing balance sheet). Completion accounts with working capital, net debt, and normalized earnings adjustments remain market standard for complex mid-market deals. Escrow of 10–15% of purchase price held for 12–18 months for R&W indemnity claims is market standard; PE sellers resist escrows and prefer W&I insurance instead.
- W&I Insurance: Warranty and Indemnity insurance is increasingly common for deals above ₹200 cr, particularly where the seller is a PE fund seeking a clean exit. W&I coverage typically mirrors the general R&W cap; fundamental R&Ws remain seller-retained. Retention under W&I policies is typically 1% of deal value. PE sellers increasingly insist on W&I as the sole recourse mechanism, eliminating seller escrow.
- Representations & Warranties: Seller gives comprehensive R&Ws organized as: fundamental R&Ws (title to shares, authority, capitalization — survive indefinitely), and general R&Ws (financials, litigation, contracts, IP, employees, tax, regulatory compliance, environmental — survive 18–24 months). Disclosure schedules qualify R&Ws — only "fairly disclosed" exceptions are market standard (vague or generic disclosures do not qualify specific R&Ws). "Knowledge qualifiers" (limiting seller liability to matters within seller's actual knowledge) are negotiated — buyers resist them; sellers insist for operational R&Ws.
- Indemnification: Basket/deductible of 0.5–1% of deal value is market standard (deductible preferred by sellers; tipping basket preferred by buyers). General R&W cap of 15–25% of purchase price for non-insured deals; fundamental R&W cap of 100% of purchase price. Fraud and willful misrepresentation are uncapped. Duty to mitigate on the indemnified party and no double-recovery principle are market standard.
- Non-Compete: 2–3 years for seller and key management (founders/promoters), restricted to the same line of business and geography — market standard and enforceable in M&A contexts under Indian courts (unlike employment agreements). Non-solicitation of employees and customers is standard. Overly broad non-competes covering unrelated business lines or global geography are routinely challenged under Section 27 of the Indian Contract Act.
- MAC (Material Adverse Change): MAC clause allowing buyer to terminate if a material adverse change occurs between signing and closing is market standard. Indian courts interpret MAC narrowly — must show substantial, durationally significant negative impact on business as a whole. Market standard carve-outs (MAC does not include): general economic/market conditions, industry-wide changes, changes in applicable law, acts of god/force majeure, changes resulting from announcement of the transaction itself. Pandemic-type carve-outs ("epidemic/pandemic" explicitly carved out) are now market standard post-COVID.
- CCI/FEMA: CCI filing is mandatory if thresholds are exceeded — breach is a criminal offence (penalty up to 1% of global turnover). CCI approval (typically 30–60 working days for Phase I, up to 210 days for Phase II) is a standard CP. For foreign buyers: FEMA approval through automatic route for most sectors; government route for FDI-sensitive sectors (defence, media, retail, etc.). RBI approval for acquisition of shares of Indian companies by overseas entities in banking/financial services sector. All regulatory approvals are mandatory CPs — parties cannot close before obtaining them.
- Closing: Simultaneous sign-and-close is market standard for simpler deals with no regulatory approvals required. Sign-then-close (gap of T+30 to T+90 depending on CCI/FEMA approvals) for deals requiring regulatory clearance. Seller's pre-closing obligations: operate business in ordinary course, no material contracts outside ordinary course without buyer consent, no new equity issuances or encumbrances, no dividend payments — all market standard interim operating covenants.
- Listed Company Acquisitions: Acquisitions triggering 25%+ shareholding in listed Indian companies trigger a mandatory open offer under SEBI SAST Regulations 2011 (offer to acquire at least 26% from public shareholders at not less than the market price). This is a non-negotiable regulatory obligation and significantly impacts deal economics for listed company acquisitions.
- Dispute Resolution: Arbitration under Arbitration and Conciliation Act 1996, Mumbai or Delhi seat — domestic market standard. SIAC (Singapore seat) for cross-border deals involving foreign buyers — preferred due to enforcement certainty under New York Convention. Indian courts have increasingly upheld arbitration awards in M&A disputes; specific performance of SPAs is available but discretionary.
""",
    },
    "loan": {
        "name": "Loan Agreement",
        "perspectives": {"lender": "Lender", "borrower": "Borrower"},
        "context": """
Loan Agreements in India for corporate lending are governed by the Indian Contract Act 1872, SARFAESI Act 2002 (enforcement of security by banks and NBFCs without court intervention), Companies Act 2013 (charge creation and registration under Sections 77–87), and RBI regulations (EBLR mandatory for retail and MSME floating rate loans; ECB regulations for foreign currency borrowings). IBA model forms and LMA-style documentation are used for institutional and syndicated lending.

Critical Indian-specific constraints: (1) All charges on company assets must be registered with MCA21 within 30 days of creation — unregistered charges are void against liquidators and creditors (Section 77 Companies Act). (2) RBI mandates External Benchmark Lending Rate (EBLR, typically repo rate + spread) for all new floating-rate retail and MSME loans from October 2019 — approximately 61% of all floating rate loans are now EBLR-linked. MCLR (Marginal Cost of Funds-based Lending Rate) is still used for non-MSME corporate loans and legacy portfolios (36% of floating rate loans as of Dec 2024). (3) Foreign currency loans (ECB) are subject to RBI's ECB Master Directions — eligible borrowers, lenders, end-use restrictions, and interest rate ceilings all apply.

Market norms:
- Interest Rate: Floating rates for MSME/retail: EBLR (Repo Rate + credit risk spread, currently repo rate 6.25% as of May 2026) is mandatory under RBI guidelines. Corporate loans: MCLR-linked or EBLR-linked depending on lender policy; private credit funds (AIFs, FPIs) have no regulatory ceiling and can structure rates as cash coupon + PIK + equity kicker + IRR-linked redemption premium. Default interest: 2–3% per annum above the contractual rate is market standard; RBI has signalled scrutiny of "penal charges" and mandated that penal charges must be reasonable and non-compounding (effective April 2024).
- Security Package: First pari passu charge on all current assets (hypothecation) + first pari passu charge on movable fixed assets + equitable mortgage on immovable property is the standard security package for term loans from Indian banks. Pledge of 51% promoter equity is market standard for mid-market corporate loans; 26–30% pledge is common for large-cap borrowers. Personal guarantee by promoters is market standard for SME/mid-market (below ₹500 cr); negotiable and increasingly resisted for large corporates and PE-owned companies. CERSAI registration is mandatory for mortgage and pledge transactions above ₹1 lakh.
- Events of Default: Payment default with 0–3 day cure period (grace period); financial covenant breach with 30-day cure period; cross-default (default on other material indebtedness above a defined threshold); change of control without lender consent; material adverse change (MAC) — increasingly defined by specific financial triggers rather than open-ended MAC language; insolvency/IBC petition; misrepresentation — all are market standard EODs. Cross-acceleration (acceleration of other indebtedness rather than just default) is borrower-favorable and increasingly common in leveraged structures. MAC as a standalone EOD without specific triggers is lender-favorable and heavily negotiated.
- Financial Covenants: DSCR minimum 1.20–1.50× (EBITDA divided by debt service — principal + interest — for the period) is market standard for project finance and infrastructure; 1.10–1.25× for working capital-intensive businesses. Net Debt/EBITDA cap of 3.0–4.0× is standard for investment-grade corporate loans; 4.0–5.0× for leveraged loans. Minimum Net Worth maintenance covenant (typically set at 75–80% of net worth as of the last audited balance sheet) is market standard. Equity cure rights (allowing equity injection to cure a covenant breach instead of triggering EOD) are borrower-favorable and increasingly negotiated in PE-backed leveraged loans. Current Ratio minimum of 1.10–1.25 is standard for working capital facilities.
- Negative Covenants: Restrictions on: additional financial indebtedness (above agreed basket), asset disposal above threshold (typically 10% of total assets), creation of encumbrances on assets (subject to permitted security basket), dividends during default, change of business/management without consent, related-party transactions above threshold, mergers/acquisitions above threshold — all market standard. Carve-outs for ordinary course transactions and maintenance capex are essential from a borrower perspective.
- Prepayment: Voluntary prepayment at borrower's option with 30–60 days notice. Prepayment premium of 1–2% on outstanding amount is market standard for fixed-rate and MCLR-linked loans; no prepayment penalty on floating-rate loans is now mandatory for personal/MSME loans under RBI guidelines (2025). Make-whole premium (present value of foregone interest) is used in private credit/NCD structures. Mandatory prepayment from: excess cash flow sweeps (typically 50–75% of excess cash flow above defined threshold), asset sale proceeds (net of reinvestment basket), insurance proceeds, equity raises — all standard in leveraged structures.
- Security Enforcement: SARFAESI Act 2002 allows secured creditors (banks and notified NBFCs) to enforce security — take possession, sell assets — without court intervention after issuing a 60-day demand notice. IBC Section 14 moratorium halts all SARFAESI enforcement once insolvency proceedings commence. DRT (Debt Recovery Tribunal) process available for claims above ₹20 lakh but is slower (notionally 60 days but often 1–3 years in practice). Pledge enforcement on listed shares requires notice to pledgor; no court order needed; subject to SEBI Takeover Code if invocation crosses 25% shareholding.
- Intercreditor Agreement (ICA): For syndicated or multi-lender facilities, ICA governs security sharing (pari passu), voting thresholds for consent matters (typically 75% by value for material amendments), enforcement decisions (majority lender decision), and waterfall distribution. RBI's June 2019 Prudential Framework mandates ICAs for stressed asset resolution (minimum 75% by value and 60% by number of lenders to sign a resolution plan).
""",
    },
}


def get_deal_types() -> dict[str, str]:
    return {k: v["name"] for k, v in _DEAL_CONTEXTS.items()}


def get_perspectives(deal_type: str) -> dict[str, str]:
    return _DEAL_CONTEXTS.get(deal_type, {}).get("perspectives", {})


# ─── Analysis prompt ──────────────────────────────────────────────────────────

_ANALYSIS_PROMPT = PromptTemplate(
        input_variables=[
                "deal_name", "perspective_label", "opposite_label",
                "clauses_block", "contract_text",
        ],
        template="""You are a senior Indian corporate lawyer with 20 years of M&A and transactional experience.

Assume the contract you are reviewing is a private equity or venture capital transaction document (PE/VC). Do NOT rely on any external deal context — judge clauses as they would appear in PE/VC transactions and focus only on Indian market practices and standards.

You are reviewing a {deal_name} from the perspective of the **{perspective_label}**.

For each clause listed below, analyze the contract text and return a JSON object. Use your own knowledge of Indian PE/VC market standards; the contract text may not explicitly state all details, so infer based on typical legal language and implications.

Position scores are from the **{perspective_label}'s** perspective:
- +2: Very Favorable — strongly protects {perspective_label}, significantly better than market
- +1: Favorable — better than market standard for {perspective_label}
-  0: Market Standard — balanced, typical for this deal type in India
- -1: Aggressive — favors {opposite_label}, worse than market for {perspective_label}
- -2: Very Aggressive — strongly favors {opposite_label}, far below market for {perspective_label}

If a clause is completely absent from the contract, set found_text to null and score it based on what its absence means for {perspective_label}.

CRITICAL JSON FORMATTING RULES — follow all of these exactly:
1. Return ONLY the raw JSON object — no markdown fences, no preamble, no trailing text.
2. found_text must be at most 200 characters. Truncate with "..." if needed.
3. found_text must contain NO double-quote characters. Replace any " in the contract excerpt with ' (single quote).
4. Replace any newlines or tabs inside string values with a single space.
5. Every string value must be properly closed with a double-quote before the comma or closing brace.
{{
    "CLAUSE_KEY": {{
        "found_text": "<verbatim excerpt ≤200 chars, NO double quotes — use single quotes instead, or null if absent>",
        "position": <integer: -2, -1, 0, 1, or 2>,
        "position_label": "<'Very Aggressive' | 'Aggressive' | 'Market Standard' | 'Favorable' | 'Very Favorable'>",
        "market_standard": "<one concise sentence: what does market standard look like for this clause in Indian {deal_name} practice?>",
        "explanation": "<2–3 sentences: why is this clause at this position? cite specific language or absence>",
        "suggested_rewrite": "<improved clause text that moves toward market standard or better for {perspective_label}; null if already Favorable or Very Favorable>",
        "risk_level": "<'high' | 'medium' | 'low'>"
    }},
    ...
}}

CLAUSES TO ANALYZE:
{clauses_block}

CONTRACT TEXT:
{contract_text}""",
)


def _parse_json_block(raw: str) -> dict[str, Any]:
    """Parse JSON from LLM response with two progressive fallbacks.

    Layer 1: direct parse after stripping markdown fences and smart quotes.
    Layer 2: json-repair, which handles unescaped embedded quotes (e.g. legal
              text containing "GA Directors", inside found_text), missing commas,
              and truncated output (LLM hit token limit mid-object).
    Raises RuntimeError with context if both layers fail.
    """
    from json_repair import repair_json

    # Strip markdown code fences the LLM sometimes adds around JSON
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
    raw = raw.strip()

    # Normalize curly/smart quotes to plain ASCII (unambiguous, no edge cases)
    cleaned = (
        raw
        .replace("\u201c", chr(34)).replace("\u201d", chr(34))
        .replace("\u2018", chr(39)).replace("\u2019", chr(39))
    )

    # Layer 1: direct parse (works when the LLM follows instructions)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Layer 2: json-repair handles hard cases:
    #   - unescaped " inside string values (e.g. "GA Directors", inside found_text)
    #   - embedded newlines inside string values
    #   - truncated output (LLM hit token limit mid-object)
    #   - missing commas between fields
    logger.warning("Direct JSON parse failed — attempting json-repair")
    try:
        repaired = repair_json(cleaned, return_objects=True)
        if isinstance(repaired, dict) and repaired:
            return repaired
        logger.warning("json-repair returned empty/non-dict: %r", repaired)
    except Exception as exc:
        logger.warning("json-repair raised: %s", exc)

    raise RuntimeError(
        f"LLM returned malformed JSON that could not be repaired. "
        f"First 500 chars of raw output: {cleaned[:500]}"
    )

def _build_clauses_block(clauses: list[dict]) -> str:
    lines = []
    for i, c in enumerate(clauses, 1):
        lines.append(f"{i}. [{c['key']}] {c['name']}")
        lines.append(f"   {c['description']}")
    return "\n".join(lines)


_POSITION_LABELS = {
    -2: "Very Aggressive",
    -1: "Aggressive",
     0: "Market Standard",
     1: "Favorable",
     2: "Very Favorable",
}


async def run_market_analysis(
    full_text: str,
    deal_type: str,
    perspective: str,
    max_chars: int = 300_000,
) -> tuple[list[dict[str, Any]], float]:
    """Run market analysis. Returns (results_list, overall_position_score)."""
    if deal_type not in _DEAL_CONTEXTS:
        raise ValueError(f"Unsupported deal type: {deal_type}")
    if deal_type not in PLAYBOOKS:
        raise ValueError(f"No playbook for deal type: {deal_type}")

    ctx = _DEAL_CONTEXTS[deal_type]
    perspectives = get_perspectives(deal_type)
    perspective_label = perspectives.get(perspective, perspective)
    opposite_label = next(
        (v for k, v in perspectives.items() if k != perspective),
        "Counterparty",
    )

    clauses = PLAYBOOKS[deal_type]["clauses"]
    clauses_block = _build_clauses_block(clauses)

    llm = get_llm()
    chain = _ANALYSIS_PROMPT | llm | StrOutputParser()
    raw = await chain.ainvoke({
        "deal_name": ctx["name"],
        "perspective_label": perspective_label,
        "opposite_label": opposite_label,
        "clauses_block": clauses_block,
        "contract_text": full_text[:max_chars],
    })

    try:
        parsed = _parse_json_block(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Market analysis JSON parse failed: %s\nRaw: %s", exc, raw[:500])
        raise RuntimeError("LLM returned malformed JSON for market analysis") from exc

    results: list[dict[str, Any]] = []
    for clause in clauses:
        key = clause["key"]
        llm_data = parsed.get(key, {})
        try:
            position = max(-2, min(2, int(llm_data.get("position", 0))))
        except (TypeError, ValueError):
            position = 0

        # Clean up found_text: remove newlines and extra whitespace
        found_text = llm_data.get("found_text")
        if found_text and isinstance(found_text, str):
            found_text = re.sub(r"\s+", " ", found_text).strip()
            if len(found_text) > 300:
                found_text = found_text[:300] + "..."

        results.append({
            "clause_key": key,
            "clause_name": clause["name"],
            "found_text": found_text,
            "position": position,
            "position_label": _POSITION_LABELS.get(position, "Market Standard"),
            "market_standard": llm_data.get("market_standard", ""),
            "explanation": llm_data.get("explanation", ""),
            "suggested_rewrite": llm_data.get("suggested_rewrite"),
            "risk_level": llm_data.get("risk_level", "medium"),
            "mandatory": clause["mandatory"],
        })

    # Weighted average: mandatory clauses count double
    total_weight = sum(2 if r["mandatory"] else 1 for r in results)
    total_score = sum(r["position"] * (2 if r["mandatory"] else 1) for r in results)
    overall_position = round((total_score / total_weight) if total_weight else 0.0, 2)

    return results, overall_position
