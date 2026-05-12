import { useState, useCallback } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ClipboardCopy,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
} from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { useContracts } from '@/hooks/useVault'
import { useRunMarketAnalysis, useDealTypes, useDetectDealType } from '@/hooks/useMarketAnalysis'
import { cn } from '@/lib/utils'
import type { MarketAnalysisDTO, MarketAnalysisClauseDTO } from '@/lib/api'
import { mockMarketAnalysis } from '@/mocks/marketData'

// ─── Position config ──────────────────────────────────────────────────────────

const POS_CONFIG = {
  '-2': { label: 'Very Aggressive', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA', icon: TrendingDown },
  '-1': { label: 'Aggressive',      color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', icon: TrendingDown },
   '0': { label: 'Market Standard', color: '#059669', bg: '#D1FAE5', border: '#A7F3D0', icon: Minus },
   '1': { label: 'Favorable',       color: '#4338CA', bg: '#EEF2FF', border: '#C7D2FE', icon: TrendingUp },
   '2': { label: 'Very Favorable',  color: '#312E81', bg: '#E0E7FF', border: '#A5B4FC', icon: TrendingUp },
} as const

type PosKey = keyof typeof POS_CONFIG

function posKey(p: number): PosKey {
  return String(Math.max(-2, Math.min(2, p))) as PosKey
}

// ─── Position spectrum bar ────────────────────────────────────────────────────

function PositionBar({ position }: { position: number }) {
  const pct = ((position + 2) / 4) * 100
  const cfg = POS_CONFIG[posKey(position)]
  return (
    <div className="relative w-full">
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        <div className="flex-1 bg-[#FECACA] rounded-l-full" />
        <div className="flex-1 bg-[#FDE68A]" />
        <div className="flex-1 bg-[#D1FAE5]" />
        <div className="flex-1 bg-[#C7D2FE]" />
        <div className="flex-1 bg-[#A5B4FC] rounded-r-full" />
      </div>
      <div
        className="absolute w-3 h-3 rounded-full border-2 border-white shadow -top-[3px] transition-all"
        style={{ left: `calc(${pct}% - 6px)`, backgroundColor: cfg.color }}
      />
    </div>
  )
}

// ─── Overall position meter ───────────────────────────────────────────────────

function OverallMeter({
  position,
  perspective,
  contractName,
  clauseCount,
}: {
  position: number
  perspective: string
  contractName: string
  clauseCount: { aggressive: number; market: number; favorable: number }
}) {
  const label =
    position < -0.5 ? 'Aggressive'
    : position > 0.5 ? 'Favorable'
    : 'Balanced'
  const color =
    position < -0.5 ? '#DC2626'
    : position > 0.5 ? '#4338CA'
    : '#059669'
  const pct = ((position + 2) / 4) * 100

  return (
    <div className="px-6 py-4 border-b border-border bg-surface flex-shrink-0">
      <div className="flex items-start gap-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={13} className="text-text-3 flex-shrink-0" />
            <p className="text-[12.5px] font-medium text-text-2 truncate">{contractName}</p>
            <span className="text-[11px] text-text-3 flex-shrink-0 capitalize">· {perspective} perspective</span>
          </div>
          <p className="text-[13px] font-semibold text-text mb-3">
            This contract is&nbsp;
            <span style={{ color }} className="font-bold">{label}</span>
            &nbsp;relative to market standard
          </p>
          <div className="relative mb-1.5">
            <div className="flex h-2 rounded-full overflow-hidden gap-px">
              <div className="flex-1 bg-[#FECACA] rounded-l-full" />
              <div className="flex-1 bg-[#FDE68A]" />
              <div className="flex-1 bg-[#D1FAE5]" />
              <div className="flex-1 bg-[#C7D2FE]" />
              <div className="flex-1 bg-[#A5B4FC] rounded-r-full" />
            </div>
            <div
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-sm -top-1 transition-all"
              style={{ left: `calc(${pct}% - 8px)`, backgroundColor: color }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-text-3">
            <span>Very Aggressive</span>
            <span>Market Standard</span>
            <span>Very Favorable</span>
          </div>
        </div>

        <div className="flex items-center gap-5 flex-shrink-0 text-center">
          <div>
            <p className="text-xl font-bold text-danger">{clauseCount.aggressive}</p>
            <p className="text-[10.5px] text-text-3 mt-0.5">Aggressive</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <p className="text-xl font-bold text-success">{clauseCount.market}</p>
            <p className="text-[10.5px] text-text-3 mt-0.5">At Market</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <p className="text-xl font-bold text-indigo">{clauseCount.favorable}</p>
            <p className="text-[10.5px] text-text-3 mt-0.5">Favorable</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Clause list item ─────────────────────────────────────────────────────────

function ClauseListItem({
  clause,
  selected,
  onClick,
}: {
  clause: MarketAnalysisClauseDTO
  selected: boolean
  onClick: () => void
}) {
  const cfg = POS_CONFIG[posKey(clause.position)]
  const Icon = cfg.icon
  return (
    <div
      onClick={onClick}
      className={cn(
        'px-4 py-3 cursor-pointer transition-colors border-b border-border',
        selected ? 'bg-indigo-lt border-r-2 border-r-indigo' : 'hover:bg-surface'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[12.5px] font-medium text-text leading-snug flex-1">{clause.clause_name}</p>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-pill flex-shrink-0 whitespace-nowrap"
          style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          <Icon size={9} className="inline mr-0.5 -mt-px" />
          {cfg.label}
        </span>
      </div>
      <PositionBar position={clause.position} />
      <div className="flex items-center justify-between mt-1.5">
        {!clause.mandatory && (
          <span className="text-[10px] text-text-3">Optional clause</span>
        )}
        {clause.risk_level === 'high' && (
          <span className="text-[10px] font-semibold text-danger ml-auto flex items-center gap-0.5">
            <AlertTriangle size={9} /> High risk
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Clause detail panel ──────────────────────────────────────────────────────

function ClauseDetail({ clause }: { clause: MarketAnalysisClauseDTO }) {
  const cfg = POS_CONFIG[posKey(clause.position)]
  const Icon = cfg.icon
  const [copied, setCopied] = useState(false)

  function copyRewrite() {
    if (!clause.suggested_rewrite) return
    navigator.clipboard.writeText(clause.suggested_rewrite)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-text leading-tight">{clause.clause_name}</h2>
          <p className="text-[12px] text-text-3 mt-0.5">
            {clause.mandatory ? 'Mandatory clause' : 'Optional clause'} ·{' '}
            <span className={cn(
              'font-medium',
              clause.risk_level === 'high' ? 'text-danger'
              : clause.risk_level === 'medium' ? 'text-warning'
              : 'text-success'
            )}>
              {clause.risk_level.charAt(0).toUpperCase() + clause.risk_level.slice(1)} risk
            </span>
          </p>
        </div>
        <span
          className="text-[11px] font-semibold px-3 py-1 rounded-pill flex-shrink-0 flex items-center gap-1"
          style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          <Icon size={11} />
          {cfg.label}
        </span>
      </div>

      {/* Position bar */}
      <div className="p-4 border border-border rounded-[9px] bg-surface">
        <div className="flex justify-between text-[10.5px] text-text-3 mb-3">
          <span>Very Aggressive</span>
          <span>Market Standard</span>
          <span>Very Favorable</span>
        </div>
        <PositionBar position={clause.position} />
        <div className="flex justify-between text-[10px] text-text-3 mt-2">
          <span>-2</span>
          <span style={{ color: cfg.color }} className="font-semibold">{cfg.label}</span>
          <span>+2</span>
        </div>
      </div>

      {/* Your clause text */}
      {clause.found_text ? (
        <div>
          <p className="text-[12px] font-semibold text-text-2 mb-2">Clause Text (from contract)</p>
          <div
            className="p-4 rounded-[8px] border font-mono text-[11.5px] text-text leading-relaxed"
            style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
          >
            {clause.found_text}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-[8px] border border-dashed border-border bg-surface">
          <p className="text-[12px] text-text-3 italic">This clause is absent from the contract.</p>
        </div>
      )}

      {/* Market standard */}
      <div>
        <p className="text-[12px] font-semibold text-text-2 mb-2">Market Standard</p>
        <div className="p-4 rounded-[8px] bg-indigo-lt border border-indigo-mid">
          <p className="text-[12.5px] text-text leading-relaxed">{clause.market_standard}</p>
        </div>
      </div>

      {/* Analysis */}
      <div>
        <p className="text-[12px] font-semibold text-text-2 mb-2">Analysis</p>
        <p className="text-[13px] text-text-2 leading-relaxed">{clause.explanation}</p>
      </div>

      {/* Suggested rewrite */}
      {clause.suggested_rewrite && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold text-text-2">Suggested Language</p>
            <button
              onClick={copyRewrite}
              className="flex items-center gap-1 text-[11px] font-medium text-indigo hover:text-indigo-dk transition-colors"
            >
              {copied ? <CheckCircle2 size={12} className="text-success" /> : <ClipboardCopy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="p-4 rounded-[8px] bg-success-lt border border-success/20 font-mono text-[11.5px] text-text leading-relaxed whitespace-pre-wrap">
            {clause.suggested_rewrite}
          </div>
        </div>
      )}

      {clause.position >= 1 && (
        <div className="flex items-center gap-2 p-3 bg-success-lt border border-success/20 rounded-[8px]">
          <CheckCircle2 size={14} className="text-success flex-shrink-0" />
          <p className="text-[12.5px] text-success font-medium">
            This clause is already {clause.position_label.toLowerCase()} — no changes recommended.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Setup panel ──────────────────────────────────────────────────────────────

const DEAL_TYPE_LABELS: Record<string, string> = {
  sha: 'Shareholders Agreement',
  ssa: 'Share Subscription Agreement',
  bta: 'Business Transfer Agreement',
  spa: 'Share Purchase Agreement',
  loan: 'Loan Agreement',
}

function SetupPanel({
  onAnalyze,
  isLoading,
}: {
  onAnalyze: (params: { contractId: string; dealType: string; perspective: string }) => void
  isLoading: boolean
}) {
  const { data: contracts } = useContracts()
  const { data: dealTypesData } = useDealTypes()
  const detectMutation = useDetectDealType()

  const [contractId, setContractId] = useState('')
  const [dealType, setDealType] = useState('')
  const [perspective, setPerspective] = useState('')
  const [contractSearch, setContractSearch] = useState('')
  const [showContracts, setShowContracts] = useState(false)

  const dealTypes = dealTypesData?.deal_types ?? []
  const selectedDealType = dealTypes.find((d) => d.key === dealType)
  const readyContracts = (contracts?.contracts ?? []).filter((c) => c.status === 'ready')
  const filteredContracts = readyContracts.filter((c) =>
    c.name.toLowerCase().includes(contractSearch.toLowerCase())
  )
  const selectedContract = readyContracts.find((c) => c.id === contractId)

  const handleContractSelect = useCallback(
    async (id: string) => {
      setContractId(id)
      setShowContracts(false)
      setDealType('')
      setPerspective('')
      try {
        const result = await detectMutation.mutateAsync(id)
        if (result.detected_deal_type) {
          setDealType(result.detected_deal_type)
          if (result.perspectives.length === 1) {
            setPerspective(result.perspectives[0].key)
          }
        }
      } catch {
        // detection is best-effort
      }
    },
    [detectMutation]
  )

  const canRun = !!contractId && !!dealType && !!perspective && !isLoading

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-lt rounded-[10px] flex items-center justify-center mx-auto mb-4">
            <Sparkles size={22} className="text-indigo" />
          </div>
          <h1 className="text-xl font-semibold text-text mb-2">Market Analysis</h1>
          <p className="text-sm text-text-2">
            Benchmark your contract's clauses against Indian market standards using AI,
            tailored to your deal type and perspective.
          </p>
        </div>

        <div className="space-y-4">
          {/* Contract picker */}
          <div>
            <label className="block text-[12px] font-semibold text-text-2 mb-1.5">Contract</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowContracts((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-border rounded-[8px] bg-white hover:border-indigo/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={14} className="text-text-3 flex-shrink-0" />
                  <span className={cn('text-[13px] truncate', selectedContract ? 'text-text' : 'text-text-3')}>
                    {selectedContract ? selectedContract.name : 'Select a contract from the vault…'}
                  </span>
                </div>
                <ChevronDown size={14} className="text-text-3 flex-shrink-0" />
              </button>

              {showContracts && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-[9px] shadow-lg z-20 overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-surface rounded-[6px]">
                      <Search size={12} className="text-text-3" />
                      <input
                        className="flex-1 text-[12.5px] bg-transparent outline-none text-text placeholder:text-text-3"
                        placeholder="Search contracts…"
                        value={contractSearch}
                        onChange={(e) => setContractSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredContracts.length === 0 ? (
                      <p className="px-4 py-3 text-[12px] text-text-3">No ready contracts found</p>
                    ) : filteredContracts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleContractSelect(c.id)}
                        className="w-full text-left px-4 py-2.5 hover:bg-surface transition-colors border-b border-border last:border-0"
                      >
                        <p className="text-[12.5px] font-medium text-text">{c.name}</p>
                        <p className="text-[11px] text-text-3 mt-0.5">{c.contract_type ?? 'Unknown type'}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {detectMutation.isPending && (
              <p className="text-[11px] text-indigo mt-1.5 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Detecting deal type…
              </p>
            )}
          </div>

          {/* Deal type */}
          <div>
            <label className="block text-[12px] font-semibold text-text-2 mb-1.5">Deal Type</label>
            <select
              value={dealType}
              onChange={(e) => { setDealType(e.target.value); setPerspective('') }}
              className="w-full px-3 py-2.5 border border-border rounded-[8px] bg-white text-[13px] text-text outline-none focus:border-indigo cursor-pointer"
            >
              <option value="">Select deal type…</option>
              {dealTypes.length > 0
                ? dealTypes.map((d) => (
                    <option key={d.key} value={d.key}>{d.name}</option>
                  ))
                : Object.entries(DEAL_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))
              }
            </select>
          </div>

          {/* Perspective */}
          {dealType && (
            <div>
              <label className="block text-[12px] font-semibold text-text-2 mb-1.5">Your Perspective</label>
              <div className="grid grid-cols-2 gap-2">
                {(selectedDealType?.perspectives ?? getPerspectivesForType(dealType)).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPerspective(p.key)}
                    className={cn(
                      'py-2.5 px-3 rounded-[8px] border text-[12.5px] font-medium transition-colors text-center',
                      perspective === p.key
                        ? 'border-indigo bg-indigo-lt text-indigo'
                        : 'border-border bg-white text-text-2 hover:border-indigo/40 hover:bg-surface'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!canRun}
            onClick={() => onAnalyze({ contractId, dealType, perspective })}
            className="w-full py-3 bg-indigo text-white text-sm font-semibold rounded-[8px] hover:bg-indigo-dk transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Analysing contract…
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Run Market Analysis
              </>
            )}
          </button>

          {isLoading && (
            <p className="text-center text-[11.5px] text-text-3">
              Gemini is reviewing each clause against market standards — this takes 30–60 seconds.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function getPerspectivesForType(dealType: string): { key: string; label: string }[] {
  const map: Record<string, { key: string; label: string }[]> = {
    sha:  [{ key: 'promoter', label: 'Promoter/Company' }, { key: 'investor', label: 'Investor' }],
    ssa:  [{ key: 'company', label: 'Company/Promoter' }, { key: 'investor', label: 'Investor' }],
    bta:  [{ key: 'buyer', label: 'Buyer' }, { key: 'seller', label: 'Seller' }],
    spa:  [{ key: 'buyer', label: 'Buyer' }, { key: 'seller', label: 'Seller' }],
    loan: [{ key: 'lender', label: 'Lender' }, { key: 'borrower', label: 'Borrower' }],
  }
  return map[dealType] ?? []
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'aggressive' | 'market' | 'favorable'

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'aggressive', label: 'Aggressive' },
  { key: 'market', label: 'At Market' },
  { key: 'favorable', label: 'Favorable' },
]

function applyFilter(clauses: MarketAnalysisClauseDTO[], filter: FilterKey) {
  if (filter === 'all') return clauses
  if (filter === 'aggressive') return clauses.filter((c) => c.position < 0)
  if (filter === 'market') return clauses.filter((c) => c.position === 0)
  return clauses.filter((c) => c.position > 0)
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(analysis: MarketAnalysisDTO) {
  const rows = [
    ['Clause', 'Position', 'Risk', 'Your Clause Text', 'Market Standard', 'Analysis', 'Suggested Language'],
    ...analysis.clauses.map((c) => [
      c.clause_name,
      c.position_label,
      c.risk_level,
      c.found_text ?? '(Absent)',
      c.market_standard ?? '',
      c.explanation ?? '',
      c.suggested_rewrite ?? '',
    ]),
  ]
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `market-analysis-${analysis.contract_name.replace(/[^a-z0-9]/gi, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MarketAnalysisPage() {
  const [analysis, setAnalysis] = useState<MarketAnalysisDTO | null>(null)
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')

  const runMutation = useRunMarketAnalysis()

  async function handleAnalyze(params: { contractId: string; dealType: string; perspective: string }) {
    try {
      const result = await runMutation.mutateAsync(params)
      setAnalysis(result)
      setSelectedClauseId(result.clauses[0]?.clause_key ?? null)
      setFilter('all')
    } catch {
      // error shown by mutation state
    }
  }

  function useMock() {
    setAnalysis(mockMarketAnalysis)
    setSelectedClauseId(mockMarketAnalysis.clauses[0]?.clause_key ?? null)
    setFilter('all')
  }

  const filteredClauses = analysis ? applyFilter(analysis.clauses, filter) : []
  const selectedClause = filteredClauses.find((c) => c.clause_key === selectedClauseId) ?? filteredClauses[0] ?? null

  const clauseCount = analysis
    ? {
        aggressive: analysis.clauses.filter((c) => c.position < 0).length,
        market: analysis.clauses.filter((c) => c.position === 0).length,
        favorable: analysis.clauses.filter((c) => c.position > 0).length,
      }
    : { aggressive: 0, market: 0, favorable: 0 }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        breadcrumb={[{ label: 'Market Analysis' }]}
        actions={
          analysis ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setAnalysis(null); setSelectedClauseId(null); setFilter('all') }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-2 border border-border rounded-[8px] hover:bg-surface transition-colors"
              >
                <RefreshCw size={13} /> New Analysis
              </button>
              <button
                onClick={() => exportCSV(analysis)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-2 border border-border rounded-[8px] hover:bg-surface transition-colors"
              >
                <Download size={13} /> Export CSV
              </button>
            </div>
          ) : (
            <button
              onClick={useMock}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-2 border border-border rounded-[8px] hover:bg-surface transition-colors"
            >
              <Sparkles size={13} /> View Demo
            </button>
          )
        }
      />

      {runMutation.isError && (
        <div className="mx-6 mt-3 p-3 bg-danger-lt border border-danger/20 rounded-[8px] flex items-center gap-2 flex-shrink-0">
          <AlertTriangle size={14} className="text-danger flex-shrink-0" />
          <p className="text-[12.5px] text-danger">{runMutation.error?.message ?? 'Analysis failed. Please try again.'}</p>
        </div>
      )}

      {!analysis ? (
        <SetupPanel onAnalyze={handleAnalyze} isLoading={runMutation.isPending} />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <OverallMeter
            position={analysis.overall_position ?? 0}
            perspective={analysis.perspective}
            contractName={analysis.contract_name}
            clauseCount={clauseCount}
          />

          <div className="flex-1 flex overflow-hidden">
            {/* Left — clause list */}
            <div className="w-[280px] flex-shrink-0 flex flex-col overflow-hidden border-r border-border bg-white">
              {/* Filter tabs */}
              <div className="flex border-b border-border">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => { setFilter(tab.key); setSelectedClauseId(null) }}
                    className={cn(
                      'flex-1 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2',
                      filter === tab.key
                        ? 'text-indigo border-indigo'
                        : 'text-text-3 border-transparent hover:text-text'
                    )}
                  >
                    {tab.label}
                    {tab.key !== 'all' && (
                      <span className="ml-1 text-[10px]">
                        ({tab.key === 'aggressive' ? clauseCount.aggressive
                          : tab.key === 'market' ? clauseCount.market
                          : clauseCount.favorable})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredClauses.length === 0 ? (
                  <p className="px-4 py-6 text-[12px] text-text-3 text-center">No clauses match this filter.</p>
                ) : (
                  filteredClauses.map((clause) => (
                    <ClauseListItem
                      key={clause.clause_key}
                      clause={clause}
                      selected={selectedClause?.clause_key === clause.clause_key}
                      onClick={() => setSelectedClauseId(clause.clause_key)}
                    />
                  ))
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-border bg-surface">
                <p className="text-[11px] text-text-3">{filteredClauses.length} of {analysis.clauses.length} clauses</p>
              </div>
            </div>

            {/* Right — detail */}
            {selectedClause ? (
              <ClauseDetail clause={selectedClause} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-text-3">Select a clause to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
