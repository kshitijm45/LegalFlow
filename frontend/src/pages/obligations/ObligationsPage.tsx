import { useState } from 'react'
import { useUser } from '@clerk/react'
import {
  Bell, BellOff, Check, CheckCheck, ChevronDown, ChevronUp,
  Download, FileText, Loader2, Sparkles, Trash2, X, Pencil, Plus,
} from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { useContracts, formatFileSize } from '@/hooks/useVault'
import {
  useObligationsList, useExtractObligations,
  useUpdateObligation, useDeleteObligation, useCreateObligation,
} from '@/hooks/useObligations'
import type { ObligationDTO } from '@/hooks/useObligations'
import { cn } from '@/lib/utils'

// ─── Config ───────────────────────────────────────────────────────────────────

const categoryConfig: Record<string, { label: string; color: string; bg: string }> = {
  payment:    { label: 'Payment',    color: '#059669', bg: '#D1FAE5' },
  notice:     { label: 'Notice',     color: '#D97706', bg: '#FEF3C7' },
  delivery:   { label: 'Delivery',   color: '#0369A1', bg: '#F0F9FF' },
  reporting:  { label: 'Reporting',  color: '#7C3AED', bg: '#F5F3FF' },
  compliance: { label: 'Compliance', color: '#4338CA', bg: '#EEF2FF' },
  other:      { label: 'Other',      color: '#475569', bg: '#F1F5F9' },
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#D97706', bg: '#FEF3C7' },
  done:    { label: 'Done',    color: '#059669', bg: '#D1FAE5' },
  snoozed: { label: 'Snoozed', color: '#475569', bg: '#F1F5F9' },
}

const today = new Date()
today.setHours(0, 0, 0, 0)

function daysUntil(dateStr: string): { label: string; overdue: boolean } {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0)   return { label: `${Math.abs(diff)}d overdue`, overdue: true }
  if (diff === 0) return { label: 'Due today', overdue: true }
  if (diff <= 7)  return { label: `${diff}d left`, overdue: false }
  return {
    label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    overdue: false,
  }
}

function formatReminderDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function sevenDaysBefore(dueDateStr: string): string {
  const d = new Date(dueDateStr)
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}

// ─── Reminder panel ───────────────────────────────────────────────────────────

function ReminderPanel({ obligation, userEmail, onClose }: {
  obligation: ObligationDTO; userEmail: string; onClose: () => void
}) {
  const updateMutation = useUpdateObligation()
  const existingDate = obligation.reminder_date ? obligation.reminder_date.split('T')[0] : ''
  const [date, setDate] = useState(existingDate)
  const [email, setEmail] = useState(obligation.reminder_email || userEmail)

  function handleSave() {
    if (!date || !email) return
    updateMutation.mutate(
      { id: obligation.id, patch: { reminder_date: `${date}T09:00:00+05:30`, reminder_email: email } },
      { onSuccess: onClose }
    )
  }

  function handleClear() {
    updateMutation.mutate(
      { id: obligation.id, patch: { reminder_date: '', reminder_email: '' } },
      { onSuccess: onClose }
    )
  }

  return (
    <div className="absolute right-0 top-8 z-30 w-[300px] bg-white border border-border rounded-[10px] shadow-lg p-4"
      onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-bold text-text uppercase tracking-[0.5px]">Email Reminder</p>
        <button onClick={onClose} className="text-text-3 hover:text-text"><X size={13} /></button>
      </div>

      <div className="space-y-3">
        {/* Quick preset */}
        {obligation.due_date && (
          <button
            onClick={() => setDate(sevenDaysBefore(obligation.due_date!))}
            className="w-full text-left text-[11.5px] font-medium text-indigo bg-indigo-lt border border-indigo-mid rounded-[6px] px-3 py-1.5 hover:bg-indigo/10 transition-colors"
          >
            7 days before due date ({formatReminderDate(`${sevenDaysBefore(obligation.due_date!)}T00:00:00`)})
          </button>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-1.5">Remind on</label>
          <input type="date" value={date} min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-border rounded-[7px] px-3 py-[7px] text-[13px] text-text focus:outline-none focus:border-indigo focus:ring-1 focus:ring-indigo/20" />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-1.5">Send to</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full border border-border rounded-[7px] px-3 py-[7px] text-[13px] text-text placeholder:text-text-3 focus:outline-none focus:border-indigo focus:ring-1 focus:ring-indigo/20" />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button onClick={handleSave} disabled={!date || !email || updateMutation.isPending}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-[7px] bg-indigo text-white text-[12.5px] font-semibold rounded-[7px] hover:bg-indigo-dk transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {updateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
          Set Reminder
        </button>
        {obligation.reminder_date && (
          <button onClick={handleClear} disabled={updateMutation.isPending}
            className="px-3 py-[7px] text-[12.5px] font-medium text-danger hover:bg-danger-lt rounded-[7px] transition-colors disabled:opacity-40">
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Snooze panel ────────────────────────────────────────────────────────────

function SnoozePanel({ obligation, onClose }: { obligation: ObligationDTO; onClose: () => void }) {
  const updateMutation = useUpdateObligation()
  const [date, setDate] = useState('')

  const presets = [
    { label: '1 week',  days: 7 },
    { label: '2 weeks', days: 14 },
    { label: '1 month', days: 30 },
  ]

  function dateFromNow(days: number) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  function handleSnooze(isoDate: string) {
    updateMutation.mutate(
      { id: obligation.id, patch: { snooze_until: isoDate } },
      { onSuccess: onClose }
    )
  }

  function handleUnsnooze() {
    updateMutation.mutate(
      { id: obligation.id, patch: { snooze_until: '' } },
      { onSuccess: onClose }
    )
  }

  return (
    <div className="absolute right-0 top-8 z-30 w-[260px] bg-white border border-border rounded-[10px] shadow-lg p-4"
      onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-bold text-text uppercase tracking-[0.5px]">Snooze Until</p>
        <button onClick={onClose} className="text-text-3 hover:text-text"><X size={13} /></button>
      </div>
      <div className="flex gap-1.5 mb-3">
        {presets.map(p => (
          <button key={p.days} onClick={() => handleSnooze(dateFromNow(p.days))}
            className="flex-1 text-[11.5px] font-medium py-1.5 bg-surface border border-border rounded-[6px] text-text-2 hover:border-indigo hover:text-indigo transition-colors">
            {p.label}
          </button>
        ))}
      </div>
      <input type="date" value={date} min={new Date().toISOString().split('T')[0]}
        onChange={e => setDate(e.target.value)}
        className="w-full border border-border rounded-[7px] px-3 py-[7px] text-[12.5px] text-text focus:outline-none focus:border-indigo mb-3" />
      <div className="flex gap-2">
        <button onClick={() => date && handleSnooze(date)} disabled={!date || updateMutation.isPending}
          className="flex-1 py-[7px] bg-indigo text-white text-[12px] font-semibold rounded-[7px] hover:bg-indigo-dk transition-colors disabled:opacity-40">
          Snooze
        </button>
        {obligation.status === 'snoozed' && (
          <button onClick={handleUnsnooze} disabled={updateMutation.isPending}
            className="px-3 py-[7px] text-[12px] font-medium text-text-2 border border-border rounded-[7px] hover:bg-surface transition-colors disabled:opacity-40">
            Unsnooze
          </button>
        )}
      </div>
      <p className="text-[11px] text-text-3 mt-2 text-center">Obligation returns to Pending automatically</p>
    </div>
  )
}

// ─── Add obligation modal ─────────────────────────────────────────────────────

interface AddObligationModalProps {
  contracts: { id: string; name: string; contract_type: string | null }[]
  onClose: () => void
}

function AddObligationModal({ contracts, onClose }: AddObligationModalProps) {
  const createMutation = useCreateObligation()
  const [contractId, setContractId]     = useState(contracts[0]?.id ?? '')
  const [title, setTitle]               = useState('')
  const [description, setDescription]   = useState('')
  const [category, setCategory]         = useState('other')
  const [dueDate, setDueDate]           = useState('')
  const [responsible, setResponsible]   = useState('')
  const [recurrence, setRecurrence]     = useState('')

  function handleSubmit() {
    if (!title.trim() || !contractId) return
    createMutation.mutate({
      contract_id: contractId,
      title: title.trim(),
      description: description.trim(),
      category,
      due_date: dueDate || undefined,
      responsible_party: responsible.trim() || undefined,
      recurrence: recurrence || undefined,
    }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="w-[540px] bg-white rounded-[12px] shadow-2xl border border-border overflow-hidden"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="text-[14px] font-bold text-text">Add Obligation</p>
          <button onClick={onClose} className="text-text-3 hover:text-text"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Contract */}
          <div>
            <label className="block text-[11px] font-bold text-text-3 uppercase tracking-[0.5px] mb-1.5">Contract *</label>
            <select value={contractId} onChange={e => setContractId(e.target.value)}
              className="w-full border border-border rounded-[7px] px-3 py-[8px] text-[13px] text-text focus:outline-none focus:border-indigo bg-white">
              {contracts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-bold text-text-3 uppercase tracking-[0.5px] mb-1.5">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Submit quarterly compliance report"
              className="w-full border border-border rounded-[7px] px-3 py-[8px] text-[13px] text-text placeholder:text-text-3 focus:outline-none focus:border-indigo" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold text-text-3 uppercase tracking-[0.5px] mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="What needs to be done and why"
              className="w-full border border-border rounded-[7px] px-3 py-[8px] text-[13px] text-text placeholder:text-text-3 focus:outline-none focus:border-indigo resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-[11px] font-bold text-text-3 uppercase tracking-[0.5px] mb-1.5">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border border-border rounded-[7px] px-3 py-[8px] text-[13px] text-text focus:outline-none focus:border-indigo bg-white">
                {Object.entries(categoryConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div>
              <label className="block text-[11px] font-bold text-text-3 uppercase tracking-[0.5px] mb-1.5">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full border border-border rounded-[7px] px-3 py-[8px] text-[13px] text-text focus:outline-none focus:border-indigo" />
            </div>

            {/* Responsible party */}
            <div>
              <label className="block text-[11px] font-bold text-text-3 uppercase tracking-[0.5px] mb-1.5">Responsible Party</label>
              <input value={responsible} onChange={e => setResponsible(e.target.value)}
                placeholder="e.g. Company, Investor"
                className="w-full border border-border rounded-[7px] px-3 py-[8px] text-[13px] text-text placeholder:text-text-3 focus:outline-none focus:border-indigo" />
            </div>

            {/* Recurrence */}
            <div>
              <label className="block text-[11px] font-bold text-text-3 uppercase tracking-[0.5px] mb-1.5">Recurrence</label>
              <select value={recurrence} onChange={e => setRecurrence(e.target.value)}
                className="w-full border border-border rounded-[7px] px-3 py-[8px] text-[13px] text-text focus:outline-none focus:border-indigo bg-white">
                <option value="">None / one-time</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-text-2 hover:text-text transition-colors">Cancel</button>
          <button onClick={handleSubmit}
            disabled={!title.trim() || !contractId || createMutation.isPending}
            className="flex items-center gap-1.5 px-5 py-2 bg-indigo text-white text-[13px] font-semibold rounded-[7px] hover:bg-indigo-dk transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add Obligation
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ObligationRow({ obligation, userEmail }: { obligation: ObligationDTO; userEmail: string }) {
  const [expanded, setExpanded]         = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [snoozeOpen, setSnoozeOpen]     = useState(false)
  const [editingNote, setEditingNote]   = useState(false)
  const [noteVal, setNoteVal]           = useState(obligation.note ?? '')
  const [editingDate, setEditingDate]   = useState(false)
  const [editingCat, setEditingCat]     = useState(false)
  const updateMutation = useUpdateObligation()
  const deleteMutation = useDeleteObligation()

  const cat      = categoryConfig[obligation.category] ?? categoryConfig.other
  const scfg     = statusConfig[obligation.status]
  const isDone   = obligation.status === 'done'
  const isSnoozed = obligation.status === 'snoozed'
  const dateInfo = obligation.due_date ? daysUntil(obligation.due_date) : null
  const hasReminder = !!obligation.reminder_date && !obligation.reminder_sent

  function setStatus(s: 'pending' | 'done' | 'snoozed') {
    updateMutation.mutate({ id: obligation.id, patch: { status: s } })
  }

  function saveNote() {
    updateMutation.mutate({ id: obligation.id, patch: { note: noteVal } }, { onSuccess: () => setEditingNote(false) })
  }

  function saveDueDate(val: string) {
    updateMutation.mutate({ id: obligation.id, patch: { due_date: val } }, { onSuccess: () => setEditingDate(false) })
  }

  function saveCategory(val: string) {
    updateMutation.mutate({ id: obligation.id, patch: { category: val } }, { onSuccess: () => setEditingCat(false) })
  }

  return (
    <>
      <tr className={cn(
        'border-b border-border cursor-pointer transition-colors group',
        isDone ? 'bg-[#F8FAFC] hover:bg-surface' : 'hover:bg-[#F8FAFC]'
      )} onClick={() => setExpanded(v => !v)}>

        {/* Done toggle */}
        <td className="px-4 py-3.5 w-10" onClick={e => e.stopPropagation()}>
          <button disabled={updateMutation.isPending}
            onClick={() => setStatus(isDone ? 'pending' : 'done')}
            className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
              isDone ? 'bg-success border-success text-white' : 'border-border-dk hover:border-success')}>
            {isDone && <Check size={10} strokeWidth={3} />}
          </button>
        </td>

        {/* Title */}
        <td className="px-4 py-3.5">
          <p className={cn('text-[13px] font-semibold leading-snug', isDone ? 'line-through text-text-3' : 'text-text')}>
            {obligation.title}
          </p>
          {obligation.responsible_party && (
            <p className="text-[11px] text-text-3 mt-0.5">{obligation.responsible_party}</p>
          )}
        </td>

        {/* Category */}
        <td className="px-4 py-3.5">
          <span className="inline-flex px-2.5 py-[3px] rounded-[5px] text-[11.5px] font-semibold whitespace-nowrap"
            style={{ background: cat.bg, color: cat.color }}>
            {cat.label}
          </span>
        </td>

        {/* Due date */}
        <td className="px-4 py-3.5 whitespace-nowrap">
          {dateInfo ? (
            <span className={cn('text-[12.5px] font-medium', dateInfo.overdue && !isDone ? 'text-danger' : 'text-text-2')}>
              {dateInfo.label}
            </span>
          ) : obligation.recurrence && obligation.recurrence !== 'one-time' ? (
            <span className="text-[12.5px] text-text-3 capitalize">Recurring · {obligation.recurrence}</span>
          ) : (
            <span className="text-[12.5px] text-text-3">—</span>
          )}
        </td>

        {/* Status */}
        <td className="px-4 py-3.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-[5px] text-[11.5px] font-semibold"
            style={{ background: scfg.bg, color: scfg.color }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: scfg.color }} />
            {scfg.label}
          </span>
        </td>

        {/* Actions */}
        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative">
            <button title={hasReminder ? `Reminder: ${formatReminderDate(obligation.reminder_date!)}` : 'Set reminder'}
              className={cn('p-1.5 rounded-[5px] transition-colors',
                hasReminder ? 'text-indigo bg-indigo-lt' : 'text-text-3 hover:bg-surface hover:text-indigo')}
              onClick={() => { setSnoozeOpen(false); setReminderOpen(o => !o) }}>
              <Bell size={13} />
            </button>

            {!isDone && (
              <button title={isSnoozed ? 'Snoozed — click to change' : 'Snooze'}
                onClick={() => { setReminderOpen(false); setSnoozeOpen(o => !o) }}
                className={cn('p-1.5 rounded-[5px] transition-colors',
                  isSnoozed ? 'text-warning bg-warning-lt' : 'text-text-3 hover:bg-surface hover:text-warning')}>
                <BellOff size={13} />
              </button>
            )}

            <button title="Delete obligation"
              onClick={() => { if (confirm('Delete this obligation?')) deleteMutation.mutate(obligation.id) }}
              disabled={deleteMutation.isPending}
              className="p-1.5 rounded-[5px] text-text-3 hover:bg-danger-lt hover:text-danger transition-colors disabled:opacity-40">
              <Trash2 size={13} />
            </button>

            {reminderOpen && (
              <ReminderPanel obligation={obligation} userEmail={userEmail} onClose={() => setReminderOpen(false)} />
            )}
            {snoozeOpen && (
              <SnoozePanel obligation={obligation} onClose={() => setSnoozeOpen(false)} />
            )}
          </div>
        </td>

        <td className="px-4 py-3.5 w-8">
          {expanded ? <ChevronUp size={13} className="text-text-3" /> : <ChevronDown size={13} className="text-text-3" />}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-[#F8FAFC] border-b border-border">
          <td colSpan={8} className="px-6 py-4">
            <div className="flex gap-8">
              <div className="flex-1 min-w-0 space-y-3">
                <p className="text-[13px] text-text-2 leading-relaxed">{obligation.description}</p>

                {/* Inline note editor */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-bold text-text-3 uppercase tracking-[0.6px]">Note</p>
                    {!editingNote && (
                      <button onClick={(e) => { e.stopPropagation(); setEditingNote(true) }}
                        className="text-[10px] text-indigo hover:underline flex items-center gap-0.5">
                        <Pencil size={9} />{obligation.note ? 'Edit' : 'Add note'}
                      </button>
                    )}
                  </div>
                  {editingNote ? (
                    <div className="space-y-2" onClick={e => e.stopPropagation()}>
                      <textarea value={noteVal} onChange={e => setNoteVal(e.target.value)} rows={2}
                        className="w-full border border-border rounded-[7px] px-3 py-2 text-[12.5px] text-text focus:outline-none focus:border-indigo resize-none"
                        placeholder="Add a note…" />
                      <div className="flex gap-2">
                        <button onClick={saveNote} disabled={updateMutation.isPending}
                          className="px-3 py-1 bg-indigo text-white text-[12px] font-semibold rounded-[6px] hover:bg-indigo-dk transition-colors disabled:opacity-40">
                          Save
                        </button>
                        <button onClick={() => { setNoteVal(obligation.note ?? ''); setEditingNote(false) }}
                          className="px-3 py-1 text-[12px] text-text-2 hover:text-text transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : obligation.note ? (
                    <div className="p-2.5 bg-warning-lt border border-warning/20 rounded-[7px]">
                      <p className="text-[12.5px] text-text-2">{obligation.note}</p>
                    </div>
                  ) : (
                    <p className="text-[12px] text-text-3 italic">No note</p>
                  )}
                </div>

                {/* Inline due date editor */}
                <div onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-bold text-text-3 uppercase tracking-[0.6px]">Due Date</p>
                    {!editingDate && (
                      <button onClick={() => setEditingDate(true)}
                        className="text-[10px] text-indigo hover:underline flex items-center gap-0.5">
                        <Pencil size={9} />Edit
                      </button>
                    )}
                  </div>
                  {editingDate ? (
                    <div className="flex items-center gap-2">
                      <input type="date" defaultValue={obligation.due_date ?? ''}
                        onChange={e => saveDueDate(e.target.value)}
                        className="border border-border rounded-[7px] px-3 py-[5px] text-[12.5px] text-text focus:outline-none focus:border-indigo" />
                      <button onClick={() => setEditingDate(false)}
                        className="text-[12px] text-text-3 hover:text-text">Cancel</button>
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-text-2">{obligation.due_date ?? '—'}</p>
                  )}
                </div>

                {/* Inline category editor */}
                <div onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-bold text-text-3 uppercase tracking-[0.6px]">Category</p>
                    {!editingCat && (
                      <button onClick={() => setEditingCat(true)}
                        className="text-[10px] text-indigo hover:underline flex items-center gap-0.5">
                        <Pencil size={9} />Edit
                      </button>
                    )}
                  </div>
                  {editingCat ? (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(categoryConfig).map(([key, cfg]) => (
                        <button key={key} onClick={() => saveCategory(key)}
                          className="px-2.5 py-1 rounded-[5px] text-[11.5px] font-semibold transition-colors"
                          style={{ background: obligation.category === key ? cfg.color : cfg.bg, color: obligation.category === key ? '#fff' : cfg.color }}>
                          {cfg.label}
                        </button>
                      ))}
                      <button onClick={() => setEditingCat(false)} className="px-2.5 py-1 text-[11.5px] text-text-3 hover:text-text">Cancel</button>
                    </div>
                  ) : null}
                </div>

                {/* Reminder status */}
                {hasReminder && (
                  <div className="flex items-center gap-2 text-[12px] text-indigo">
                    <Bell size={12} />
                    <span>Reminder set for {formatReminderDate(obligation.reminder_date!)} → {obligation.reminder_email}</span>
                  </div>
                )}
                {obligation.reminder_sent && (
                  <div className="flex items-center gap-2 text-[12px] text-text-3">
                    <Bell size={12} />
                    <span>Reminder sent on {formatReminderDate(obligation.reminder_date!)} to {obligation.reminder_email}</span>
                  </div>
                )}
              </div>

              {/* Source clause */}
              {obligation.source_clause && (
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-text-3 uppercase tracking-[0.6px] mb-1.5">
                    Source Clause{obligation.section ? ` · ${obligation.section}` : ''}
                  </p>
                  <div className="bg-white border border-border border-l-[3px] border-l-indigo rounded-[8px] px-3 py-2.5">
                    <p className="text-[12.5px] text-text-2 leading-relaxed font-mono">{obligation.source_clause}</p>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabFilter = 'all' | 'pending' | 'done' | 'snoozed'

export function ObligationsPage() {
  const { user } = useUser()
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? ''

  const { data: contractsData } = useContracts({ status_filter: 'ready' })
  const contracts = contractsData?.contracts ?? []

  // Load all obligations from backend on mount — persistent across navigation
  const { data: obligationsData, isLoading: obligationsLoading } = useObligationsList()
  const backendObligations = obligationsData?.obligations ?? []

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pickerOpen, setPickerOpen]   = useState(false)
  const [tab, setTab]                 = useState<TabFilter>('all')
  const [catFilter, setCatFilter]     = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)

  const extractMutation = useExtractObligations()

  function toggleContract(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function handleExtract() {
    if (selectedIds.size === 0) return
    setPickerOpen(false)
    extractMutation.mutate([...selectedIds])
  }

  // Use backend obligations (persistent). If extraction just happened, query cache is refreshed automatically.
  const obligations = backendObligations

  let displayed = obligations
  if (tab !== 'all')       displayed = displayed.filter(o => o.status === tab)
  if (catFilter !== 'all') displayed = displayed.filter(o => o.category === catFilter)

  const overdueCount  = obligations.filter(o => o.status === 'pending' && o.due_date && new Date(o.due_date) < today).length
  const pendingCount  = obligations.filter(o => o.status === 'pending').length
  const doneCount     = obligations.filter(o => o.status === 'done').length
  const snoozedCount  = obligations.filter(o => o.status === 'snoozed').length
  const reminderCount = obligations.filter(o => o.reminder_date && !o.reminder_sent).length
  const categories    = [...new Set(obligations.map(o => o.category))]
  const selectedContracts = contracts.filter(c => selectedIds.has(c.id))

  const isLoading = obligationsLoading || extractMutation.isPending

  function handleExportCsv() {
    const header = ['Title', 'Category', 'Status', 'Due Date', 'Recurrence', 'Responsible Party', 'Description']
    const rows = displayed.map(o => [
      o.title,
      categoryConfig[o.category]?.label ?? o.category,
      o.status,
      o.due_date ?? '',
      o.recurrence ?? '',
      o.responsible_party ?? '',
      o.description ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `obligations-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar breadcrumb={[{ label: 'AI Tools' }, { label: 'Obligation Tracking' }]} />

      {/* Document selector */}
      <div className="flex items-center gap-3 mx-7 mt-4 mb-4 px-4 py-[10px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] flex-shrink-0">
        <div className="w-8 h-8 bg-indigo-lt border border-indigo-mid rounded-[7px] flex items-center justify-center flex-shrink-0">
          <FileText size={14} className="text-indigo" />
        </div>
        <div className="flex-1 min-w-0 relative">
          {contracts.length === 0 ? (
            <p className="text-[13px] text-text-3">No processed contracts yet — upload one in The Vault first.</p>
          ) : (
            <>
              <button className="flex items-center gap-2 text-left" onClick={() => setPickerOpen(o => !o)}>
                {selectedIds.size === 0 ? (
                  <span className="text-[13px] text-text-3">Select contracts to extract obligations from…</span>
                ) : (
                  <span className="text-[13px] font-semibold text-text">
                    {selectedIds.size === 1 ? selectedContracts[0]?.name ?? '1 contract' : `${selectedIds.size} contracts selected`}
                  </span>
                )}
                <span className="text-[11px] text-indigo font-medium underline underline-offset-2">
                  {pickerOpen ? 'Done' : 'Change'}
                </span>
              </button>

              {pickerOpen && (
                <div className="absolute top-full left-0 mt-2 w-[420px] bg-white border border-[#E2E8F0] rounded-[10px] shadow-lg z-20 py-1.5 max-h-[280px] overflow-y-auto">
                  {contracts.map(c => {
                    const checked = selectedIds.has(c.id)
                    return (
                      <button key={c.id} onClick={() => toggleContract(c.id)}
                        className={cn('w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[#F8FAFC] transition-colors', checked && 'bg-indigo-lt')}>
                        <div className={cn('w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0', checked ? 'bg-indigo border-indigo' : 'border-border-dk bg-white')}>
                          {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <FileText size={13} className={checked ? 'text-indigo flex-shrink-0' : 'text-text-3 flex-shrink-0'} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-[13px] font-medium truncate', checked ? 'text-indigo' : 'text-text')}>{c.name}</p>
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
        <div className="flex items-center gap-2 flex-shrink-0">
          {obligations.length > 0 && (
            <button
              className="flex items-center gap-1.5 px-3.5 py-[7px] text-[13px] font-semibold rounded-[7px] transition-colors border border-border bg-white text-text-2 hover:border-indigo-mid hover:text-indigo"
              onClick={handleExportCsv}
              title="Export current view to CSV">
              <Download size={13} /> Export CSV
            </button>
          )}
          <button
            className="flex items-center gap-1.5 px-3.5 py-[7px] text-[13px] font-semibold rounded-[7px] transition-colors border border-border bg-white text-text-2 hover:border-indigo-mid hover:text-indigo"
            onClick={() => setShowAddModal(true)}>
            <Plus size={13} /> Add Manual
          </button>
          <button
            className="flex items-center gap-1.5 px-4 py-[7px] text-[13px] font-semibold rounded-[7px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-indigo text-white hover:bg-indigo-dk"
            disabled={selectedIds.size === 0 || extractMutation.isPending}
            onClick={handleExtract}>
            {extractMutation.isPending
              ? <><Loader2 size={13} className="animate-spin" /> Extracting…</>
              : <><Sparkles size={13} /> Extract Obligations</>}
          </button>
        </div>
      </div>

      {pickerOpen && <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />}
      {showAddModal && (
        <AddObligationModal contracts={contracts} onClose={() => setShowAddModal(false)} />
      )}

      {/* Filters — only show when there are obligations */}
      {obligations.length > 0 && (
        <div className="flex items-center gap-3 px-7 mb-3 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-1">
            {([['all', obligations.length, 'All'], ['pending', pendingCount, 'Pending'], ['done', doneCount, 'Done'], ['snoozed', snoozedCount, 'Snoozed']] as [TabFilter, number, string][]).map(([t, count, label]) => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('px-3 py-1.5 text-xs font-medium rounded-pill transition-colors',
                  tab === t ? 'bg-indigo text-white' : 'bg-surface text-text-2 border border-border hover:border-indigo-mid')}>
                {label} ({count})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {overdueCount > 0 && tab !== 'done' && (
              <button onClick={() => setTab('pending')}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-danger hover:underline">
                <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                {overdueCount} overdue
              </button>
            )}
            {reminderCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-indigo">
                <Bell size={12} />{reminderCount} reminder{reminderCount > 1 ? 's' : ''} set
              </span>
            )}
          </div>
          {categories.length > 1 && (
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setCatFilter('all')}
                className={cn('px-2.5 py-1 text-[11.5px] font-medium rounded-[5px] transition-colors', catFilter === 'all' ? 'bg-indigo-lt text-indigo' : 'text-text-3 hover:text-text-2')}>
                All
              </button>
              {categories.map(cat => {
                const cfg = categoryConfig[cat] ?? categoryConfig.other
                return (
                  <button key={cat} onClick={() => setCatFilter(cat === catFilter ? 'all' : cat)}
                    className={cn('px-2.5 py-1 text-[11.5px] font-medium rounded-[5px] transition-colors', catFilter === cat ? 'text-white' : 'text-text-3 hover:text-text-2')}
                    style={catFilter === cat ? { background: cfg.color } : {}}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto mx-7 mb-7 border border-border rounded-[10px] bg-white">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 h-full">
            <Loader2 size={28} className="text-indigo animate-spin" />
            <p className="text-[13px] text-text-2">
              {extractMutation.isPending
                ? `Extracting obligations from ${selectedIds.size} document${selectedIds.size > 1 ? 's' : ''}…`
                : 'Loading obligations…'}
            </p>
          </div>
        ) : obligations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 h-full">
            <div className="w-10 h-10 bg-indigo-lt rounded-[10px] flex items-center justify-center">
              <CheckCheck size={20} className="text-indigo" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-semibold text-text-2">No obligations yet</p>
              <p className="text-[13px] text-text-3 mt-1">Select contracts above and click Extract Obligations</p>
            </div>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 h-full">
            <p className="text-[14px] font-semibold text-text-2">No obligations match this filter</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#F8FAFC] border-b border-border z-10">
              <tr>
                <th className="px-4 py-3 w-10" />
                <th className="px-4 py-3 text-left text-[11px] font-bold text-text-3 uppercase tracking-[0.6px]">Obligation</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-text-3 uppercase tracking-[0.6px]">Category</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-text-3 uppercase tracking-[0.6px]">Due / Recurrence</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-text-3 uppercase tracking-[0.6px]">Status</th>
                <th className="px-4 py-3 w-24" />
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {displayed.map(o => (
                <ObligationRow key={o.id} obligation={o} userEmail={userEmail} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
