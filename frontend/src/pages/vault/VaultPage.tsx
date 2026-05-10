import { useState, useRef, useCallback, useEffect } from 'react'
import Markdown from 'react-markdown'
import {
  Search, Plus, X, Download, Folder, FileText, Sparkles, Loader2,
  Trash2, FolderInput, Pencil, Check, ChevronDown, MessageSquare,
  Send, MoreHorizontal, Eye, SlidersHorizontal, ChevronLeft, ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import {
  useContracts, useCollections, useCreateCollection, useUpdateCollection,
  useDeleteCollection, useUploadContract, useContractStatus, useDeleteContract,
  useBulkDelete, useVaultSearch, useDownloadContract, useRenameContract,
  useMoveToCollection, useVaultChat, useContractViewUrl, formatFileSize,
} from '@/hooks/useVault'
import { formatDate, cn } from '@/lib/utils'
import type { ContractDTO, CollectionDTO, ChatMessageDTO, SearchResultDTO } from '@/lib/api'

const PAGE_SIZE = 25

// ─── Colour palette ───────────────────────────────────────────────────────────

const COLLECTION_COLORS = [
  '#4338CA', '#7C3AED', '#059669', '#D97706',
  '#DC2626', '#0369A1', '#475569', '#16A34A',
]

// ─── Contract type badge colours ──────────────────────────────────────────────

const TYPE_BADGE: Record<string, { bg: string; color: string }> = {
  'Share Subscription Agreement': { bg: '#EEF2FF', color: '#4338CA' },
  'Shareholders Agreement':       { bg: '#F5F3FF', color: '#7C3AED' },
  'Share Purchase Agreement':     { bg: '#FEE2E2', color: '#DC2626' },
  'Business Transfer Agreement':  { bg: '#FEF3C7', color: '#D97706' },
  'Loan Agreement':               { bg: '#D1FAE5', color: '#059669' },
  MSA:                            { bg: '#DBEAFE', color: '#1D4ED8' },
  NDA:                            { bg: '#EDE9FE', color: '#6D28D9' },
  Other:                          { bg: '#F1F5F9', color: '#475569' },
}

function typeBadgeStyle(type: string | null) {
  const t = type ?? 'Other'
  return TYPE_BADGE[t] ?? TYPE_BADGE['Other']
}

// ─── Expiry helpers ───────────────────────────────────────────────────────────

function expiryBadge(dateStr: string | null): { label: string; color: string; bg: string } | null {
  if (!dateStr) return null
  const expiry = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysLeft = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0)  return { label: 'Expired',  color: '#DC2626', bg: '#FEE2E2' }
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, color: '#D97706', bg: '#FEF3C7' }
  return null
}

// ─── File icon ────────────────────────────────────────────────────────────────

function FileIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2.5 1.5h5.5l3 3v7a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9.5a.5.5 0 0 1 .5-.5z" stroke={color} strokeWidth="1.1" />
      <path d="M8 1.5V4.5H11" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

// ─── Upload progress item ─────────────────────────────────────────────────────

function UploadItem({ contractId, filename, uploading, onDone }: {
  contractId: string; filename: string; uploading?: boolean; onDone: () => void
}) {
  const isTemp = uploading || contractId.startsWith('uploading-')
  const { data } = useContractStatus(isTemp ? null : contractId, !isTemp)
  const st = isTemp ? 'uploading' : (data?.status ?? 'pending')

  const progress = st === 'ready' ? 100 : st === 'failed' ? 100 : st === 'uploading' ? 8 : st === 'processing' ? 60 : 20
  const barColor = st === 'ready' ? '#059669' : st === 'failed' ? '#DC2626' : '#4338CA'

  const chip = st === 'ready'     ? { label: 'Complete',   cls: 'bg-success-lt text-success' }
    : st === 'failed'             ? { label: 'Failed',     cls: 'bg-danger-lt text-danger' }
    : st === 'uploading'          ? { label: 'Uploading…', cls: 'bg-indigo-lt text-indigo' }
    : st === 'processing'         ? { label: 'Processing', cls: 'bg-warning-lt text-warning' }
    :                               { label: 'Queued',     cls: 'bg-surface text-text-3 border border-border' }

  const iconBg    = st === 'failed' ? 'bg-danger-lt'  : 'bg-indigo-lt'
  const iconColor = st === 'failed' ? '#DC2626'        : '#4338CA'

  useEffect(() => {
    if (st === 'ready' || st === 'failed') {
      const t = setTimeout(onDone, 2000)
      return () => clearTimeout(t)
    }
  }, [st, onDone])

  return (
    <div className="flex items-center gap-3">
      <div className={cn('w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0', iconBg)}>
        <FileIcon color={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-text truncate mb-1.5">{filename}</p>
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, backgroundColor: barColor }} />
        </div>
      </div>
      <span className={cn('text-[10.5px] font-semibold px-2 py-0.5 rounded-pill flex-shrink-0', chip.cls)}>{chip.label}</span>
    </div>
  )
}

// ─── PDF Viewer Modal ─────────────────────────────────────────────────────────

function PdfViewerModal({ contract, onClose }: { contract: ContractDTO; onClose: () => void }) {
  const { data: url, isLoading } = useContractViewUrl(contract.id)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="w-full max-w-5xl h-full max-h-[90vh] bg-white rounded-[12px] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <FileIcon color="#4338CA" />
            <p className="text-[13px] font-semibold text-text truncate max-w-[500px]">{contract.name}</p>
            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px]"
              style={{ background: typeBadgeStyle(contract.contract_type).bg, color: typeBadgeStyle(contract.contract_type).color }}>
              {contract.contract_type ?? 'Unknown'}
            </span>
          </div>
          <button onClick={onClose} className="text-text-3 hover:text-text transition-colors p-1">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden bg-[#F1F5F9]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full gap-2">
              <Loader2 size={20} className="animate-spin text-indigo" />
              <p className="text-sm text-text-2">Loading document…</p>
            </div>
          ) : !url ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <FileText size={32} className="text-text-3" />
              <p className="text-sm text-text-2">Preview not available</p>
            </div>
          ) : contract.file_type === 'pdf' ? (
            <iframe src={`${url}#toolbar=1&view=FitH`} className="w-full h-full border-0" title={contract.name} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <FileText size={32} className="text-text-3" />
              <p className="text-sm text-text-2">In-browser preview is only available for PDF files.</p>
              <a href={url} target="_blank" rel="noreferrer"
                className="px-4 py-2 bg-indigo text-white text-sm font-semibold rounded-[7px] hover:bg-indigo-dk transition-colors">
                <Download size={13} className="inline mr-1.5" />Download to view
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

interface ChatMsg { role: 'user' | 'assistant'; content: string; sources?: { contract_name: string; snippet: string }[] }

function ChatPanel({
  contracts,
  selectedIds,
  onClose,
}: {
  contracts: ContractDTO[]
  selectedIds: Set<string>
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [scopeIds, setScopeIds] = useState<Set<string>>(
    selectedIds.size > 0 ? new Set(selectedIds) : new Set(contracts.filter(c => c.status === 'ready').map(c => c.id))
  )
  const [scopeOpen, setScopeOpen] = useState(false)
  const chatMutation = useVaultChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [input])

  const readyContracts = contracts.filter(c => c.status === 'ready')

  async function handleSend() {
    const text = input.trim()
    if (!text || scopeIds.size === 0 || chatMutation.isPending) return
    setInput('')

    const userMsg: ChatMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])

    const history: ChatMessageDTO[] = messages.map(m => ({ role: m.role, content: m.content }))

    chatMutation.mutate(
      { contractIds: [...scopeIds], message: text, history },
      {
        onSuccess: (data) => {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.answer,
            sources: data.sources,
          }])
        },
        onError: () => {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Something went wrong. Please try again.',
          }])
        },
      }
    )
  }

  return (
    <div className="w-[380px] flex-shrink-0 border-l border-border bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-indigo" />
          <p className="text-[13px] font-bold text-text">Ask the Vault</p>
        </div>
        <button onClick={onClose} className="text-text-3 hover:text-text transition-colors"><X size={14} /></button>
      </div>

      <div className="px-4 py-2.5 border-b border-border flex-shrink-0 relative">
        <button onClick={() => setScopeOpen(o => !o)} className="w-full flex items-center gap-2 text-left">
          <Folder size={12} className="text-text-3 flex-shrink-0" />
          <span className="text-[12px] text-text-2 flex-1 truncate">
            {scopeIds.size === readyContracts.length
              ? 'All documents'
              : `${scopeIds.size} document${scopeIds.size !== 1 ? 's' : ''} selected`}
          </span>
          <ChevronDown size={12} className="text-text-3 flex-shrink-0" />
        </button>

        {scopeOpen && (
          <div className="absolute top-full left-0 right-0 z-20 bg-white border border-border shadow-lg max-h-[240px] overflow-y-auto rounded-b-[10px]">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Select documents</span>
              <button onClick={() => setScopeIds(new Set(readyContracts.map(c => c.id)))}
                className="text-[11px] text-indigo font-medium hover:underline">Select all</button>
            </div>
            {readyContracts.map(c => {
              const checked = scopeIds.has(c.id)
              return (
                <button key={c.id} className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface transition-colors', checked ? 'bg-indigo-lt' : '')}
                  onClick={() => setScopeIds(prev => {
                    const next = new Set(prev)
                    next.has(c.id) ? next.delete(c.id) : next.add(c.id)
                    return next
                  })}>
                  <div className={cn('w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center flex-shrink-0', checked ? 'bg-indigo border-indigo' : 'border-border-dk')}>
                    {checked && <Check size={9} className="text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-[12px] text-text truncate">{c.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {scopeOpen && <div className="fixed inset-0 z-10" onClick={() => setScopeOpen(false)} />}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
            <div className="w-10 h-10 rounded-[10px] bg-indigo-lt flex items-center justify-center">
              <MessageSquare size={18} className="text-indigo" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text-2">Ask anything about your contracts</p>
              <p className="text-[12px] text-text-3 mt-1">What termination rights apply? Who are the parties?<br />What is the governing law?</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] bg-indigo text-white text-[12.5px] leading-relaxed px-3.5 py-2.5 rounded-[10px] rounded-tr-[3px]">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[95%]">
                <div className="bg-surface border border-border text-[12.5px] text-text leading-relaxed px-3.5 py-2.5 rounded-[10px] rounded-tl-[3px] prose prose-sm max-w-none
                  [&>p]:mb-2 [&>p:last-child]:mb-0
                  [&>ul]:mb-2 [&>ul]:pl-4 [&>ul>li]:mb-0.5 [&>ul>li]:list-disc
                  [&>ol]:mb-2 [&>ol]:pl-4 [&>ol>li]:mb-0.5 [&>ol>li]:list-decimal
                  [&>h1]:text-[13px] [&>h1]:font-bold [&>h1]:mb-1
                  [&>h2]:text-[12.5px] [&>h2]:font-bold [&>h2]:mb-1
                  [&>h3]:text-[12px] [&>h3]:font-semibold [&>h3]:mb-1
                  [&_strong]:font-semibold [&_strong]:text-text
                  [&_em]:italic">
                  <Markdown>{msg.content}</Markdown>
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.sources.map((s, si) => (
                      <div key={si} className="flex items-center gap-1.5 bg-indigo-lt border border-indigo-mid rounded-pill px-2.5 py-1">
                        <FileText size={10} className="text-indigo flex-shrink-0" />
                        <span className="text-[10.5px] font-medium text-indigo truncate max-w-[160px]">{s.contract_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex items-start gap-2">
            <div className="bg-surface border border-border px-3.5 py-2.5 rounded-[10px] rounded-tl-[3px]">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-text-3 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-text-3 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-text-3 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        {scopeIds.size === 0 && (
          <p className="text-[11px] text-danger mb-2">Select at least one document above to chat.</p>
        )}
        <div className="flex items-end gap-2 bg-surface border border-border rounded-[10px] px-3 py-2.5 focus-within:border-indigo focus-within:ring-1 focus-within:ring-indigo/20 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Ask a question…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-[12.5px] text-text placeholder:text-text-3 outline-none leading-relaxed max-h-[160px] overflow-y-auto"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || scopeIds.size === 0 || chatMutation.isPending}
            className="flex-shrink-0 w-7 h-7 rounded-[6px] bg-indigo text-white flex items-center justify-center hover:bg-indigo-dk transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={12} />
          </button>
        </div>
        <p className="text-[10.5px] text-text-3 mt-1.5">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  )
}

// ─── Contract detail panel ────────────────────────────────────────────────────

function ContractDetail({
  contract, onClose, onDelete, onView, onMoveToCollection, collections,
}: {
  contract: ContractDTO
  onClose: () => void
  onDelete: (id: string) => void
  onView: (c: ContractDTO) => void
  onMoveToCollection: (id: string, collId: string | null) => void
  collections: CollectionDTO[]
}) {
  const downloadMutation = useDownloadContract()
  const renameMutation = useRenameContract()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(contract.name)
  const [moveOpen, setMoveOpen] = useState(false)

  const st = typeBadgeStyle(contract.contract_type)
  const badge = expiryBadge(contract.expiry_date)
  const fields: { label: string; value: string | null }[] = [
    { label: 'Parties',        value: (contract.parties ?? []).join(' ↔ ') || null },
    { label: 'Effective date', value: contract.effective_date ? formatDate(contract.effective_date) : null },
    { label: 'Expiry date',    value: contract.expiry_date ? formatDate(contract.expiry_date) : null },
    { label: 'Jurisdiction',   value: contract.jurisdiction },
    { label: 'File size',      value: formatFileSize(contract.file_size) },
    { label: 'Pages',          value: contract.page_count ? `${contract.page_count} pages` : null },
    { label: 'Uploaded',       value: formatDate(contract.created_at) },
  ]

  function saveRename() {
    if (editName.trim() && editName !== contract.name) {
      renameMutation.mutate({ id: contract.id, name: editName.trim() })
    }
    setEditing(false)
  }

  return (
    <div className="w-[288px] flex-shrink-0 border-l border-border bg-white flex flex-col overflow-hidden">
      <div className="flex items-start justify-between px-4 py-3.5 border-b border-border">
        <div className="flex-1 min-w-0 pr-2">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(false) }}
                onBlur={saveRename}
                className="flex-1 text-[12.5px] font-semibold text-text border border-indigo rounded-[5px] px-2 py-1 outline-none"
              />
            </div>
          ) : (
            <div className="flex items-start gap-1.5">
              <p className="text-[12.5px] font-semibold text-text leading-snug line-clamp-2">{contract.name}</p>
              <button onClick={() => { setEditing(true); setEditName(contract.name) }}
                className="flex-shrink-0 text-text-3 hover:text-indigo transition-colors mt-0.5">
                <Pencil size={11} />
              </button>
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px]"
              style={{ background: st.bg, color: st.color }}>
              {contract.contract_type ?? 'Unknown type'}
            </span>
            {badge && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px]"
                style={{ background: badge.bg, color: badge.color }}>
                <AlertTriangle size={9} />{badge.label}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-text-3 hover:text-text flex-shrink-0 mt-0.5"><X size={14} /></button>
      </div>

      <div className="px-4 py-2.5 border-b border-border">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
          <span className={cn('w-1.5 h-1.5 rounded-full',
            contract.status === 'ready' ? 'bg-success' : contract.status === 'failed' ? 'bg-danger' : 'bg-warning animate-pulse'
          )} />
          {contract.status === 'ready' ? 'Analyzed' : contract.status === 'failed' ? 'Failed' : 'Processing'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {fields.filter(f => f.value).map(f => (
          <div key={f.label}>
            <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-0.5">{f.label}</p>
            <p className="text-[12px] text-text-2">{f.value}</p>
          </div>
        ))}
        {contract.summary && (
          <div>
            <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1">Summary</p>
            <p className="text-[11.5px] text-text-2 leading-relaxed">{contract.summary}</p>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border flex flex-col gap-2">
        {contract.file_type === 'pdf' && (
          <button onClick={() => onView(contract)}
            className="flex items-center justify-center gap-2 w-full py-2 bg-indigo text-white text-[12.5px] font-semibold rounded-[7px] hover:bg-indigo-dk transition-colors">
            <Eye size={13} />View document
          </button>
        )}
        <button onClick={() => downloadMutation.mutate(contract.id)} disabled={downloadMutation.isPending}
          className="flex items-center justify-center gap-2 w-full py-2 border border-border text-text-2 text-[12.5px] font-medium rounded-[7px] hover:bg-surface transition-colors disabled:opacity-60">
          {downloadMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}Download
        </button>

        <div className="relative">
          <button onClick={() => setMoveOpen(o => !o)}
            className="flex items-center justify-center gap-2 w-full py-2 border border-border text-text-2 text-[12.5px] font-medium rounded-[7px] hover:bg-surface transition-colors">
            <FolderInput size={13} />Move to collection
          </button>
          {moveOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-border rounded-[8px] shadow-lg py-1 z-20">
              <button onClick={() => { onMoveToCollection(contract.id, null); setMoveOpen(false) }}
                className="w-full text-left px-3 py-2 text-[12px] text-text-2 hover:bg-surface transition-colors">
                No collection
              </button>
              {collections.map(c => (
                <button key={c.id} onClick={() => { onMoveToCollection(contract.id, c.id); setMoveOpen(false) }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-[12px] text-text-2 hover:bg-surface transition-colors">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => { onDelete(contract.id); onClose() }}
          className="flex items-center justify-center gap-2 w-full py-2 border border-danger/30 text-danger text-[12.5px] font-medium rounded-[7px] hover:bg-danger-lt transition-colors">
          <Trash2 size={13} />Delete
        </button>
      </div>
    </div>
  )
}

// ─── Sidebar items ────────────────────────────────────────────────────────────

function SidebarItem({ label, count, icon, active, onClick }: {
  label: string; count?: number; icon: React.ReactNode; active: boolean; onClick: () => void
}) {
  return (
    <div onClick={onClick}
      className={cn('flex items-center gap-2 px-2 py-1.5 rounded-[6px] cursor-pointer text-[13px] font-medium transition-colors',
        active ? 'bg-indigo-lt text-indigo' : 'text-text-2 hover:bg-border')}>
      <span className={active ? 'text-indigo' : 'text-text-3'}>{icon}</span>
      <span className="truncate flex-1">{label}</span>
      {count !== undefined && (
        <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded-pill',
          active ? 'bg-indigo-mid text-indigo' : 'bg-border text-text-3')}>{count}</span>
      )}
    </div>
  )
}

function CollectionItem({ coll, active, onClick, onRename, onRecolor, onDelete }: {
  coll: CollectionDTO; active: boolean; onClick: () => void
  onRename: (id: string, name: string) => void
  onRecolor: (id: string, color: string) => void
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(coll.name)
  const [showColors, setShowColors] = useState(false)

  return (
    <div className={cn('flex items-center gap-2 px-2 py-1.5 rounded-[6px] cursor-pointer text-[13px] font-medium transition-colors group relative',
      active ? 'bg-indigo-lt text-indigo' : 'text-text-2 hover:bg-border')}
      onClick={onClick}>
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: coll.color }} />

      {editing ? (
        <input autoFocus value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onRename(coll.id, editName); setEditing(false) }
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={() => { onRename(coll.id, editName); setEditing(false) }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 text-[12.5px] font-medium text-text bg-white border border-indigo rounded-[4px] px-1.5 py-0.5 outline-none" />
      ) : (
        <span className="truncate flex-1">{coll.name}</span>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o) }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-[4px] hover:bg-black/10 text-text-3 flex-shrink-0"
      >
        <MoreHorizontal size={12} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShowColors(false) }} />
          <div className="absolute left-full top-0 ml-1 w-[160px] bg-white border border-border rounded-[8px] shadow-lg py-1 z-20" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setEditing(true); setMenuOpen(false) }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-[12px] text-text-2 hover:bg-surface transition-colors">
              <Pencil size={11} />Rename
            </button>
            <button onClick={() => setShowColors(o => !o)}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-[12px] text-text-2 hover:bg-surface transition-colors">
              <span className="w-3 h-3 rounded-full" style={{ background: coll.color }} />Change colour
            </button>
            {showColors && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                {COLLECTION_COLORS.map(c => (
                  <button key={c} onClick={() => { onRecolor(coll.id, c); setMenuOpen(false); setShowColors(false) }}
                    className="w-4 h-4 rounded-full hover:scale-110 transition-transform"
                    style={{ background: c }} />
                ))}
              </div>
            )}
            <div className="h-px bg-border mx-2 my-1" />
            <button onClick={() => { onDelete(coll.id); setMenuOpen(false) }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-[12px] text-danger hover:bg-danger-lt transition-colors">
              <Trash2 size={11} />Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Bulk action toolbar ──────────────────────────────────────────────────────

function BulkToolbar({ count, collections, onBulkDelete, onBulkMove, onClear }: {
  count: number
  collections: CollectionDTO[]
  onBulkDelete: () => void
  onBulkMove: (collId: string | null) => void
  onClear: () => void
}) {
  const [moveOpen, setMoveOpen] = useState(false)

  return (
    <div className="flex items-center gap-3 px-6 py-2.5 bg-indigo-lt border-b border-indigo-mid flex-shrink-0">
      <span className="text-[12.5px] font-semibold text-indigo">{count} selected</span>
      <div className="flex-1" />

      <div className="relative">
        <button onClick={() => setMoveOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-indigo border border-indigo-mid bg-white rounded-[6px] hover:bg-surface transition-colors">
          <FolderInput size={12} />Move to
        </button>
        {moveOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMoveOpen(false)} />
            <div className="absolute top-full right-0 mt-1 w-[180px] bg-white border border-border rounded-[8px] shadow-lg py-1 z-20">
              <button onClick={() => { onBulkMove(null); setMoveOpen(false) }}
                className="w-full text-left px-3 py-2 text-[12px] text-text-2 hover:bg-surface transition-colors">
                No collection
              </button>
              {collections.map(c => (
                <button key={c.id} onClick={() => { onBulkMove(c.id); setMoveOpen(false) }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-[12px] text-text-2 hover:bg-surface transition-colors">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button onClick={onBulkDelete}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-danger border border-danger/30 bg-white rounded-[6px] hover:bg-danger-lt transition-colors">
        <Trash2 size={12} />Delete
      </button>
      <button onClick={onClear} className="text-text-3 hover:text-text transition-colors ml-1"><X size={14} /></button>
    </div>
  )
}

// ─── Semantic search modal ────────────────────────────────────────────────────

function SearchModal({ onClose, onSelect }: { onClose: () => void; onSelect: (c: ContractDTO) => void }) {
  const [query, setQuery] = useState('')
  const searchMutation = useVaultSearch()
  const results = searchMutation.data?.results ?? []

  const grouped = results.reduce<{ contract: SearchResultDTO; clauses: SearchResultDTO[] }[]>((acc, r) => {
    const existing = acc.find(g => g.contract.id === r.id)
    if (existing) { existing.clauses.push(r) }
    else { acc.push({ contract: r, clauses: [r] }) }
    return acc
  }, [])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-16" onClick={onClose}>
      <div className="w-[680px] bg-white rounded-[12px] shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
          <Sparkles size={15} className="text-indigo flex-shrink-0" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && query.trim().length >= 2 && searchMutation.mutate(query.trim())}
            placeholder={'Find clauses across all contracts…  e.g. "non-compete", "liability cap"'}
            className="flex-1 text-[13px] text-text placeholder:text-text-3 outline-none" />
          {searchMutation.isPending
            ? <Loader2 size={15} className="text-text-3 animate-spin" />
            : <button onClick={() => query.trim().length >= 2 && searchMutation.mutate(query.trim())}
                className="text-[12px] font-semibold text-indigo hover:underline disabled:opacity-40"
                disabled={query.trim().length < 2}>Search</button>}
          <button onClick={onClose} className="text-text-3 hover:text-text ml-1"><X size={15} /></button>
        </div>

        <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
          {!searchMutation.data && !searchMutation.isPending && (
            <div className="px-6 py-12 text-center">
              <Sparkles size={22} className="text-text-3 mx-auto mb-3" />
              <p className="text-[13px] font-medium text-text-2 mb-1">Search by clause topic, obligation, or concept</p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                {['limitation of liability', 'non-compete', 'termination rights', 'indemnification', 'governing law', 'conditions precedent'].map(ex => (
                  <button key={ex} onClick={() => { setQuery(ex); searchMutation.mutate(ex) }}
                    className="text-[11px] px-2.5 py-1 bg-surface border border-border rounded-pill text-text-2 hover:border-indigo hover:text-indigo transition-colors">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchMutation.data && results.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="text-[13px] text-text-2">No matching clauses found for <span className="font-semibold">"{searchMutation.variables as string}"</span></p>
              <p className="text-xs text-text-3 mt-1">Try a broader term or a related concept</p>
            </div>
          )}

          {grouped.map(({ contract, clauses }) => {
            const st = typeBadgeStyle(contract.contract_type)
            return (
              <div key={contract.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-[5px] flex items-center justify-center flex-shrink-0" style={{ background: st.bg }}>
                    <FileIcon color={st.color} />
                  </div>
                  <span className="text-[12px] font-bold text-text">{contract.name}</span>
                  {contract.contract_type && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-pill ml-1" style={{ background: st.bg, color: st.color }}>
                      {contract.contract_type}
                    </span>
                  )}
                  <button onClick={() => { onSelect(contract); onClose() }}
                    className="ml-auto text-[11px] font-semibold text-indigo hover:underline flex-shrink-0">
                    Open contract →
                  </button>
                </div>
                <div className="space-y-2">
                  {clauses.map((clause, ci) => (
                    <button key={ci} onClick={() => { onSelect(clause); onClose() }}
                      className="w-full text-left bg-surface border border-border rounded-[8px] px-3.5 py-3 hover:border-indigo/40 hover:bg-indigo-lt/30 transition-colors">
                      {clause.section_heading && (
                        <p className="text-[10.5px] font-bold text-indigo uppercase tracking-[0.4px] mb-1.5">
                          {clause.section_heading}
                        </p>
                      )}
                      <p className="text-[12px] text-text-2 leading-relaxed line-clamp-3">{clause.snippet}</p>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {results.length > 0 && (
          <div className="px-5 py-2.5 border-t border-border bg-surface">
            <p className="text-[11px] text-text-3">{results.length} clause{results.length !== 1 ? 's' : ''} found across {grouped.length} contract{grouped.length !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'ready' | 'processing' | 'failed' | 'expiring'
type SortBy = 'date' | 'name' | 'type' | 'expiry'

export function VaultPage() {
  const [activeCollection, setActiveCollection] = useState('all')
  const [search, setSearch]                     = useState('')
  const [sortBy, setSortBy]                     = useState<SortBy>('date')
  const [statusFilter, setStatusFilter]         = useState<StatusFilter>('all')
  const [filterOpen, setFilterOpen]             = useState(false)
  const [page, setPage]                         = useState(1)

  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [selectedDoc, setSelectedDoc]   = useState<ContractDTO | null>(null)
  const [viewingDoc, setViewingDoc]     = useState<ContractDTO | null>(null)
  const [showChat, setShowChat]         = useState(false)
  const [showSearch, setShowSearch]     = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [pendingUploads, setPendingUploads] = useState<{ contractId: string; filename: string; uploading?: boolean }[]>([])
  const [dragging, setDragging]         = useState(false)
  const [showNewColl, setShowNewColl]   = useState(false)
  const [newCollName, setNewCollName]   = useState('')
  const [newCollColor, setNewCollColor] = useState(COLLECTION_COLORS[0])
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const newCollInputRef = useRef<HTMLInputElement>(null)

  // ── Derive server query params ──────────────────────────────────────────────
  const isTypeFilter = activeCollection.startsWith('type:')
  const collId       = !isTypeFilter && activeCollection !== 'all' ? activeCollection : undefined
  const typeFilter   = isTypeFilter ? activeCollection.replace('type:', '') : undefined
  const isExpiring   = statusFilter === 'expiring'
  const apiStatus    = !isExpiring && statusFilter !== 'all' ? statusFilter : undefined

  // Sidebar query: all contracts for type groups + total count (no pagination)
  const { data: sidebarData, isLoading } = useContracts({ limit: 500 })
  const sidebarContracts = sidebarData?.contracts ?? []

  // Main list: server-paginated + sorted
  const mainParams = {
    collection_id: collId,
    contract_type: typeFilter,
    status_filter: apiStatus,
    expiring_soon: isExpiring || undefined,
    sort_by: sortBy,
    sort_dir: 'desc' as const,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  }
  const { data: mainData, isLoading: mainLoading } = useContracts(mainParams)

  const { data: collectionsData } = useCollections()

  const uploadMutation     = useUploadContract()
  const deleteMutation     = useDeleteContract()
  const bulkDeleteMutation = useBulkDelete()
  const createCollMutation = useCreateCollection()
  const updateCollMutation = useUpdateCollection()
  const deleteCollMutation = useDeleteCollection()
  const moveMutation       = useMoveToCollection()

  const collections = collectionsData?.collections ?? []

  // Type groups for sidebar (derived from full sidebar fetch)
  const typeGroups = sidebarContracts.reduce<Record<string, number>>((acc, c) => {
    const t = c.contract_type ?? 'Other'
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  // Main list results
  let displayed = mainData?.contracts ?? []
  const total      = mainData?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Client-side text search within current page
  if (search) {
    const q = search.toLowerCase()
    displayed = displayed.filter(c =>
      c.name.toLowerCase().includes(q) || (c.parties ?? []).some(p => p.toLowerCase().includes(q))
    )
  }

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [activeCollection, statusFilter, sortBy])

  // Reset confirm-delete when list changes
  useEffect(() => { setConfirmDeleteId(null) }, [page, activeCollection, statusFilter])

  const allDisplayedIds = displayed.map(c => c.id)
  const allSelected     = allDisplayedIds.length > 0 && allDisplayedIds.every(id => selected.has(id))
  const someSelected    = selected.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => { const next = new Set(prev); allDisplayedIds.forEach(id => next.delete(id)); return next })
    } else {
      setSelected(prev => new Set([...prev, ...allDisplayedIds]))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    const collectionId = activeCollection !== 'all' && !activeCollection.startsWith('type:') ? activeCollection : undefined
    for (const file of Array.from(files)) {
      const tempId = `uploading-${Date.now()}-${Math.random()}`
      setPendingUploads(prev => [...prev, { contractId: tempId, filename: file.name, uploading: true }])
      try {
        const result = await uploadMutation.mutateAsync({ file, collectionId })
        setPendingUploads(prev => prev.map(u =>
          u.contractId === tempId ? { contractId: result.contract_id, filename: file.name } : u
        ))
      } catch {
        setPendingUploads(prev => prev.filter(u => u.contractId !== tempId))
      }
    }
  }, [uploadMutation, activeCollection])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  function handleDelete(id: string) {
    deleteMutation.mutate(id)
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
    if (selectedDoc?.id === id) setSelectedDoc(null)
    setConfirmDeleteId(null)
    // Go to prev page if last item on page just deleted
    if (displayed.length === 1 && page > 1) setPage(p => p - 1)
  }

  function handleBulkDelete() {
    bulkDeleteMutation.mutate([...selected], {
      onSuccess: () => {
        if (selectedDoc && selected.has(selectedDoc.id)) setSelectedDoc(null)
        setSelected(new Set())
        if (page > 1 && selected.size >= displayed.length) setPage(p => p - 1)
      },
    })
  }

  function handleBulkMove(collId: string | null) {
    selected.forEach(id => moveMutation.mutate({ id, collectionId: collId }))
    setSelected(new Set())
  }

  function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault()
    if (!newCollName.trim()) return
    createCollMutation.mutate({ name: newCollName.trim(), color: newCollColor }, {
      onSuccess: () => { setNewCollName(''); setShowNewColl(false) },
    })
  }

  useEffect(() => { if (showNewColl) newCollInputRef.current?.focus() }, [showNewColl])

  if (isLoading) return (
    <div className="flex-1 flex flex-col">
      <Topbar breadcrumb={[{ label: 'The Vault' }]} />
      <PageLoader />
    </div>
  )

  const activeFilters = statusFilter !== 'all'

  return (
    <div className="flex-1 flex flex-col overflow-hidden" onDragOver={(e) => { e.preventDefault(); setDragging(true) }}>
      <Topbar
        breadcrumb={[{ label: 'The Vault' }]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowChat(o => !o)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border rounded-[7px] transition-colors',
                showChat ? 'bg-indigo text-white border-indigo' : 'text-text-2 border-border-dk bg-white hover:bg-surface')}>
              <MessageSquare size={13} />Ask vault
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium text-text-2 border border-border-dk rounded-[7px] bg-white hover:bg-surface transition-colors">
              <Plus size={13} />Upload
            </button>
            <button onClick={() => setShowSearch(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] font-semibold text-white bg-indigo rounded-[7px] hover:bg-indigo-dk transition-colors">
              <Sparkles size={13} />Search
            </button>
          </div>
        }
      />

      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" multiple className="hidden"
        onChange={(e) => handleFiles(e.target.files)} />

      {/* Upload progress */}
      {pendingUploads.length > 0 && (
        <div className="flex-shrink-0 border-b border-border bg-white">
          <div className="flex items-center gap-2 px-6 py-2 border-b border-border">
            <Loader2 size={13} className="text-indigo animate-spin" />
            <span className="text-[12.5px] font-semibold text-text">Processing uploads</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-pill bg-warning-lt text-warning">{pendingUploads.length} in queue</span>
          </div>
          <div className="px-6 py-3 flex flex-col gap-2.5">
            {pendingUploads.map(u => (
              <UploadItem key={u.contractId} contractId={u.contractId} filename={u.filename} uploading={u.uploading}
                onDone={() => setPendingUploads(prev => prev.filter(x => x.contractId !== u.contractId))} />
            ))}
          </div>
        </div>
      )}

      {someSelected && (
        <BulkToolbar
          count={selected.size}
          collections={collections}
          onBulkDelete={handleBulkDelete}
          onBulkMove={handleBulkMove}
          onClear={() => setSelected(new Set())}
        />
      )}

      <div className="flex-1 flex min-h-0">
        {/* ── Sidebar ── */}
        <div className="w-[220px] flex-shrink-0 border-r border-border bg-surface flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Collections</span>
            <button onClick={() => setShowNewColl(v => !v)}
              className="w-5 h-5 rounded-[5px] border border-border-dk flex items-center justify-center text-text-3 hover:bg-border hover:text-text-2 transition-colors">
              <Plus size={10} />
            </button>
          </div>

          <div className="px-2 pb-4 space-y-0.5">
            {showNewColl && (
              <form onSubmit={handleCreateCollection} className="px-2 mb-2">
                <input ref={newCollInputRef} value={newCollName} onChange={(e) => setNewCollName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setShowNewColl(false)}
                  placeholder="Collection name…"
                  className="w-full text-xs px-2.5 py-1.5 border border-indigo rounded-[6px] outline-none bg-white text-text mb-1.5" />
                <div className="flex gap-1 mb-1.5 flex-wrap">
                  {COLLECTION_COLORS.map(c => (
                    <button type="button" key={c} onClick={() => setNewCollColor(c)}
                      className={cn('w-4 h-4 rounded-full transition-transform hover:scale-110', newCollColor === c ? 'ring-2 ring-offset-1 ring-indigo' : '')}
                      style={{ background: c }} />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button type="submit" disabled={createCollMutation.isPending}
                    className="flex-1 text-[11px] font-semibold py-1 bg-indigo text-white rounded-[5px] hover:bg-indigo-dk transition-colors">
                    {createCollMutation.isPending ? '…' : 'Create'}
                  </button>
                  <button type="button" onClick={() => setShowNewColl(false)}
                    className="px-2 py-1 text-[11px] text-text-2 border border-border rounded-[5px] hover:bg-border transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <SidebarItem label="All Documents" count={sidebarData?.total ?? 0} icon={<Folder size={13} />}
              active={activeCollection === 'all'} onClick={() => { setActiveCollection('all'); setPage(1) }} />

            {collections.length > 0 && (
              <>
                <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider px-2 pt-3 pb-1">My Collections</p>
                {collections.map(c => (
                  <CollectionItem key={c.id} coll={c}
                    active={activeCollection === c.id}
                    onClick={() => { setActiveCollection(c.id); setPage(1) }}
                    onRename={(id, name) => updateCollMutation.mutate({ id, name })}
                    onRecolor={(id, color) => updateCollMutation.mutate({ id, color })}
                    onDelete={(id) => { deleteCollMutation.mutate(id); if (activeCollection === id) { setActiveCollection('all'); setPage(1) } }}
                  />
                ))}
              </>
            )}

            {Object.keys(typeGroups).length > 0 && (
              <>
                <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider px-2 pt-3 pb-1">By Type</p>
                {Object.entries(typeGroups).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <SidebarItem key={type} label={type} count={count} icon={<FileText size={13} />}
                    active={activeCollection === `type:${type}`}
                    onClick={() => { setActiveCollection(`type:${type}`); setPage(1) }} />
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Contract list ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border flex-shrink-0 bg-white">
            <div className="flex items-center gap-2 bg-surface border border-border rounded-[7px] px-3 py-1.5 flex-1 max-w-[260px]">
              <Search size={12} className="text-text-3 flex-shrink-0" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name or party…"
                className="border-none outline-none bg-transparent text-[12px] text-text placeholder:text-text-3 w-full" />
              {search && <button onClick={() => setSearch('')} className="text-text-3 hover:text-text"><X size={11} /></button>}
            </div>

            {/* Status filter */}
            <div className="relative">
              <button onClick={() => setFilterOpen(o => !o)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium border rounded-[6px] transition-colors',
                  activeFilters ? 'bg-indigo-lt text-indigo border-indigo-mid' : 'border-border text-text-2 hover:bg-surface')}>
                <SlidersHorizontal size={12} />
                {activeFilters
                  ? statusFilter === 'expiring' ? 'Expiring soon'
                    : statusFilter === 'ready' ? 'Analyzed'
                    : statusFilter === 'processing' ? 'Processing'
                    : 'Failed'
                  : 'Filters'
                }
              </button>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 w-[180px] bg-white border border-border rounded-[8px] shadow-lg py-2 z-20">
                    <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider px-3 pb-1.5">Status</p>
                    {([
                      { key: 'all',        label: 'All' },
                      { key: 'ready',      label: 'Analyzed' },
                      { key: 'processing', label: 'Processing' },
                      { key: 'failed',     label: 'Failed' },
                      { key: 'expiring',   label: 'Expiring soon (30d)' },
                    ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => (
                      <button key={key} onClick={() => { setStatusFilter(key); setFilterOpen(false) }}
                        className={cn('w-full text-left flex items-center gap-2 px-3 py-1.5 text-[12px] transition-colors',
                          statusFilter === key ? 'text-indigo font-semibold' : 'text-text-2 hover:bg-surface')}>
                        {statusFilter === key && <Check size={11} className="text-indigo flex-shrink-0" />}
                        {key === 'expiring' && <AlertTriangle size={11} className={cn('flex-shrink-0', statusFilter === key ? 'text-indigo' : 'text-warning')} />}
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex-1" />
            <span className="text-[11px] text-text-3">{total} contract{total !== 1 ? 's' : ''}</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="text-[12px] text-text-2 border border-border rounded-[6px] px-2 py-1 bg-white cursor-pointer outline-none">
              <option value="date">Date added</option>
              <option value="name">Name</option>
              <option value="type">Type</option>
              <option value="expiry">Expiry date</option>
            </select>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {mainLoading ? (
              <div className="flex items-center justify-center h-full gap-2">
                <Loader2 size={20} className="text-indigo animate-spin" />
                <p className="text-[13px] text-text-2">Loading…</p>
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="w-12 h-12 rounded-[10px] bg-surface border border-border flex items-center justify-center">
                  <FileText size={20} className="text-text-3" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text mb-1">
                    {search ? `No results for "${search}"` : statusFilter === 'expiring' ? 'No contracts expiring in the next 30 days' : 'No contracts yet'}
                  </p>
                  <p className="text-xs text-text-3">
                    {search ? 'Try a different search term' : statusFilter !== 'all' ? 'Try changing the filter' : 'Upload a PDF or DOCX to get started'}
                  </p>
                </div>
                {!search && statusFilter === 'all' && (
                  <button onClick={() => fileInputRef.current?.click()}
                    className="mt-1 px-4 py-2 bg-indigo text-white text-sm font-semibold rounded-[7px] hover:bg-indigo-dk transition-colors">
                    Upload contract
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="px-4 py-2.5 bg-surface border-b border-border sticky top-0 z-10 w-10">
                      <button onClick={toggleAll}
                        className={cn('w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors',
                          allSelected ? 'bg-indigo border-indigo' : 'border-border-dk bg-white hover:border-indigo')}>
                        {allSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                        {!allSelected && someSelected && <span className="w-1.5 h-[2px] bg-text-3 rounded-full" />}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Name</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Type</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Parties</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10 whitespace-nowrap">Expiry</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Status</th>
                    <th className="px-4 py-2.5 bg-surface border-b border-border sticky top-0 z-10" />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((contract) => {
                    const type      = contract.contract_type ?? 'Other'
                    const st        = typeBadgeStyle(type)
                    const badge     = expiryBadge(contract.expiry_date)
                    const isSelected = selectedDoc?.id === contract.id
                    const isChecked  = selected.has(contract.id)
                    const isConfirming = confirmDeleteId === contract.id

                    return (
                      <tr key={contract.id}
                        onClick={() => { setSelectedDoc(isSelected ? null : contract); setConfirmDeleteId(null) }}
                        className={cn('cursor-pointer border-b border-border transition-colors group',
                          isSelected ? 'bg-indigo-lt' : isChecked ? 'bg-[#F0F4FF]' : 'hover:bg-surface')}>
                        <td className="px-4 py-2.5 w-10" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleOne(contract.id)}
                            className={cn('w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors',
                              isChecked ? 'bg-indigo border-indigo' : 'border-border-dk bg-white hover:border-indigo')}>
                            {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0" style={{ background: st.bg }}>
                              <FileIcon color={st.color} />
                            </div>
                            <div>
                              <p className={cn('text-[13px] font-semibold leading-snug', isSelected ? 'text-indigo' : 'text-text')}>{contract.name}</p>
                              <p className="text-[11px] text-text-3">{formatFileSize(contract.file_size)} · {contract.page_count ?? '?'} pages</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px]"
                            style={{ background: st.bg, color: st.color }}>{type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-text-2 max-w-[160px]">
                          <p className="truncate">{(contract.parties ?? []).slice(0, 2).join(' · ')}</p>
                          {(contract.parties ?? []).length > 2 && <p className="text-text-3 text-[11px]">+{contract.parties.length - 2} more</p>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {contract.expiry_date ? (
                            <div>
                              <p className="text-[12px] text-text-2">{formatDate(contract.expiry_date)}</p>
                              {badge && (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold mt-0.5"
                                  style={{ color: badge.color }}>
                                  <AlertTriangle size={9} />{badge.label}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[12px] text-text-3">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
                            <span className={cn('w-1.5 h-1.5 rounded-full',
                              contract.status === 'ready' ? 'bg-success' :
                              contract.status === 'failed' ? 'bg-danger' : 'bg-warning animate-pulse')} />
                            {contract.status === 'ready' ? 'Analyzed' : contract.status === 'failed' ? 'Failed' : 'Processing'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className={cn('flex items-center gap-1 transition-opacity', isConfirming ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                            {contract.file_type === 'pdf' && !isConfirming && (
                              <button onClick={() => setViewingDoc(contract)}
                                className="text-[11.5px] font-medium px-2 py-1 border border-border rounded-[5px] bg-white text-text-2 hover:bg-surface transition-colors">
                                View
                              </button>
                            )}
                            {isConfirming ? (
                              <>
                                <button onClick={() => handleDelete(contract.id)}
                                  className="text-[11px] font-semibold px-2 py-1 bg-danger text-white rounded-[5px] hover:bg-danger/90 transition-colors">
                                  Confirm
                                </button>
                                <button onClick={() => setConfirmDeleteId(null)}
                                  className="p-1 text-text-3 hover:text-text transition-colors">
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(contract.id)}
                                className="p-1.5 border border-border rounded-[5px] bg-white text-danger hover:bg-danger-lt transition-colors">
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-border flex-shrink-0 bg-white">
              <span className="text-[12px] text-text-3">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} contracts
              </span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center border border-border rounded-[6px] text-text-2 hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  // Show first, last, current ±1, and ellipsis
                  const p = i + 1
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={cn('w-7 h-7 text-[12px] font-medium rounded-[6px] border transition-colors',
                        page === p
                          ? 'bg-indigo text-white border-indigo'
                          : 'border-border text-text-2 hover:bg-surface')}>
                      {p}
                    </button>
                  )
                })}
                {totalPages > 7 && page < totalPages - 3 && (
                  <span className="text-[12px] text-text-3 px-1">…</span>
                )}
                {totalPages > 7 && (
                  <button onClick={() => setPage(totalPages)}
                    className={cn('w-7 h-7 text-[12px] font-medium rounded-[6px] border transition-colors',
                      page === totalPages
                        ? 'bg-indigo text-white border-indigo'
                        : 'border-border text-text-2 hover:bg-surface')}>
                    {totalPages}
                  </button>
                )}
                <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                  className="w-7 h-7 flex items-center justify-center border border-border rounded-[6px] text-text-2 hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {selectedDoc && !showChat && (
          <ContractDetail
            contract={selectedDoc}
            onClose={() => setSelectedDoc(null)}
            onDelete={handleDelete}
            onView={setViewingDoc}
            onMoveToCollection={(id, collId) => moveMutation.mutate({ id, collectionId: collId })}
            collections={collections}
          />
        )}

        {/* ── Chat panel ── */}
        {showChat && (
          <ChatPanel
            contracts={sidebarContracts}
            selectedIds={selected}
            onClose={() => setShowChat(false)}
          />
        )}
      </div>

      {/* Drag overlay */}
      {dragging && (
        <div className="fixed inset-0 bg-indigo/10 border-4 border-dashed border-indigo z-40 flex items-center justify-center"
          onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onDragLeave={() => setDragging(false)}>
          <div className="text-center bg-white rounded-[12px] px-10 py-8 shadow-xl">
            <p className="text-xl font-semibold text-indigo">Drop contracts here</p>
            <p className="text-sm text-text-3 mt-1">PDF, DOCX, or TXT · Max 50 MB</p>
          </div>
        </div>
      )}

      {showSearch && <SearchModal onClose={() => setShowSearch(false)} onSelect={(c) => setSelectedDoc(c)} />}
      {viewingDoc && <PdfViewerModal contract={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </div>
  )
}
