import { useState } from 'react'
import { ChevronRight, Download, Share2, Copy, Edit3, Plus, RotateCw } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { useClauseCategoriesForDoc } from '@/hooks/useMockQuery'
import { mockClauseCategories, getClauseSummary } from '@/mocks/clauses'
import { cn } from '@/lib/utils'

const statusConfig = {
  present: { label: 'Present', color: '#059669', bg: '#D1FAE5', icon: '✓' },
  missing: { label: 'Missing', color: '#DC2626', bg: '#FEE2E2', icon: '✗' },
  partial: { label: 'Partial', color: '#D97706', bg: '#FEF3C7', icon: '~' },
}

const riskConfig = {
  critical: { label: 'Critical', color: '#B91C1C', bg: '#FEE2E2' },
  high: { label: 'High', color: '#DC2626', bg: '#FEE2E2' },
  medium: { label: 'Medium', color: '#D97706', bg: '#FEF3C7' },
  low: { label: 'Low', color: '#475569', bg: '#F1F5F9' },
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

export function ClauseAuditPage() {
  const { data: categories, isLoading } = useClauseCategoriesForDoc('doc-1')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['liability', 'ip']))
  const [expandedClause, setExpandedClause] = useState<string | null>('c10') // Work Made for Hire

  if (isLoading) return (
    <div className="flex-1 flex flex-col">
      <Topbar breadcrumb={[{ label: 'Clause Audit' }]} />
      <PageLoader />
    </div>
  )

  const summary = getClauseSummary(mockClauseCategories)

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const coveragePct = Math.round((summary.present / summary.total) * 100)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        breadcrumb={[{ label: 'Clause Audit' }]}
        actions={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-2 border border-border rounded-[8px] hover:bg-surface transition-colors">
              <Share2 size={14} /> Share
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-2 border border-border rounded-[8px] hover:bg-surface transition-colors">
              <Download size={14} /> Export Report
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-success rounded-[8px] hover:bg-success/90 transition-colors">
              <Plus size={14} /> Fix All with AI
            </button>
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left — config panel */}
        <div className="w-[272px] flex-shrink-0 flex flex-col overflow-y-auto border-r border-border bg-surface gap-5 p-5">

          {/* Document */}
          <div>
            <p className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-2.5">Document</p>
            <div className="p-3 bg-white border border-border rounded-[9px]">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 bg-indigo-lt border border-indigo-mid rounded-[8px] flex items-center justify-center text-indigo flex-shrink-0">
                  <FileIcon />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text leading-snug">Tata Digital — MSA 2024</p>
                  <p className="text-[11px] text-text-3 mt-0.5">Master Services Agreement · 47 pages · PDF</p>
                </div>
              </div>
              <button className="mt-2.5 w-full py-1.5 border border-border-dk rounded-[6px] text-xs font-medium text-text-2 hover:bg-border transition-colors">
                Change document
              </button>
            </div>
          </div>

          {/* Playbook */}
          <div>
            <p className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-2.5">Playbook</p>
            <select className="w-full px-3 py-2.5 border border-border-dk rounded-[8px] text-sm text-text bg-white focus:outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/10 appearance-none cursor-pointer"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
              <option>Standard MSA Playbook v2</option>
              <option>SaaS Agreement Template</option>
              <option>Enterprise NDA Playbook</option>
              <option>Employment Contract Audit</option>
            </select>
          </div>

          {/* Categories */}
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-2.5">Categories</p>
            <div className="divide-y divide-border">
              {(categories ?? mockClauseCategories).map((cat) => {
                const catCount = cat.clauses.length
                return (
                  <label key={cat.id} className="flex items-center gap-2.5 py-2 cursor-pointer group">
                    <input type="checkbox" defaultChecked className="w-3.5 h-3.5 accent-indigo rounded flex-shrink-0" />
                    <span className="text-sm text-text flex-1 group-hover:text-indigo transition-colors">{cat.name}</span>
                    <span className="text-[11px] font-medium text-text-3 bg-border px-1.5 py-0.5 rounded-pill">{catCount}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Re-run button */}
          <button className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-indigo rounded-[8px] hover:bg-indigo-dk transition-colors">
            <RotateCw size={14} /> Re-run Audit
          </button>
        </div>

        {/* Main — clause results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Coverage summary */}
          <div className="flex items-center gap-5 px-6 py-4 border-b border-border bg-white flex-shrink-0">
            <div className="flex items-baseline gap-2 flex-shrink-0">
              <span className="text-[36px] font-bold text-indigo leading-none tracking-tight">{coveragePct}%</span>
              <span className="text-sm text-text-3">playbook coverage</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-text-3 mb-1.5">{summary.present} of {summary.total} clauses satisfied</p>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-indigo rounded-full" style={{ width: `${coveragePct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-success-lt text-success text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />{summary.present} Present
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-danger-lt text-danger text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-danger" />{summary.missing} Missing
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-warning-lt text-warning text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />{summary.partial} Partial
              </span>
            </div>
            <button className="px-3 py-1.5 border border-border-dk rounded-[7px] text-xs font-medium text-text-2 hover:bg-surface transition-colors flex-shrink-0">
              History
            </button>
          </div>

          {/* Clause categories */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {(categories ?? mockClauseCategories).map((cat) => {
              const isExpanded = expandedCategories.has(cat.id)
              const missing = cat.clauses.filter((c) => c.status === 'missing').length
              const present = cat.clauses.filter((c) => c.status === 'present').length
              const partial = cat.clauses.filter((c) => c.status === 'partial').length

              return (
                <div key={cat.id} className="mt-5">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="w-full flex items-center gap-2 py-2 border-b border-border mb-1 text-left"
                  >
                    <ChevronRight
                      size={14}
                      className={cn('text-text-3 transition-transform', isExpanded && 'rotate-90')}
                    />
                    <span className="text-sm font-semibold text-text flex-1">{cat.name}</span>
                    <div className="flex items-center gap-1.5">
                      {present > 0 && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-pill bg-success-lt text-success">{present} Present</span>}
                      {missing > 0 && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-pill bg-danger-lt text-danger">{missing} Missing</span>}
                      {partial > 0 && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-pill bg-warning-lt text-warning">{partial} Partial</span>}
                    </div>
                  </button>

                  {/* Clauses */}
                  {isExpanded && (
                    <div>
                      {cat.clauses.map((clause) => {
                        const st = statusConfig[clause.status]
                        const isClauseExpanded = expandedClause === clause.id
                        const isMissing = clause.status === 'missing'
                        const isPartial = clause.status === 'partial'

                        return (
                          <div key={clause.id}>
                            <div
                              onClick={() => {
                                if (isMissing) setExpandedClause(isClauseExpanded ? null : clause.id)
                              }}
                              className={cn(
                                'flex items-center gap-3 px-2.5 py-2 rounded-[8px] mb-0.5 transition-colors',
                                isMissing ? 'cursor-pointer hover:bg-danger-lt/40' : 'cursor-default hover:bg-surface',
                                isClauseExpanded && isMissing && 'bg-danger-lt/30'
                              )}
                            >
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ backgroundColor: st.bg, color: st.color }}
                              >
                                {st.icon}
                              </span>
                              <span className="text-sm text-text flex-1">{clause.name}</span>
                              {clause.risk && (
                                <span
                                  className="text-xs font-semibold px-2 py-0.5 rounded-pill"
                                  style={{ backgroundColor: riskConfig[clause.risk].bg, color: riskConfig[clause.risk].color }}
                                >
                                  {riskConfig[clause.risk].label}
                                </span>
                              )}
                              {isMissing && (
                                <ChevronRight
                                  size={14}
                                  className={cn('text-text-3 transition-transform', isClauseExpanded && 'rotate-90')}
                                />
                              )}
                            </div>

                            {/* Partial note */}
                            {isPartial && (
                              <p className="text-[11.5px] text-text-3 pl-[42px] pb-1.5">
                                Clause exists but does not fully satisfy playbook requirements.
                              </p>
                            )}

                            {/* Expanded missing clause */}
                            {isClauseExpanded && isMissing && clause.suggestedText && (
                              <div className="mx-2.5 mb-2.5 border border-danger rounded-[10px] overflow-hidden">
                                {/* Red header */}
                                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-danger-lt">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-danger flex-shrink-0">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                    <line x1="12" y1="9" x2="12" y2="13"/>
                                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                                  </svg>
                                  <span className="text-sm font-semibold text-danger flex-1">{clause.name} — Missing</span>
                                  {clause.risk && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-pill bg-danger text-white">
                                      {riskConfig[clause.risk].label}
                                    </span>
                                  )}
                                </div>
                                {/* Body */}
                                <div className="p-3.5 bg-white space-y-3">
                                  {/* Risk callout */}
                                  <div className="flex items-start gap-2.5 p-3 bg-warning-lt border border-warning/30 rounded-[8px]">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5">
                                      <circle cx="12" cy="12" r="10"/>
                                      <line x1="12" y1="8" x2="12" y2="12"/>
                                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                                    </svg>
                                    <p className="text-xs leading-relaxed" style={{ color: '#92400E' }}>
                                      Without this clause, deliverables created under this agreement may not automatically vest as client property. The vendor could retain IP rights over custom-developed work, creating significant ownership risk.
                                    </p>
                                  </div>

                                  {/* Suggested text */}
                                  <div>
                                    <p className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1.5">AI-Suggested Language</p>
                                    <div className="p-3.5 bg-surface border border-border rounded-[7px]">
                                      <p className="font-mono text-xs text-text-2 leading-relaxed">{clause.suggestedText}</p>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-2">
                                    <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo text-white text-xs font-semibold rounded-[7px] hover:bg-indigo-dk transition-colors">
                                      <Plus size={12} /> Insert
                                    </button>
                                    <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-border-dk text-xs font-medium text-text-2 rounded-[7px] hover:bg-surface transition-colors">
                                      <Edit3 size={12} /> Edit
                                    </button>
                                    <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-border-dk text-xs font-medium text-text-2 rounded-[7px] hover:bg-surface transition-colors">
                                      <Copy size={12} /> Copy
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
