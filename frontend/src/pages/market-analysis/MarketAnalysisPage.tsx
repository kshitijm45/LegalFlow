import { useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { useMarketClauses } from '@/hooks/useMockQuery'
import { cn } from '@/lib/utils'
import type { MarketClause } from '@/types'

type FilterTab = 'All' | 'Below Market' | 'At Market' | 'Above'

const positionConfig = {
  below: { label: 'Below Market', color: '#DC2626', bg: '#FEE2E2' },
  at: { label: 'At Market', color: '#059669', bg: '#D1FAE5' },
  above: { label: 'Above Market', color: '#4338CA', bg: '#EEF2FF' },
}

function PercentileBar({ percentile, position }: { percentile: number; position: string }) {
  const color = positionConfig[position as keyof typeof positionConfig]?.color ?? '#4338CA'
  return (
    <div className="relative w-full h-2 bg-border rounded-full">
      <div className="absolute inset-0 flex">
        <div className="flex-1 rounded-l-full bg-danger-lt" />
        <div className="flex-1 bg-success-lt" />
        <div className="flex-1 rounded-r-full bg-indigo-lt" />
      </div>
      <div
        className="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm -top-0.5"
        style={{ left: `calc(${percentile}% - 6px)`, backgroundColor: color }}
      />
    </div>
  )
}

export function MarketAnalysisPage() {
  const { data: clauses, isLoading } = useMarketClauses()
  const [filter, setFilter] = useState<FilterTab>('All')
  const [selected, setSelected] = useState<MarketClause | null>(null)

  if (isLoading) return (
    <div className="flex-1 flex flex-col">
      <Topbar breadcrumb={[{ label: 'Market Analysis' }]} />
      <PageLoader />
    </div>
  )

  const filtered = clauses?.filter((c) => {
    if (filter === 'All') return true
    if (filter === 'Below Market') return c.position === 'below'
    if (filter === 'At Market') return c.position === 'at'
    if (filter === 'Above') return c.position === 'above'
    return true
  }) ?? []

  const selectedClause = selected ?? filtered[0] ?? null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        breadcrumb={[{ label: 'Market Analysis' }]}
        actions={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-2 border border-border rounded-[8px] hover:bg-surface transition-colors">
              <Share2 size={14} /> Share
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-2 border border-border rounded-[8px] hover:bg-surface transition-colors">
              <Download size={14} /> Export Report
            </button>
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left — clause list */}
        <div className="w-[320px] flex-shrink-0 flex flex-col overflow-hidden border-r border-border bg-white">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-text">Clauses</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-indigo-lt text-indigo">
                {filtered.length} clauses
              </span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-2 border border-border rounded-[8px] bg-surface">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-indigo flex-shrink-0">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span className="text-xs font-medium text-text flex-1 truncate">Tata Digital — MSA 2024</span>
              <button className="text-[11px] text-indigo font-medium hover:underline">Change</button>
            </div>
          </div>
          {/* Filter tabs */}
          <div className="flex border-b border-border">
            {(['All', 'Below Market', 'At Market', 'Above'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={cn(
                  'flex-1 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2',
                  filter === tab
                    ? 'text-indigo border-indigo'
                    : 'text-text-3 border-transparent hover:text-text'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Clause rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filtered.map((clause) => {
              const pos = positionConfig[clause.position]
              return (
                <div
                  key={clause.id}
                  onClick={() => setSelected(clause)}
                  className={cn(
                    'px-4 py-3.5 cursor-pointer hover:bg-surface transition-colors',
                    selectedClause?.id === clause.id && 'bg-indigo-lt border-r-2 border-indigo'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-[13px] font-medium text-text leading-snug flex-1">{clause.name}</p>
                    <span
                      className="text-[10.5px] font-semibold px-2 py-0.5 rounded-pill flex-shrink-0 whitespace-nowrap"
                      style={{ backgroundColor: pos.bg, color: pos.color }}
                    >
                      {pos.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <PercentileBar percentile={clause.percentile} position={clause.position} />
                    <span className="text-[11px] text-text-3 flex-shrink-0 whitespace-nowrap">{clause.percentile}th pct.</span>
                  </div>
                  <p className="text-[11px] text-text-3">{clause.category}</p>
                </div>
              )
            })}
          </div>

        </div>

        {/* Right — detail panel */}
        {selectedClause && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Context bar */}
            <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border bg-surface flex-shrink-0 flex-wrap">
              <span className="text-[12px] text-text-3">Industry</span>
              <select className="text-[12.5px] font-medium text-text border border-border rounded-[6px] px-2 py-1 bg-white outline-none focus:border-indigo cursor-pointer">
                <option>SaaS / Technology</option>
                <option>Financial Services</option>
                <option>Healthcare</option>
                <option>Manufacturing</option>
              </select>
              <span className="text-[12px] text-text-3 ml-2">Deal Size</span>
              <select className="text-[12.5px] font-medium text-text border border-border rounded-[6px] px-2 py-1 bg-white outline-none focus:border-indigo cursor-pointer">
                <option>Mid-Market (₹10Cr–₹500Cr)</option>
                <option>Enterprise (₹500Cr+)</option>
                <option>SMB (&lt;₹10Cr)</option>
              </select>
              <span className="text-[12px] text-text-3 ml-2">Region</span>
              <select className="text-[12.5px] font-medium text-text border border-border rounded-[6px] px-2 py-1 bg-white outline-none focus:border-indigo cursor-pointer">
                <option>India</option>
                <option>Singapore</option>
                <option>United Arab Emirates</option>
              </select>
              <span className="ml-auto text-[12px] text-text-3">Based on <strong className="text-text">2,847</strong> comparable agreements</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-lg font-semibold text-text">{selectedClause.name}</h2>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-pill"
                    style={{
                      backgroundColor: positionConfig[selectedClause.position].bg,
                      color: positionConfig[selectedClause.position].color,
                    }}
                  >
                    {positionConfig[selectedClause.position].label}
                  </span>
                </div>
                <p className="text-sm text-text-3">{selectedClause.category}</p>
              </div>

              {/* Score card */}
              <div className="p-5 border border-border rounded-[9px]">
                <div className="flex items-start gap-6 mb-4">
                  <div>
                    <p
                      className="text-5xl font-semibold"
                      style={{ color: positionConfig[selectedClause.position].color }}
                    >
                      {selectedClause.percentile}
                      <span className="text-2xl">th</span>
                    </p>
                    <p className="text-sm text-text-3 mt-1">Percentile</p>
                  </div>
                  <div className="flex-1 pt-2">
                    <div className="flex justify-between text-[10px] text-text-3 mb-1.5">
                      <span>Unfavorable</span>
                      <span>Market</span>
                      <span>Favorable</span>
                    </div>
                    <PercentileBar percentile={selectedClause.percentile} position={selectedClause.position} />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 pt-4 border-t border-border">
                  {[
                    { label: '25th Percentile', value: selectedClause.benchmarkStats.p25 },
                    { label: 'Median', value: selectedClause.benchmarkStats.p50 },
                    { label: '75th Percentile', value: selectedClause.benchmarkStats.p75 },
                    { label: 'Your Value', value: selectedClause.benchmarkStats.yourValue },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[11px] text-text-3 mb-1">{label}</p>
                      <p className="text-sm font-medium text-text">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Side-by-side comparison */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-3">Clause Comparison</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-danger" />
                      <p className="text-xs font-semibold text-text-2">Your Clause</p>
                    </div>
                    <div className="p-4 bg-danger-lt border border-danger/20 rounded-[8px]">
                      <p className="font-mono text-xs text-text leading-relaxed">{selectedClause.yourText}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-indigo" />
                      <p className="text-xs font-semibold text-text-2">Market Standard</p>
                    </div>
                    <div className="p-4 bg-indigo-lt border border-indigo-mid rounded-[8px]">
                      <p className="font-mono text-xs text-text leading-relaxed">{selectedClause.marketText}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key differences */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-3">Key Differences</h3>
                <div className="space-y-2">
                  {selectedClause.differences.map((diff, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-surface rounded-[8px]">
                      <span className="text-base flex-shrink-0">
                        {diff.type === 'risk' ? '🚨' : diff.type === 'warning' ? '⚠️' : '✅'}
                      </span>
                      <p className="text-sm text-text-2 leading-relaxed">{diff.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI recommendation */}
              <div className="p-5 bg-indigo-lt border border-indigo-mid rounded-[9px]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-indigo">⚡ AI Recommendation</span>
                </div>
                <p className="text-sm text-indigo/80 leading-relaxed mb-4">
                  This clause puts you in the bottom quartile for comparable agreements. Adopting the market standard language would improve your position to approximately the 55th percentile and address the key risk factors identified above.
                </p>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 px-4 py-2 bg-indigo text-white text-sm font-semibold rounded-[8px] hover:bg-indigo-dk transition-colors">
                    Apply Suggested Language
                  </button>
                  <button className="px-4 py-2 bg-white border border-indigo-mid text-indigo text-sm font-medium rounded-[8px] hover:bg-white/80 transition-colors">
                    Copy Clause
                  </button>
                  <button className="px-4 py-2 bg-white border border-indigo-mid text-indigo text-sm font-medium rounded-[8px] hover:bg-white/80 transition-colors">
                    View Precedents
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
