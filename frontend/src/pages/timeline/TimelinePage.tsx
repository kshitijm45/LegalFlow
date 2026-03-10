import { useState, useRef } from 'react'
import { Upload, Download, Share2 } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { useTimelineEvents } from '@/hooks/useMockQuery'
import type { TimelineEvent } from '@/types'

const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
  start:     { label: 'Start',     color: '#059669', bg: '#D1FAE5' },
  milestone: { label: 'Milestone', color: '#4338CA', bg: '#EEF2FF' },
  deadline:  { label: 'Deadline',  color: '#DC2626', bg: '#FEE2E2' },
  renewal:   { label: 'Renewal',   color: '#D97706', bg: '#FEF3C7' },
  payment:   { label: 'Payment',   color: '#059669', bg: '#D1FAE5' },
  review:    { label: 'Review',    color: '#475569', bg: '#F1F5F9' },
}

const MONTH_W = 110
const PAD = 60
const AXIS_Y = 240
const CANVAS_H = 560
const CONNECTOR_H = 40
const CARD_W = 148

function dateToX(date: string, minDate: Date): number {
  const d = new Date(date)
  const msPerMonth = 1000 * 60 * 60 * 24 * 30.44
  return PAD + ((d.getTime() - minDate.getTime()) / msPerMonth) * MONTH_W
}

function getMonths(minDate: Date, maxDate: Date): { label: string; x: number }[] {
  const months: { label: string; x: number }[] = []
  const d = new Date(minDate)
  d.setDate(1)
  while (d <= maxDate) {
    months.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      x: dateToX(d.toISOString(), minDate),
    })
    d.setMonth(d.getMonth() + 1)
  }
  return months
}

interface CardProps {
  event: TimelineEvent
  x: number
  above: boolean
  selected: boolean
  onClick: () => void
}

function EventCard({ event, x, above, selected, onClick }: CardProps) {
  const cfg = typeConfig[event.type] ?? typeConfig.milestone
  const left = x - CARD_W / 2

  const card = (
    <div
      className="w-full rounded-[9px] border bg-white p-3 cursor-pointer"
      style={{
        borderColor: selected ? cfg.color : '#E2E8F0',
        boxShadow: selected ? `0 0 0 2px ${cfg.color}25` : '0 1px 3px rgba(0,0,0,0.06)',
        width: CARD_W,
      }}
      onClick={onClick}
    >
      <p className="text-[10.5px] font-semibold text-[#94A3B8] uppercase tracking-[0.3px] mb-1.5">
        {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
      </p>
      <p className="text-[12px] font-semibold text-[#0F172A] leading-snug mb-1.5">{event.title}</p>
      {event.amount && (
        <p className="text-[11px] font-bold mb-1.5" style={{ color: cfg.color }}>{event.amount}</p>
      )}
      <span
        className="inline-flex px-[7px] py-[2px] rounded-[4px] text-[10.5px] font-semibold"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        {cfg.label}
      </span>
    </div>
  )

  const dot = (
    <div
      className="w-3 h-3 rounded-[3px] border-2 border-white flex-shrink-0"
      style={{ backgroundColor: cfg.color }}
    />
  )

  const connector = (
    <div className="w-[2px] flex-shrink-0" style={{ height: CONNECTOR_H, backgroundColor: selected ? cfg.color : '#CBD5E1' }} />
  )

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left,
        width: CARD_W,
        ...(above
          ? { bottom: CANVAS_H - AXIS_Y, flexDirection: 'column-reverse' }
          : { top: AXIS_Y }),
      }}
    >
      {above ? (
        <>{dot}{connector}{card}</>
      ) : (
        <>{dot}{connector}{card}</>
      )}
    </div>
  )
}

export function TimelinePage() {
  const { data: events, isLoading } = useTimelineEvents()
  const [selected, setSelected] = useState<TimelineEvent | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  if (isLoading) return (
    <div className="flex-1 flex flex-col">
      <Topbar breadcrumb={[{ label: 'AI Tools' }, { label: 'Timeline Generator' }]} />
      <PageLoader />
    </div>
  )

  const sorted = [...(events ?? [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const selectedEvent = selected ?? sorted.find(e => e.type === 'deadline') ?? sorted[0] ?? null

  const minDate = sorted.length ? new Date(sorted[0].date) : new Date('2025-01-01')
  const maxDate = sorted.length ? new Date(sorted[sorted.length - 1].date) : new Date('2026-02-01')
  minDate.setDate(1)
  minDate.setMonth(minDate.getMonth() - 1)
  const maxDateCopy = new Date(maxDate)
  maxDateCopy.setDate(1)
  maxDateCopy.setMonth(maxDateCopy.getMonth() + 2)

  const msPerMonth = 1000 * 60 * 60 * 24 * 30.44
  const canvasW = Math.max(1200, PAD * 2 + ((maxDateCopy.getTime() - minDate.getTime()) / msPerMonth) * MONTH_W)

  const todayX = dateToX(new Date().toISOString(), minDate)
  const months = getMonths(minDate, maxDateCopy)

  const today = new Date()
  function daysAway(date: string) {
    const diff = Math.round((new Date(date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'today'
    return diff < 0 ? `${Math.abs(diff)} days ago` : `${diff} days away`
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        breadcrumb={[{ label: 'AI Tools' }, { label: 'Timeline Generator' }]}
        actions={
          <div className="flex items-center gap-2.5">
            <button className="flex items-center gap-1.5 px-3 py-[7px] text-[13px] font-medium text-[#475569] border border-[#CBD5E1] rounded-[7px] bg-white hover:bg-[#F8FAFC] transition-colors">
              <Upload size={13} /> Upload document
            </button>
            <button className="flex items-center gap-1.5 px-3 py-[7px] text-[13px] font-medium text-[#475569] border border-[#CBD5E1] rounded-[7px] bg-white hover:bg-[#F8FAFC] transition-colors">
              <Download size={13} /> Export
            </button>
            <button className="flex items-center gap-1.5 px-3 py-[7px] text-[13px] font-semibold text-white bg-indigo rounded-[7px] hover:bg-indigo-dk transition-colors">
              <Share2 size={13} /> Share
            </button>
          </div>
        }
      />

      {/* Document bar */}
      <div className="flex items-center gap-3 mx-7 mt-5 mb-3 px-4 py-[10px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] flex-shrink-0">
        <div className="w-9 h-9 bg-indigo-lt border border-indigo-mid rounded-[8px] flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 18 18" fill="none" className="w-[18px] h-[18px]">
            <path d="M4 2h7l4 4v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="#4338CA" strokeWidth="1.3"/>
            <path d="M11 2v4h4" stroke="#4338CA" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M6 9h6M6 12h4" stroke="#4338CA" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-text">Tata Digital Ltd — Software License Agreement.pdf</p>
          <p className="text-[11.5px] text-text-3 mt-0.5">Uploaded just now · 2.4 MB · {sorted.length} events extracted · Contract period: Jan 2025 – Jan 2026</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] font-semibold px-2.5 py-[3px] rounded-pill bg-success-lt text-success">{sorted.length} events found</span>
          <button className="text-[12px] text-text-3 border border-border px-[11px] py-[5px] rounded-[6px] hover:bg-white transition-colors">Replace</button>
        </div>
      </div>

      {/* Timeline header */}
      <div className="flex items-center justify-between px-7 mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-text">Contract Timeline</span>
          <span className="text-[11.5px] font-semibold px-2 py-[2px] rounded-pill bg-indigo-lt text-indigo">{sorted.length} events</span>
        </div>
        <div className="flex items-center gap-4">
          {[
            { color: '#4338CA', label: 'Milestone' },
            { color: '#059669', label: 'Payment' },
            { color: '#D97706', label: 'Renewal' },
            { color: '#DC2626', label: 'Deadline' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-[11.5px] text-text-3">
              <span className="w-2 h-2 rounded-[2px] flex-shrink-0" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Horizontal canvas */}
      <div
        ref={scrollRef}
        className="mx-7 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] overflow-x-auto overflow-y-hidden flex-shrink-0"
        style={{ height: CANVAS_H }}
      >
        <div className="relative" style={{ width: canvasW, height: CANVAS_H }}>
          {/* Center axis */}
          <div className="absolute left-0 bg-[#CBD5E1]" style={{ top: AXIS_Y, height: 2, width: canvasW }} />

          {/* Today marker */}
          <div className="absolute top-0 bottom-0 bg-indigo" style={{ left: todayX, width: 2 }}>
            <span
              className="absolute text-[10px] font-bold text-white bg-indigo px-1.5 py-0.5 rounded-[3px] -translate-x-1/2"
              style={{ top: 12, left: 1 }}
            >
              Today
            </span>
          </div>

          {/* Month ticks */}
          {months.map((m) => (
            <div key={m.label} className="absolute flex flex-col items-center" style={{ left: m.x, top: AXIS_Y + 2 }}>
              <div className="bg-[#CBD5E1]" style={{ width: 1, height: 10 }} />
              <p className="text-[10px] font-medium text-text-3 mt-1 whitespace-nowrap">{m.label}</p>
            </div>
          ))}

          {/* Events */}
          {sorted.map((event, i) => (
            <EventCard
              key={event.id}
              event={event}
              x={dateToX(event.date, minDate)}
              above={i % 2 === 0}
              selected={selectedEvent?.id === event.id}
              onClick={() => setSelected(event)}
            />
          ))}
        </div>
      </div>

      {/* Bottom detail panel */}
      {selectedEvent && (
        <div className="flex-shrink-0 bg-white border-t border-border flex items-start gap-7 px-7 py-4">
          <div className="flex flex-col gap-1 min-w-[220px] flex-shrink-0">
            <p className="text-[10.5px] font-semibold text-text-3 uppercase tracking-[0.63px]">Selected Event</p>
            <p className="text-[15px] font-bold text-text leading-tight">{selectedEvent.title}</p>
            <p className="text-[13px] text-text-2">
              {new Date(selectedEvent.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}{daysAway(selectedEvent.date)}
            </p>
          </div>

          <div className="self-stretch w-px bg-border flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] font-semibold text-text-3 uppercase tracking-[0.63px] mb-1.5">
              Source Clause{selectedEvent.section ? ` · ${selectedEvent.section}` : ''}
            </p>
            {selectedEvent.sourceClause ? (
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] border-l-[3px] border-l-indigo rounded-[8px] px-3.5 py-3">
                <p className="text-[13px] text-text-2 leading-[1.65] line-clamp-3">{selectedEvent.sourceClause}</p>
              </div>
            ) : (
              <p className="text-[13px] text-text-3 italic">{selectedEvent.description}</p>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
            <button className="px-4 py-2 border border-[#CBD5E1] text-[13px] text-text-2 rounded-[7px] bg-white hover:bg-surface transition-colors whitespace-nowrap">
              View clause
            </button>
            <button className="px-4 py-2 border border-[#CBD5E1] text-[13px] text-text-2 rounded-[7px] bg-white hover:bg-surface transition-colors whitespace-nowrap">
              Set reminder
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
