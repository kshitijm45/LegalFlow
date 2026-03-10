import { useState } from 'react'
import { Search, CheckCircle, Bell, Plus, Download, Mail } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useObligations, useObligationStats } from '@/hooks/useMockQuery'
import { cn, formatDate, formatRelativeDate } from '@/lib/utils'
import type { Obligation } from '@/types'

type FilterTab = 'Overdue' | 'All' | 'Pending' | 'Done'

const categoryColors: Record<string, string> = {
  Compliance: '#4338CA',
  Payment: '#059669',
  Reporting: '#D97706',
  Renewal: '#7C3AED',
  Delivery: '#0369A1',
  Review: '#475569',
}

function ReminderToggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn('relative rounded-full transition-colors flex-shrink-0', enabled ? 'bg-indigo' : 'bg-border')}
      style={{ width: 40, height: 22 }}
    >
      <span
        className={cn('absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform', enabled && 'translate-x-[18px]')}
      />
    </button>
  )
}

export function ObligationsPage() {
  const { data: obligations, isLoading } = useObligations()
  const { data: stats } = useObligationStats()
  const [filter, setFilter] = useState<FilterTab>('All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Obligation | null>(null)

  if (isLoading) return (
    <div className="flex-1 flex flex-col">
      <Topbar breadcrumb={[{ label: 'Obligations' }]} />
      <PageLoader />
    </div>
  )

  const filtered = (obligations ?? []).filter((ob) => {
    const matchesSearch = ob.title.toLowerCase().includes(search.toLowerCase()) ||
      ob.documentName.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Overdue' && ob.status === 'overdue') ||
      (filter === 'Pending' && ob.status === 'pending') ||
      (filter === 'Done' && ob.status === 'completed')
    return matchesSearch && matchesFilter
  })

  const overdue = filtered.filter((o) => o.status === 'overdue')
  const dueThisWeek = filtered.filter((o) => {
    if (o.status !== 'pending') return false
    const due = new Date(o.dueDate)
    const now = new Date()
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return due >= now && due <= week
  })
  const upcoming = filtered.filter((o) => {
    if (o.status !== 'pending') return false
    const due = new Date(o.dueDate)
    const now = new Date()
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return due > week
  })
  const completed = filtered.filter((o) => o.status === 'completed')

  const selectedOb = selected ?? filtered[0] ?? null

  function ObRow({ ob }: { ob: Obligation }) {
    const isSelected = selectedOb?.id === ob.id
    return (
      <div
        onClick={() => setSelected(ob)}
        className={cn(
          'flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface transition-colors',
          isSelected && 'bg-indigo-lt border-r-2 border-indigo'
        )}
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
          style={{ backgroundColor: ob.status === 'overdue' ? '#DC2626' : ob.status === 'pending' ? '#D97706' : '#059669' }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text truncate">{ob.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: categoryColors[ob.category] ? `${categoryColors[ob.category]}20` : '#EEF2FF',
                color: categoryColors[ob.category] ?? '#4338CA',
              }}
            >
              {ob.category}
            </span>
            <span className="text-[11px] text-text-3 truncate">{ob.documentName}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={cn('text-xs font-medium', ob.status === 'overdue' ? 'text-danger' : 'text-text-2')}>
            {ob.status === 'completed' ? formatDate(ob.dueDate) : formatRelativeDate(ob.dueDate)}
          </p>
          <StatusBadge status={ob.status} className="mt-1" />
        </div>
      </div>
    )
  }

  function ObGroup({ title, items, color }: { title: string; items: Obligation[]; color: string }) {
    if (items.length === 0) return null
    return (
      <div>
        <div className="px-4 py-2 bg-surface border-y border-border">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
            {title} ({items.length})
          </p>
        </div>
        {items.map((ob) => <ObRow key={ob.id} ob={ob} />)}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        breadcrumb={[{ label: 'Obligations' }]}
        actions={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-2 border border-border rounded-[8px] hover:bg-surface transition-colors">
              <Download size={14} /> Export
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-indigo rounded-[8px] hover:bg-indigo-dk transition-colors">
              <Plus size={14} /> Add Obligation
            </button>
          </div>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-0 border-b border-border bg-white flex-shrink-0">
        {[
          { label: 'Total Active', value: stats?.total ?? 24, color: 'text-text', sub: 'across 9 contracts' },
          { label: 'Overdue', value: stats?.overdue ?? 3, color: 'text-danger', sub: 'Requires immediate action', delta: '↑ 1 this week', deltaUp: true },
          { label: 'Due This Week', value: stats?.dueThisWeek ?? 7, color: 'text-warning', sub: 'Next: Mar 5, 2026' },
          { label: 'Completed This Month', value: 11, color: 'text-success', sub: 'Feb 2026', delta: '↑ 3 vs. last month', deltaUp: true },
        ].map((s, i) => (
          <div key={s.label} className={cn('px-6 py-4', i > 0 && 'border-l border-border')}>
            <p className="text-xs text-text-3 mb-1">{s.label}</p>
            <div className="flex items-baseline gap-2 mb-0.5">
              <p className={`text-[28px] font-semibold leading-none ${s.color}`}>{s.value}</p>
              {s.delta && (
                <span className={cn('text-xs font-medium', s.deltaUp ? 'text-success' : 'text-danger')}>{s.delta}</span>
              )}
            </div>
            <p className="text-[11px] text-text-3">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left — list */}
        <div className="w-[420px] flex-shrink-0 flex flex-col overflow-hidden border-r border-border bg-white">
          {/* Search + filter */}
          <div className="p-3 border-b border-border space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search obligations…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
                />
              </div>
              <select className="text-xs border border-border rounded-[7px] px-2.5 py-2 bg-white text-text-2 focus:outline-none focus:border-indigo cursor-pointer">
                <option>All Contracts</option>
                <option>Tata Digital MSA</option>
                <option>Zepto Technologies NDA</option>
                <option>Razorpay SaaS</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              {(['Overdue', 'All', 'Pending', 'Done'] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-[6px] transition-colors',
                    filter === tab
                      ? tab === 'Overdue' ? 'bg-danger text-white' : 'bg-indigo text-white'
                      : tab === 'Overdue' ? 'text-danger hover:bg-danger-lt' : 'text-text-3 hover:bg-surface'
                  )}
                >
                  {tab}
                  {tab === 'Overdue' && (stats?.overdue ?? 0) > 0 && (
                    <span className={cn('text-[10px] font-bold px-1 rounded', filter === tab ? 'text-white/80' : 'text-danger')}>
                      {stats?.overdue ?? 3}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            <ObGroup title="Overdue" items={overdue} color="#DC2626" />
            <ObGroup title="Due This Week" items={dueThisWeek} color="#D97706" />
            <ObGroup title="Upcoming" items={upcoming} color="#4338CA" />
            <ObGroup title="Completed" items={completed} color="#059669" />
            {filtered.length === 0 && (
              <div className="py-16 text-center">
                <CheckCircle size={28} className="text-border mx-auto mb-2" />
                <p className="text-sm text-text-3">No obligations found</p>
              </div>
            )}
          </div>
        </div>

        {/* Right — detail */}
        {selectedOb ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: categoryColors[selectedOb.category] ? `${categoryColors[selectedOb.category]}20` : '#EEF2FF',
                    color: categoryColors[selectedOb.category] ?? '#4338CA',
                  }}
                >
                  {selectedOb.category}
                </span>
                <span className="text-sm text-text-3">·</span>
                <span className="text-sm text-text-3">{selectedOb.documentName}</span>
              </div>
              <h2 className="text-xl font-semibold text-text">{selectedOb.title}</h2>
              <div className="flex items-center gap-1.5 mt-1.5 text-sm text-text-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span className="text-indigo font-medium text-xs truncate">{selectedOb.documentName}</span>
                <span>·</span>
                <span className="text-xs">{selectedOb.section}</span>
              </div>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Due Date', value: formatDate(selectedOb.dueDate), color: selectedOb.status === 'overdue' ? 'text-danger' : 'text-text' },
                { label: 'Status', value: selectedOb.status.charAt(0).toUpperCase() + selectedOb.status.slice(1), color: selectedOb.status === 'overdue' ? 'text-danger' : 'text-text' },
                { label: 'Assignee', value: selectedOb.assignee, color: 'text-text' },
                { label: 'Counterparty', value: selectedOb.counterparty, color: 'text-text' },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-4 bg-surface border border-border rounded-[8px]">
                  <p className="text-xs text-text-3 mb-1">{label}</p>
                  <p className={cn('text-sm font-semibold', color)}>{value}</p>
                </div>
              ))}
            </div>

            {/* Source clause */}
            <div>
              <p className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-2">Source Clause</p>
              <div className="border border-border rounded-[8px] overflow-hidden">
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-surface border-b border-border">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-indigo flex-shrink-0">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span className="text-xs font-semibold text-text-2 flex-1">{selectedOb.section}</span>
                  <span className="text-[11px] text-text-3">{selectedOb.documentName}</span>
                </div>
                <div className="p-4 bg-white">
                  <p className="font-mono text-xs text-text-2 leading-relaxed">{selectedOb.sourceClause}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-success text-white text-sm font-semibold rounded-[8px] hover:bg-success/90 transition-colors">
                <CheckCircle size={14} /> Mark Complete
              </button>
              <button className="px-4 py-2 border border-border text-sm font-medium text-text-2 rounded-[8px] hover:bg-surface transition-colors">
                Reassign
              </button>
              <button className="px-4 py-2 border border-border text-sm font-medium text-text-2 rounded-[8px] hover:bg-surface transition-colors">
                Edit
              </button>
            </div>

            {/* Reminders */}
            <div className="border border-border rounded-[9px] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
                <div className="flex items-center gap-2">
                  <Bell size={14} className="text-text-2" />
                  <p className="text-sm font-semibold text-text">Reminders</p>
                </div>
                <button className="flex items-center gap-1 text-xs text-indigo font-medium hover:underline">
                  <Plus size={12} /> Add Reminder
                </button>
              </div>

              <div className="divide-y divide-border bg-white">
                {selectedOb.reminders.map((reminder) => (
                  <div key={reminder.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-8 h-8 rounded-[7px] flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: reminder.type === 'email' ? '#EEF2FF' : '#EDE9FE' }}
                    >
                      {reminder.type === 'email' ? (
                        <Mail size={14} className="text-indigo" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" style={{ color: '#7C3AED' }}>
                          <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/>
                          <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                          <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/>
                          <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/>
                          <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/>
                          <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
                          <path d="M10 9.5C10 8.67 9.33 8 8.5 8H3.5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/>
                          <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text">
                        {reminder.type === 'email' ? 'Email' : 'Slack'} · {reminder.timing}
                      </p>
                      <p className="text-xs text-text-3 truncate">{reminder.recipient}</p>
                    </div>
                    <ReminderToggle enabled={reminder.enabled} onChange={() => {}} />
                    <button className="text-xs text-text-3 font-medium hover:text-indigo transition-colors px-2 py-1 hover:bg-surface rounded ml-1">
                      Edit
                    </button>
                  </div>
                ))}
                {selectedOb.reminders.length === 0 && (
                  <p className="text-sm text-text-3 p-4">No reminders set</p>
                )}
              </div>
            </div>

            {/* Activity */}
            {selectedOb.activity.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-3">Activity</p>
                <div className="space-y-2">
                  {selectedOb.activity.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-border mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-text-2">{entry.text}</p>
                        <p className="text-[11px] text-text-3 mt-0.5">{new Date(entry.timestamp).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-surface">
            <div className="text-center">
              <Bell size={32} className="text-border mx-auto mb-3" />
              <p className="text-sm text-text-3">Select an obligation to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
