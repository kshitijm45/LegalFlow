import { useState } from 'react'
import { Download, FileText, Loader2, Sparkles, Check, ChevronDown, ChevronUp, ArrowUpDown, RefreshCw } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { useContracts, formatFileSize } from '@/hooks/useVault'
import { useGenerateTimeline } from '@/hooks/useTimeline'
import type { TimelineEventDTO } from '@/hooks/useTimeline'

type SortKey = 'date' | 'type' | 'status' | 'document'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'overdue' | 'upcoming' | 'completed'
type TypeFilter = 'all' | 'deadline' | 'payment' | 'renewal' | 'milestone' | 'review' | 'start'

const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
  start:     { label: 'Start',     color: '#059669', bg: '#D1FAE5' },
  milestone: { label: 'Milestone', color: '#4338CA', bg: '#EEF2FF' },
  deadline:  { label: 'Deadline',  color: '#DC2626', bg: '#FEE2E2' },
  renewal:   { label: 'Renewal',   color: '#D97706', bg: '#FEF3C7' },
  payment:   { label: 'Payment',   color: '#059669', bg: '#D1FAE5' },
  review:    { label: 'Review',    color: '#475569', bg: '#F1F5F9' },
}

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  upcoming:  { label: 'Upcoming',  color: '#4338CA', bg: '#EEF2FF',  dot: '#4338CA' },
  completed: { label: 'Completed', color: '#059669', bg: '#D1FAE5',  dot: '#059669' },
  overdue:   { label: 'Overdue',   color: '#DC2626', bg: '#FEE2E2',  dot: '#DC2626' },
}

function getToday() {
  return new Date()
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function daysAway(dateStr: string) {
  const today = getToday()
  today.setHours(0, 0, 0, 0)
  const ev = parseLocalDate(dateStr)
  const diff = Math.round((ev.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  return diff < 0 ? `${Math.abs(diff)}d ago` : `${diff}d away`
}

function formatEventDate(dateStr: string) {
  return parseLocalDate(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function exportCSV(events: TimelineEventDTO[]) {
  const headers = ['Date', 'Title', 'Type', 'Status', 'Document', 'Section', 'Amount', 'Description', 'Source Clause']
  const rows = events.map((e) => [
    e.date,
    e.title,
    e.type,
    e.status,
    e.documentName,
    e.section ?? '',
    e.amount ?? '',
    e.description,
    e.sourceClause ?? '',
  ])
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `timeline-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: TimelineEventDTO }) {
  const [expanded, setExpanded] = useState(false)
  const cfg   = typeConfig[event.type]   ?? typeConfig.milestone
  const scfg  = statusConfig[event.status] ?? statusConfig.upcoming
  const isPast = parseLocalDate(event.date) < getToday()

  return (
    <>
      <tr
        className="border-b border-border hover:bg-[#F8FAFC] cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Date */}
        <td className="px-5 py-3.5 whitespace-nowrap">
          <p className="text-[13px] font-semibold text-text">{formatEventDate(event.date)}</p>
          <p className={`text-[11px] mt-0.5 font-medium ${isPast ? 'text-text-3' : 'text-indigo'}`}>
            {daysAway(event.date)}
          </p>
        </td>

        {/* Event */}
        <td className="px-5 py-3.5">
          <p className="text-[13px] font-semibold text-text">{event.title}</p>
          {event.amount && (
            <p className="text-[11.5px] font-bold mt-0.5" style={{ color: cfg.color }}>{event.amount}</p>
          )}
        </td>

        {/* Type */}
        <td className="px-5 py-3.5">
          <span
            className="inline-flex px-2.5 py-[3px] rounded-[5px] text-[11.5px] font-semibold whitespace-nowrap"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </td>

        {/* Document */}
        <td className="px-5 py-3.5 max-w-[200px]">
          <p className="text-[12.5px] text-text-2 truncate">{event.documentName}</p>
          {event.section && (
            <p className="text-[11px] text-text-3 mt-0.5 truncate">{event.section}</p>
          )}
        </td>

        {/* Status */}
        <td className="px-5 py-3.5">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-[5px] text-[11.5px] font-semibold whitespace-nowrap"
            style={{ background: scfg.bg, color: scfg.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: scfg.dot }} />
            {scfg.label}
          </span>
        </td>

        {/* Expand toggle */}
        <td className="px-5 py-3.5 text-right">
          {expanded
            ? <ChevronUp size={14} className="text-text-3 ml-auto" />
            : <ChevronDown size={14} className="text-text-3 ml-auto" />
          }
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-[#F8FAFC] border-b border-border">
          <td colSpan={6} className="px-5 py-4">
            <div className="flex gap-8">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-text-3 uppercase tracking-[0.6px] mb-1.5">Description</p>
                <p className="text-[13px] text-text-2 leading-relaxed">{event.description}</p>
              </div>
              {event.sourceClause && (
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-text-3 uppercase tracking-[0.6px] mb-1.5">Source Clause</p>
                  <div className="bg-white border border-border border-l-[3px] border-l-indigo rounded-[8px] px-3 py-2.5">
                    <p className="text-[12.5px] text-text-2 leading-relaxed font-mono">{event.sourceClause}</p>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortTh({
  label, sortKey, active, dir, onSort,
}: {
  label: string; sortKey: SortKey; active: boolean; dir: SortDir; onSort: (k: SortKey) => void
}) {
  return (
    <th
      className="px-5 py-3 text-left text-[11px] font-bold text-text-3 uppercase tracking-[0.6px] cursor-pointer select-none hover:text-text-2 whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        {active
          ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
          : <ArrowUpDown size={10} className="opacity-40" />
        }
      </span>
    </th>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TimelinePage() {
  const { data: contractsData } = useContracts({ status_filter: 'ready' })
  const contracts = contractsData?.contracts ?? []

  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [events, setEvents]             = useState<TimelineEventDTO[]>([])
  const [pickerOpen, setPickerOpen]     = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [sortKey, setSortKey]           = useState<SortKey>('date')
  const [sortDir, setSortDir]           = useState<SortDir>('asc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('all')

  const generateTimeline = useGenerateTimeline()

  function toggleContract(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleGenerate() {
    if (selectedIds.size === 0) return
    setPickerOpen(false)
    setEvents([])
    setHasGenerated(false)
    setStatusFilter('all')
    setTypeFilter('all')
    generateTimeline.mutate({ contractIds: [...selectedIds] }, {
      onSuccess: (d) => {
        setEvents(d.events)
        setHasGenerated(true)
      },
    })
  }

  function handleRegenerate() {
    if (selectedIds.size === 0) return
    setEvents([])
    setHasGenerated(false)
    setStatusFilter('all')
    setTypeFilter('all')
    generateTimeline.mutate({ contractIds: [...selectedIds], forceRegenerate: true }, {
      onSuccess: (d) => {
        setEvents(d.events)
        setHasGenerated(true)
      },
    })
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleStatusFilter(f: StatusFilter) {
    setStatusFilter((prev) => (prev === f ? 'all' : f))
  }

  const isGenerating      = generateTimeline.isPending
  const selectedContracts = contracts.filter((c) => selectedIds.has(c.id))

  const sorted = [...events]
    .filter((e) => statusFilter === 'all' || e.status === statusFilter)
    .filter((e) => typeFilter === 'all' || e.type === typeFilter)
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date')     cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (sortKey === 'type')     cmp = a.type.localeCompare(b.type)
      if (sortKey === 'status')   cmp = a.status.localeCompare(b.status)
      if (sortKey === 'document') cmp = a.documentName.localeCompare(b.documentName)
      return sortDir === 'asc' ? cmp : -cmp
    })

  const overdue   = events.filter((e) => e.status === 'overdue').length
  const upcoming  = events.filter((e) => e.status === 'upcoming').length
  const completed = events.filter((e) => e.status === 'completed').length

  const typeFilters: { key: TypeFilter; label: string }[] = [
    { key: 'all',       label: 'All Types' },
    { key: 'deadline',  label: 'Deadline' },
    { key: 'payment',   label: 'Payment' },
    { key: 'renewal',   label: 'Renewal' },
    { key: 'milestone', label: 'Milestone' },
    { key: 'review',    label: 'Review' },
    { key: 'start',     label: 'Start' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        breadcrumb={[{ label: 'AI Tools' }, { label: 'Timeline Generator' }]}
        actions={
          <div className="flex items-center gap-2">
            {hasGenerated && events.length > 0 && (
              <button
                className="flex items-center gap-1.5 px-3 py-[7px] text-[13px] font-medium text-text-2 border border-border-dk rounded-[7px] bg-white hover:bg-[#F8FAFC] transition-colors disabled:opacity-40"
                disabled={isGenerating || selectedIds.size === 0}
                onClick={handleRegenerate}
                title="Re-run AI extraction, ignoring cached results"
              >
                <RefreshCw size={13} className={isGenerating ? 'animate-spin' : ''} /> Regenerate
              </button>
            )}
            <button
              className="flex items-center gap-1.5 px-3 py-[7px] text-[13px] font-medium text-text-2 border border-border-dk rounded-[7px] bg-white hover:bg-[#F8FAFC] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={events.length === 0}
              onClick={() => exportCSV(events)}
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        }
      />

      {/* Document selector bar */}
      <div className="flex items-center gap-3 mx-7 mt-4 mb-4 px-4 py-[10px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] flex-shrink-0">
        <div className="w-8 h-8 bg-indigo-lt border border-indigo-mid rounded-[7px] flex items-center justify-center flex-shrink-0">
          <FileText size={14} className="text-indigo" />
        </div>

        <div className="flex-1 min-w-0 relative">
          {contracts.length === 0 ? (
            <p className="text-[13px] text-text-3">No processed contracts yet — upload one in The Vault first.</p>
          ) : (
            <>
              <button
                className="flex items-center gap-2 text-left"
                onClick={() => setPickerOpen((o) => !o)}
              >
                {selectedIds.size === 0 ? (
                  <span className="text-[13px] text-text-3">Select contracts to analyse…</span>
                ) : (
                  <span className="text-[13px] font-semibold text-text">
                    {selectedIds.size === 1
                      ? selectedContracts[0]?.name ?? '1 contract'
                      : `${selectedIds.size} contracts selected`}
                  </span>
                )}
                <span className="text-[11px] text-indigo font-medium underline underline-offset-2">
                  {pickerOpen ? 'Done' : 'Change'}
                </span>
              </button>
              {selectedIds.size > 1 && !pickerOpen && (
                <p className="text-[11.5px] text-text-3 mt-0.5">{selectedContracts.map((c) => c.name).join(' · ')}</p>
              )}

              {pickerOpen && (
                <div className="absolute top-full left-0 mt-2 w-[420px] bg-white border border-[#E2E8F0] rounded-[10px] shadow-lg z-20 py-1.5 max-h-[280px] overflow-y-auto">
                  {contracts.map((c) => {
                    const checked = selectedIds.has(c.id)
                    return (
                      <button
                        key={c.id}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[#F8FAFC] transition-colors ${checked ? 'bg-indigo-lt' : ''}`}
                        onClick={() => toggleContract(c.id)}
                      >
                        <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-indigo border-indigo' : 'border-border-dk bg-white'}`}>
                          {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <FileText size={13} className={checked ? 'text-indigo flex-shrink-0' : 'text-text-3 flex-shrink-0'} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-medium truncate ${checked ? 'text-indigo' : 'text-text'}`}>{c.name}</p>
                          <p className="text-[11px] text-text-3">{formatFileSize(c.file_size)} · {c.contract_type ?? 'Unknown type'}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <button
          className="flex items-center gap-1.5 px-4 py-[7px] text-[13px] font-semibold rounded-[7px] transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed bg-indigo text-white hover:bg-indigo-dk"
          disabled={selectedIds.size === 0 || isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating
            ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
            : <><Sparkles size={13} /> Generate Timeline</>
          }
        </button>
      </div>

      {pickerOpen && <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />}

      {/* Summary chips + type filter (shown after generation) */}
      {hasGenerated && events.length > 0 && (
        <div className="flex items-center justify-between px-7 mb-3 flex-shrink-0 flex-wrap gap-2">
          {/* Status filter chips */}
          <div className="flex items-center gap-2">
            <button
              className={`inline-flex items-center gap-1.5 px-3 py-[5px] rounded-[100px] text-[12px] font-semibold border transition-colors ${statusFilter === 'all' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-text-2 border-border hover:border-border-dk'}`}
              onClick={() => setStatusFilter('all')}
            >
              {events.length} events
            </button>
            {overdue > 0 && (
              <button
                className={`inline-flex items-center gap-1.5 px-3 py-[5px] rounded-[100px] text-[12px] font-semibold border transition-colors ${statusFilter === 'overdue' ? 'bg-danger text-white border-danger' : 'bg-white text-danger border-danger/30 hover:border-danger/60'}`}
                onClick={() => toggleStatusFilter('overdue')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />{overdue} overdue
              </button>
            )}
            {upcoming > 0 && (
              <button
                className={`inline-flex items-center gap-1.5 px-3 py-[5px] rounded-[100px] text-[12px] font-semibold border transition-colors ${statusFilter === 'upcoming' ? 'bg-indigo text-white border-indigo' : 'bg-white text-indigo border-indigo/30 hover:border-indigo/60'}`}
                onClick={() => toggleStatusFilter('upcoming')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />{upcoming} upcoming
              </button>
            )}
            {completed > 0 && (
              <button
                className={`inline-flex items-center gap-1.5 px-3 py-[5px] rounded-[100px] text-[12px] font-semibold border transition-colors ${statusFilter === 'completed' ? 'bg-success text-white border-success' : 'bg-white text-success border-success/30 hover:border-success/60'}`}
                onClick={() => toggleStatusFilter('completed')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />{completed} completed
              </button>
            )}
          </div>

          {/* Type filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {typeFilters.map(({ key, label }) => {
              const cfg = key !== 'all' ? typeConfig[key] : null
              const isActive = typeFilter === key
              return (
                <button
                  key={key}
                  className={`px-2.5 py-[4px] rounded-[5px] text-[11.5px] font-semibold border transition-colors ${
                    isActive
                      ? cfg
                        ? ''
                        : 'bg-[#0F172A] text-white border-[#0F172A]'
                      : 'bg-white text-text-3 border-border hover:border-border-dk hover:text-text-2'
                  }`}
                  style={isActive && cfg ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color + '40' } : undefined}
                  onClick={() => setTypeFilter((prev) => (prev === key ? 'all' : key))}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto mx-7 mb-7 border border-border rounded-[10px] bg-white">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-3 h-full">
            <Loader2 size={28} className="text-indigo animate-spin" />
            <p className="text-[13px] text-text-2">
              Extracting events from {selectedIds.size} document{selectedIds.size > 1 ? 's' : ''}…
            </p>
          </div>
        ) : !hasGenerated ? (
          <div className="flex flex-col items-center justify-center gap-3 h-full">
            <div className="w-10 h-10 bg-indigo-lt rounded-[10px] flex items-center justify-center">
              <Sparkles size={20} className="text-indigo" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-semibold text-text-2">No timeline generated yet</p>
              <p className="text-[13px] text-text-3 mt-1">Select one or more documents above and click Generate Timeline</p>
            </div>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 h-full">
            <p className="text-[14px] font-semibold text-text-2">No events match the current filters</p>
            <button
              className="text-[13px] text-indigo underline underline-offset-2"
              onClick={() => { setStatusFilter('all'); setTypeFilter('all') }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#F8FAFC] border-b border-border z-10">
              <tr>
                <SortTh label="Date"     sortKey="date"     active={sortKey === 'date'}     dir={sortDir} onSort={handleSort} />
                <th className="px-5 py-3 text-left text-[11px] font-bold text-text-3 uppercase tracking-[0.6px]">Event</th>
                <SortTh label="Type"     sortKey="type"     active={sortKey === 'type'}     dir={sortDir} onSort={handleSort} />
                <SortTh label="Document" sortKey="document" active={sortKey === 'document'} dir={sortDir} onSort={handleSort} />
                <SortTh label="Status"   sortKey="status"   active={sortKey === 'status'}   dir={sortDir} onSort={handleSort} />
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
