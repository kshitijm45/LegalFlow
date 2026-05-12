import { useState, useEffect } from 'react'
import {
  AlertTriangle, Bell, Check, ChevronDown, ChevronUp,
  Copy, FileText, Loader2, RotateCw, Sparkles, X,
} from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { useContracts } from '@/hooks/useVault'
import {
  usePlaybooks, useDetectPlaybook, useRunAudit, useAuditHistory, useUpdateClauseResult,
} from '@/hooks/useClauseAudit'
import type { ClauseAuditDTO, ClauseResultDTO } from '@/lib/api'
import { cn } from '@/lib/utils'

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  present: { label: 'Present', color: '#059669', bg: '#D1FAE5', icon: '✓' },
  partial: { label: 'Partial', color: '#D97706', bg: '#FEF3C7', icon: '~' },
  missing: { label: 'Missing', color: '#DC2626', bg: '#FEE2E2', icon: '✗' },
}

const RISK_CONFIG = {
  high:   { label: 'High',   color: '#DC2626', bg: '#FEE2E2' },
  medium: { label: 'Medium', color: '#D97706', bg: '#FEF3C7' },
  low:    { label: 'Low',    color: '#475569', bg: '#F1F5F9' },
}

const PLAYBOOK_LABELS: Record<string, string> = {
  bta: 'BTA', sha: 'SHA', ssa: 'SSA', spa: 'SPA',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function buildCopyText(audit: ClauseAuditDTO): string {
  const playbook = audit.playbook_types.map(p => PLAYBOOK_LABELS[p] ?? p.toUpperCase()).join(' + ')
  const present = audit.results.filter(r => r.status === 'present').length
  const partial = audit.results.filter(r => r.status === 'partial').length
  const missing = audit.results.filter(r => r.status === 'missing').length

  const lines: string[] = [
    'CLAUSE AUDIT REPORT',
    '===================',
    `Contract  : ${audit.contract_name}`,
    `Playbook  : ${playbook}`,
    `Date      : ${formatDate(audit.created_at)}`,
    `Score     : ${audit.overall_score?.toFixed(1)}%`,
    '',
    'SUMMARY',
    `Present : ${present}  |  Partial : ${partial}  |  Missing : ${missing}`,
    '',
    'CLAUSE-BY-CLAUSE RESULTS',
    '------------------------',
  ]

  const order: ClauseResultDTO['status'][] = ['missing', 'partial', 'present']
  const sorted = [...audit.results].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))

  for (const r of sorted) {
    const tag = r.status === 'missing' ? '✗ MISSING' : r.status === 'partial' ? '~ PARTIAL' : '✓ PRESENT'
    const mandatory = r.mandatory ? 'Mandatory' : 'Optional'
    lines.push('')
    lines.push(`[${tag}] ${r.clause_name}`)
    lines.push(`Risk: ${RISK_CONFIG[r.risk].label} | ${mandatory}`)
    if (r.ai_notes) lines.push(`Notes: ${r.ai_notes}`)
    if (r.found_text && r.status !== 'missing') lines.push(`Found: "${r.found_text.slice(0, 300)}..."`)
    if (r.suggested_text && r.status !== 'present') {
      lines.push(`Suggested language:\n${r.suggested_text}`)
    }
  }

  return lines.join('\n')
}

// ─── Clause row ───────────────────────────────────────────────────────────────

function ClauseRow({
  result,
  multiPlaybook,
  onUpdate,
}: {
  result: ClauseResultDTO
  multiPlaybook: boolean
  onUpdate: (updated: ClauseResultDTO) => void
}) {
  const [open, setOpen]                     = useState(false)
  const [localStatus, setLocalStatus]       = useState<string>(result.override_status ?? '')
  const [localNote, setLocalNote]           = useState<string>(result.override_note ?? '')
  const [annotationSaved, setAnnotationSaved] = useState(false)
  const updateMutation = useUpdateClauseResult()

  const effectiveStatus = (result.override_status ?? result.status) as ClauseResultDTO['status']
  const st = STATUS_CONFIG[effectiveStatus]
  const rk = RISK_CONFIG[result.risk]
  const isMissing = effectiveStatus === 'missing'
  const isPartial = effectiveStatus === 'partial'
  const isPresent = effectiveStatus === 'present'
  const hasOverride = !!result.override_status

  async function handleSaveAnnotation() {
    const updated = await updateMutation.mutateAsync({
      resultId: result.id,
      overrideStatus: localStatus || null,
      overrideNote: localNote || null,
    })
    onUpdate(updated)
    setAnnotationSaved(true)
    setTimeout(() => setAnnotationSaved(false), 2000)
  }

  function handleClearOverride() {
    setLocalStatus('')
    setLocalNote('')
    updateMutation.mutateAsync({
      resultId: result.id,
      overrideStatus: null,
      overrideNote: null,
    }).then(onUpdate)
  }

  return (
    <div className={cn(
      'border border-border rounded-[9px] overflow-hidden mb-2',
      isMissing && !hasOverride && 'border-danger/30',
      isPartial && !hasOverride && 'border-warning/30',
      hasOverride && 'border-indigo-mid',
    )}>
      {/* Row header */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
          isPresent && 'bg-white hover:bg-surface',
          isPartial && 'bg-warning-lt/30 hover:bg-warning-lt/50',
          isMissing && 'bg-danger-lt/30 hover:bg-danger-lt/50',
        )}
      >
        {/* Status icon — shows effective status */}
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ backgroundColor: st.bg, color: st.color }}
        >
          {st.icon}
        </span>

        {/* Name */}
        <span className="flex-1 text-[13px] font-semibold text-text">{result.clause_name}</span>

        {/* Override indicator */}
        {hasOverride && (
          <span className="text-[10px] font-bold text-indigo bg-indigo-lt px-1.5 py-0.5 rounded-[4px]">
            Overridden
          </span>
        )}

        {/* Playbook badge (only for combined) */}
        {multiPlaybook && (
          <span className="text-[10px] font-bold text-text-3 bg-border px-1.5 py-0.5 rounded-[4px] uppercase">
            {PLAYBOOK_LABELS[result.playbook_type] ?? result.playbook_type}
          </span>
        )}

        {/* Risk badge */}
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-[5px] flex-shrink-0"
          style={{ backgroundColor: rk.bg, color: rk.color }}
        >
          {rk.label}
        </span>

        {open ? <ChevronUp size={13} className="text-text-3 flex-shrink-0" /> : <ChevronDown size={13} className="text-text-3 flex-shrink-0" />}
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-4 pb-4 pt-2 bg-white border-t border-border space-y-3">
          {/* AI notes */}
          {result.ai_notes && (
            <p className="text-[12.5px] text-text-2 leading-relaxed">{result.ai_notes}</p>
          )}

          {/* Found text (present / partial per AI) */}
          {result.found_text && result.status !== 'missing' && (
            <div>
              <p className="text-[10px] font-bold text-text-3 uppercase tracking-[0.6px] mb-1.5">Found in Document</p>
              <div className="bg-surface border border-border border-l-[3px] border-l-success rounded-[7px] px-3 py-2.5">
                <p className="text-[12px] text-text-2 leading-relaxed font-mono">"{result.found_text}"</p>
              </div>
            </div>
          )}

          {/* Suggested text (missing / partial per AI) */}
          {result.suggested_text && result.status !== 'present' && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[10px] font-bold text-text-3 uppercase tracking-[0.6px]">
                  {result.status === 'missing' ? 'Suggested Draft Language' : 'Suggested Improvement'}
                </p>
                <button
                  onClick={() => navigator.clipboard.writeText(result.suggested_text!)}
                  className="text-[10px] text-indigo hover:underline flex items-center gap-0.5"
                >
                  <Copy size={9} /> Copy
                </button>
              </div>
              <div className={cn(
                'rounded-[7px] px-3 py-2.5 border',
                result.status === 'missing' ? 'bg-danger-lt/20 border-danger/20' : 'bg-warning-lt/30 border-warning/20',
              )}>
                <p className="text-[12px] text-text-2 leading-relaxed font-mono whitespace-pre-wrap">
                  {result.suggested_text}
                </p>
              </div>
            </div>
          )}

          {/* Missing mandatory — risk callout */}
          {isMissing && result.mandatory && (
            <div className="flex items-start gap-2.5 p-2.5 bg-warning-lt border border-warning/30 rounded-[7px]">
              <AlertTriangle size={13} className="text-warning flex-shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-amber-800 leading-relaxed">
                This is a <strong>mandatory</strong> clause. Its absence exposes the client to {rk.label.toLowerCase()} risk and should be addressed before execution.
              </p>
            </div>
          )}

          {/* ── Annotation & Override ── */}
          <div className="border-t border-border pt-3 space-y-2.5">
            <p className="text-[10px] font-bold text-text-3 uppercase tracking-[0.6px]">Annotation</p>

            {/* Status override */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-text-2 w-[110px] flex-shrink-0">Override status</span>
              <select
                value={localStatus}
                onChange={e => setLocalStatus(e.target.value)}
                className="flex-1 text-[12px] border border-border rounded-[6px] px-2 py-1 bg-white text-text focus:outline-none focus:border-indigo-mid"
              >
                <option value="">— AI assessment —</option>
                <option value="present">Present</option>
                <option value="partial">Partial</option>
                <option value="missing">Missing</option>
              </select>
            </div>

            {/* Note */}
            <div className="flex items-start gap-2">
              <span className="text-[12px] text-text-2 w-[110px] flex-shrink-0 pt-1.5">Note</span>
              <textarea
                value={localNote}
                onChange={e => setLocalNote(e.target.value)}
                placeholder="Add a note (e.g. client accepted, under negotiation…)"
                rows={2}
                className="flex-1 text-[12px] border border-border rounded-[6px] px-2 py-1.5 bg-white text-text placeholder:text-text-3 focus:outline-none focus:border-indigo-mid resize-none"
              />
            </div>

            {/* Save / clear */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveAnnotation}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo text-white text-[12px] font-semibold rounded-[6px] hover:bg-indigo-dk transition-colors disabled:opacity-40"
              >
                {updateMutation.isPending
                  ? <Loader2 size={11} className="animate-spin" />
                  : annotationSaved
                  ? <Check size={11} />
                  : null}
                {annotationSaved ? 'Saved' : 'Save'}
              </button>
              {hasOverride && (
                <button
                  onClick={handleClearOverride}
                  className="text-[11.5px] text-text-3 hover:text-danger transition-colors"
                >
                  Clear override
                </button>
              )}
              {result.override_note && (
                <span className="text-[11px] text-text-3 italic ml-auto">
                  Note saved
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Results panel ────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'missing' | 'partial' | 'present'
type RiskFilter   = 'all' | 'high' | 'medium' | 'low'

function ResultsPanel({
  audit,
  onResultUpdate,
}: {
  audit: ClauseAuditDTO
  onResultUpdate: (updated: ClauseResultDTO) => void
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [riskFilter, setRiskFilter]     = useState<RiskFilter>('all')
  const [copied, setCopied]             = useState(false)

  // Use effective status (override_status ?? status) for counts and filtering
  const effectiveStatus = (r: ClauseResultDTO) => r.override_status ?? r.status
  const present = audit.results.filter(r => effectiveStatus(r) === 'present').length
  const partial = audit.results.filter(r => effectiveStatus(r) === 'partial').length
  const missing = audit.results.filter(r => effectiveStatus(r) === 'missing').length
  const multiPlaybook = audit.playbook_types.length > 1

  const ORDER: ClauseResultDTO['status'][] = ['missing', 'partial', 'present']
  let displayed = [...audit.results].sort((a, b) => ORDER.indexOf(effectiveStatus(a) as ClauseResultDTO['status']) - ORDER.indexOf(effectiveStatus(b) as ClauseResultDTO['status']))
  if (statusFilter !== 'all') displayed = displayed.filter(r => effectiveStatus(r) === statusFilter)
  if (riskFilter !== 'all')   displayed = displayed.filter(r => r.risk === riskFilter)

  function handleCopy() {
    navigator.clipboard.writeText(buildCopyText(audit))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Summary bar */}
      <div className="flex items-center gap-5 px-6 py-3.5 border-b border-border bg-white flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-text-3 mb-1.5">
            {audit.results.filter(r => r.status !== 'missing').length} of {audit.results.length} clauses satisfied
          </p>
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden flex">
            <div className="h-full bg-success" style={{ width: `${(present / audit.results.length) * 100}%` }} />
            <div className="h-full bg-warning" style={{ width: `${(partial / audit.results.length) * 100}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="flex items-center gap-1 px-2 py-1 rounded-[5px] bg-success-lt text-success text-[11.5px] font-semibold">
            <Check size={10} strokeWidth={3} />{present}
          </span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-[5px] bg-warning-lt text-warning text-[11.5px] font-semibold">
            ~{partial}
          </span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-[5px] bg-danger-lt text-danger text-[11.5px] font-semibold">
            ✗{missing}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-[6px] border border-border rounded-[7px] text-[12.5px] font-medium text-text-2 hover:border-indigo-mid hover:text-indigo transition-colors flex-shrink-0"
        >
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy Report'}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border bg-surface flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          {(['all', 'missing', 'partial', 'present'] as StatusFilter[]).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn('px-2.5 py-1 text-[11.5px] font-medium rounded-[5px] transition-colors capitalize',
                statusFilter === f ? 'bg-indigo text-white' : 'text-text-3 hover:text-text-2 bg-white border border-border'
              )}>
              {f === 'all' ? `All (${audit.results.length})` : f === 'missing' ? `Missing (${missing})` : f === 'partial' ? `Partial (${partial})` : `Present (${present})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[11px] text-text-3 mr-1">Risk:</span>
          {(['all', 'high', 'medium', 'low'] as RiskFilter[]).map(r => (
            <button key={r} onClick={() => setRiskFilter(r)}
              className={cn('px-2.5 py-1 text-[11.5px] font-medium rounded-[5px] transition-colors capitalize',
                riskFilter === r
                  ? r === 'all' ? 'bg-indigo text-white' : ''
                  : 'text-text-3 hover:text-text-2'
              )}
              style={riskFilter === r && r !== 'all'
                ? { background: RISK_CONFIG[r].bg, color: RISK_CONFIG[r].color }
                : {}
              }
            >
              {r === 'all' ? 'All' : RISK_CONFIG[r].label}
            </button>
          ))}
        </div>
      </div>

      {/* Clauses */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {displayed.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-[13px] text-text-3">No clauses match this filter.</p>
          </div>
        ) : (
          displayed.map(r => <ClauseRow key={r.id} result={r} multiPlaybook={multiPlaybook} onUpdate={onResultUpdate} />)
        )}
      </div>
    </div>
  )
}

// ─── History item ─────────────────────────────────────────────────────────────

function HistoryItem({
  audit, active, onClick,
}: { audit: ClauseAuditDTO; active: boolean; onClick: () => void }) {
  const playbook = audit.playbook_types.map(p => PLAYBOOK_LABELS[p] ?? p.toUpperCase()).join('+')
  const missing = audit.results.filter(r => r.status === 'missing').length

  return (
    <button onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-[8px] transition-colors border',
        active ? 'bg-indigo-lt border-indigo-mid' : 'bg-white border-border hover:border-indigo-mid',
      )}>
      <div className="flex items-center justify-between mb-0.5">
        <span className={cn('text-[12px] font-bold', active ? 'text-indigo' : 'text-text')}>
          {playbook}
        </span>
        <span className={cn('text-[11.5px] font-bold', active ? 'text-indigo' : 'text-text-2')}>
          {audit.overall_score?.toFixed(0)}%
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-3">{formatDate(audit.created_at)}</span>
        {missing > 0 && (
          <span className="text-[10.5px] font-semibold text-danger">{missing} missing</span>
        )}
      </div>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ClauseAuditPage() {
  const { data: contractsData } = useContracts({ status_filter: 'ready' })
  const { data: playbooksData } = usePlaybooks()
  const contracts = contractsData?.contracts ?? []
  const playbooks = playbooksData?.playbooks ?? []

  const [contractId, setContractId]     = useState<string>('')
  const [playbookTypes, setPlaybookTypes] = useState<string[]>([])
  const [combinedSSA, setCombinedSSA]   = useState(false)
  const [currentAudit, setCurrentAudit] = useState<ClauseAuditDTO | null>(null)
  const [detectedTypes, setDetectedTypes] = useState<string[] | null>(null)
  const [pickerOpen, setPickerOpen]     = useState(false)

  const detectMutation  = useDetectPlaybook()
  const runMutation     = useRunAudit()
  const { data: historyData } = useAuditHistory(contractId || null)
  const history = historyData?.audits ?? []

  // Auto-set first contract
  useEffect(() => {
    if (contracts.length > 0 && !contractId) {
      setContractId(contracts[0].id)
    }
  }, [contracts, contractId])

  // Auto-detect playbook when contract changes
  useEffect(() => {
    if (!contractId) return
    setDetectedTypes(null)
    setCurrentAudit(null)
    // Show most recent audit for this contract if available
  }, [contractId])

  // Load most recent audit when history loads
  useEffect(() => {
    if (history.length > 0 && !currentAudit) {
      setCurrentAudit(history[0])
      setPlaybookTypes(history[0].playbook_types)
    }
  }, [history, currentAudit])

  async function handleDetect() {
    if (!contractId) return
    const result = await detectMutation.mutateAsync(contractId)
    const types = result.playbook_types.filter((t: string) => t !== 'other')
    setDetectedTypes(types)
    if (types.length > 0) {
      setPlaybookTypes(types)
      setCombinedSSA(types.includes('sha') && types.includes('ssa'))
    }
  }

  function togglePlaybook(key: string) {
    setPlaybookTypes(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      return [...prev, key]
    })
  }

  // Sync SHA+SSA combined toggle
  const effectivePlaybooks = combinedSSA
    ? [...new Set([...playbookTypes, 'sha', 'ssa'])]
    : playbookTypes

  async function handleRun() {
    if (!contractId || effectivePlaybooks.length === 0) return
    const result = await runMutation.mutateAsync({ contractId, playbookTypes: effectivePlaybooks })
    setCurrentAudit(result)
  }

  const selectedContract = contracts.find(c => c.id === contractId)
  const isRunning = runMutation.isPending

  const hasSHAorSSA = playbookTypes.includes('sha') || playbookTypes.includes('ssa')

  // Fix: reset combinedSSA when neither SHA nor SSA is selected
  useEffect(() => {
    if (!hasSHAorSSA) setCombinedSSA(false)
  }, [hasSHAorSSA])

  function handleResultUpdate(updated: ClauseResultDTO) {
    setCurrentAudit(prev => {
      if (!prev) return prev
      return {
        ...prev,
        results: prev.results.map(r => r.id === updated.id ? updated : r),
      }
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar breadcrumb={[{ label: 'AI Tools' }, { label: 'Clause Audit' }]} />

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left panel ── */}
        <div className="w-[264px] flex-shrink-0 flex flex-col overflow-y-auto border-r border-border bg-surface gap-5 p-5">

          {/* Contract selector */}
          <div>
            <p className="text-[11px] font-bold text-text-3 uppercase tracking-[0.6px] mb-2">Document</p>
            {contracts.length === 0 ? (
              <p className="text-[12px] text-text-3">No ready contracts. Upload one in The Vault first.</p>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setPickerOpen(o => !o)}
                  className="w-full flex items-center gap-2 p-2.5 bg-white border border-border rounded-[8px] text-left hover:border-indigo-mid transition-colors"
                >
                  <FileText size={14} className="text-indigo flex-shrink-0" />
                  <span className="flex-1 text-[12.5px] font-medium text-text truncate">
                    {selectedContract?.name ?? 'Select contract…'}
                  </span>
                  <ChevronDown size={12} className="text-text-3 flex-shrink-0" />
                </button>
                {pickerOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-border rounded-[8px] shadow-lg z-20 max-h-[200px] overflow-y-auto py-1">
                    {contracts.map(c => (
                      <button key={c.id} onClick={() => { setContractId(c.id); setPickerOpen(false) }}
                        className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface transition-colors',
                          c.id === contractId && 'bg-indigo-lt')}>
                        <span className={cn('text-[12.5px] font-medium truncate', c.id === contractId ? 'text-indigo' : 'text-text')}>
                          {c.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Playbook selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-text-3 uppercase tracking-[0.6px]">Playbook</p>
              <button
                onClick={handleDetect}
                disabled={!contractId || detectMutation.isPending}
                className="flex items-center gap-1 text-[10.5px] font-medium text-indigo hover:underline disabled:opacity-40"
              >
                {detectMutation.isPending
                  ? <Loader2 size={10} className="animate-spin" />
                  : <Sparkles size={10} />}
                Auto-detect
              </button>
            </div>

            {detectedTypes !== null && (
              <div className={cn('flex items-center gap-1.5 mb-2 px-2.5 py-1.5 rounded-[6px] text-[11px] font-medium',
                detectedTypes.length > 0 ? 'bg-indigo-lt text-indigo' : 'bg-surface text-text-3'
              )}>
                <Sparkles size={10} />
                {detectedTypes.length > 0
                  ? `Detected: ${detectedTypes.map(t => PLAYBOOK_LABELS[t] ?? t.toUpperCase()).join(' + ')}`
                  : 'Could not auto-detect — please select manually'}
              </div>
            )}

            <div className="space-y-1.5">
              {playbooks.map(pb => {
                const active = playbookTypes.includes(pb.key)
                return (
                  <button key={pb.key} onClick={() => togglePlaybook(pb.key)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-[7px] border text-left transition-colors',
                      active ? 'bg-indigo-lt border-indigo-mid' : 'bg-white border-border hover:border-indigo-mid',
                    )}>
                    <div className={cn('w-4 h-4 rounded-[3px] border flex items-center justify-center flex-shrink-0',
                      active ? 'bg-indigo border-indigo' : 'border-border-dk')}>
                      {active && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-[12px] font-semibold', active ? 'text-indigo' : 'text-text')}>
                        {pb.short}
                      </p>
                      <p className="text-[10.5px] text-text-3 truncate">{pb.name}</p>
                    </div>
                    <span className="text-[10px] text-text-3">{pb.clause_count}c</span>
                  </button>
                )
              })}
            </div>

            {/* SHA+SSA combined toggle */}
            {hasSHAorSSA && (
              <button
                onClick={() => setCombinedSSA(v => !v)}
                className={cn(
                  'mt-2.5 w-full flex items-center gap-2 px-3 py-2 rounded-[7px] border text-left transition-colors text-[11.5px] font-medium',
                  combinedSSA ? 'bg-purple-lt border-purple/30 text-purple' : 'bg-white border-border text-text-2 hover:border-border-dk',
                )}
                style={{ '--tw-bg-opacity': 1 } as React.CSSProperties}
              >
                <div className={cn('w-4 h-4 rounded-[3px] border flex items-center justify-center flex-shrink-0',
                  combinedSSA ? 'bg-purple border-purple' : 'border-border-dk')}>
                  {combinedSSA && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                Combined SHA + SSA document
              </button>
            )}
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={!contractId || effectivePlaybooks.length === 0 || isRunning}
            className="flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold text-white bg-indigo rounded-[8px] hover:bg-indigo-dk transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isRunning
              ? <><Loader2 size={14} className="animate-spin" /> Analysing…</>
              : <><RotateCw size={14} /> Run Audit</>}
          </button>

          {runMutation.isError && (
            <div className="flex items-start gap-2 px-3 py-2 bg-danger-lt border border-danger/20 rounded-[7px]">
              <X size={12} className="text-danger flex-shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-danger leading-snug">
                {(runMutation.error as Error)?.message ?? 'Audit failed'}
              </p>
            </div>
          )}

          {/* Audit history */}
          {history.length > 0 && (
            <div className="flex-1 min-h-0">
              <p className="text-[11px] font-bold text-text-3 uppercase tracking-[0.6px] mb-2">History</p>
              <div className="space-y-1.5">
                {history.map(a => (
                  <HistoryItem
                    key={a.id}
                    audit={a}
                    active={currentAudit?.id === a.id}
                    onClick={() => { setCurrentAudit(a); setPlaybookTypes(a.playbook_types) }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Main area ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {isRunning ? (
            <div className="flex flex-col items-center justify-center gap-3 h-full">
              <Loader2 size={32} className="text-indigo animate-spin" />
              <div className="text-center">
                <p className="text-[14px] font-semibold text-text-2">Analysing contract…</p>
                <p className="text-[12.5px] text-text-3 mt-1">
                  Checking {effectivePlaybooks.map(p => PLAYBOOK_LABELS[p] ?? p.toUpperCase()).join(' + ')} playbook clauses
                </p>
              </div>
            </div>
          ) : currentAudit ? (
            <ResultsPanel audit={currentAudit} onResultUpdate={handleResultUpdate} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 h-full px-8 text-center">
              <div className="w-12 h-12 bg-indigo-lt rounded-[12px] flex items-center justify-center">
                <Bell size={22} className="text-indigo" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-text-2">Run your first audit</p>
                <p className="text-[13px] text-text-3 mt-1 max-w-[340px]">
                  Select a contract and playbook type on the left, then click{' '}
                  <strong className="text-text">Run Audit</strong> to check clause coverage.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 mt-2 p-4 bg-surface border border-border rounded-[10px] text-left max-w-[360px]">
                <p className="text-[11.5px] font-bold text-text-3 uppercase tracking-[0.5px]">What this checks</p>
                <div className="space-y-1.5">
                  {[
                    ['✓', 'Present', 'Clause clearly found and adequately drafted'],
                    ['~', 'Partial', 'Clause exists but incomplete or one-sided'],
                    ['✗', 'Missing', 'Clause absent — includes suggested draft language'],
                  ].map(([icon, label, desc]) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="text-[11px] font-bold w-4 flex-shrink-0 mt-0.5">{icon}</span>
                      <span className="text-[12px] text-text-2">
                        <strong>{label}</strong> — {desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {pickerOpen && <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />}
    </div>
  )
}
