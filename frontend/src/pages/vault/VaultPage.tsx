import { useState } from 'react'
import { Search, Plus, ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { useDocuments } from '@/hooks/useMockQuery'
import { formatDate, cn } from '@/lib/utils'
import type { Document } from '@/types'

const activeMatters = [
  { id: 'tata', label: 'Tata Digital', count: 12, expanded: true, color: '#D97706',
    children: [
      { id: 'tata-contracts', label: 'Contracts', count: 8, active: true },
      { id: 'tata-correspondence', label: 'Correspondence', count: 4 },
    ]
  },
  { id: 'razorpay', label: 'Razorpay Deal', count: 8, expanded: false },
  { id: 'lt-jv', label: 'L&T JV M&A', count: 23, expanded: false },
]

const byType = [
  { id: 'ndas', label: 'NDAs', count: 34 },
  { id: 'employment', label: 'Employment', count: 19 },
  { id: 'saas', label: 'SaaS Agreements', count: 28 },
]

// Type badge colors
const typeBadgeStyle: Record<string, { bg: string; color: string }> = {
  MSA:   { bg: '#DBEAFE', color: '#1D4ED8' },
  NDA:   { bg: '#EDE9FE', color: '#6D28D9' },
  License: { bg: '#EEF2FF', color: '#4338CA' },
  DPA:   { bg: '#FEF3C7', color: '#D97706' },
  Amendment: { bg: '#F1F5F9', color: '#475569' },
  'SaaS Agreement': { bg: '#D1FAE5', color: '#059669' },
  Employment: { bg: '#FEF3C7', color: '#D97706' },
  SOW: { bg: '#F0F9FF', color: '#0369A1' },
}

function fileIconColor(type: string) {
  const m: Record<string, string> = {
    MSA: '#DC2626', NDA: '#7C3AED', License: '#4338CA',
    DPA: '#D97706', Amendment: '#475569',
    'SaaS Agreement': '#059669', Employment: '#D97706', SOW: '#3B82F6',
  }
  return m[type] ?? '#4338CA'
}

function FileIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 1.5h6l3.5 3.5v7.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-10.5a.5.5 0 0 1 .5-.5z" stroke={color} strokeWidth="1.1" />
      <path d="M8.5 1.5v3.5H12" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

// Mock upload items
const uploadItems = [
  {
    id: 'u1', name: 'Tata_Digital_Renewal_2024.pdf', type: 'pdf',
    stages: ['Uploaded', 'OCR', 'Extracted', 'Indexed'],
    activeStage: 4, progress: 100, chip: 'Complete', chipClass: 'bg-success-lt text-success',
  },
  {
    id: 'u2', name: 'Zepto_Technologies_NDA_v2.pdf', type: 'pdf',
    stages: ['Uploaded', 'OCR', 'Extracting clauses', 'Indexing'],
    activeStage: 3, progress: 67, pct: '67%', chip: 'Extracting', chipClass: 'bg-warning-lt text-warning',
  },
  {
    id: 'u3', name: 'Infosys_BPM_MSA_Executed.docx', type: 'docx',
    stages: ['Uploaded', 'OCR', 'Extracting', 'Indexing'],
    activeStage: 0, progress: 15, chip: 'Queued', chipClass: 'bg-surface text-text-3 border border-border',
  },
]

export function VaultPage() {
  const { data: documents, isLoading } = useDocuments()
  const [search, setSearch] = useState('')
  const [viewMode] = useState<'list' | 'grid'>('list')
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [uploadsOpen, setUploadsOpen] = useState(true)
  const [activeCollection, setActiveCollection] = useState('tata-contracts')

  if (isLoading) return (
    <div className="flex-1 flex flex-col">
      <Topbar breadcrumb={[{ label: 'The Vault' }, { label: 'Active Matters / Tata Digital' }]} />
      <PageLoader />
    </div>
  )

  const filtered = documents?.filter((d) => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.parties.some((p) => p.toLowerCase().includes(search.toLowerCase()))
    return matchesSearch
  }) ?? []

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        breadcrumb={[{ label: 'The Vault' }, { label: 'Active Matters / Tata Digital' }]}
        actions={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-2 border border-border-dk rounded-[7px] bg-white hover:bg-surface transition-colors">
              <Plus size={13} /> New collection
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-2 border border-border-dk rounded-[7px] bg-white hover:bg-surface transition-colors">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v10M3.5 5l3-4 3 4" stroke="#475569" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1.5 11h10" stroke="#475569" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Upload documents
            </button>
            <button className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold text-white bg-indigo rounded-[7px] hover:bg-indigo-dk transition-colors">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1l1.2 3.3H11L8.4 6.5l.9 3.3L6.5 8 3.7 9.8l.9-3.3L2 4.3h3.3L6.5 1z" fill="white" />
              </svg>
              Search vault
            </button>
          </div>
        }
      />

      {/* Upload panel */}
      <div className="flex-shrink-0 border-b border-border bg-white">
        <div className="flex items-center justify-between px-7 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1v10M3.5 5l4-4 4 4" stroke="#4338CA" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1.5 13h12" stroke="#4338CA" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-semibold text-text">Uploads</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-pill bg-warning-lt text-warning">2 processing</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-pill bg-success-lt text-success">1 complete</span>
          </div>
          <button
            onClick={() => setUploadsOpen(!uploadsOpen)}
            className="text-xs font-medium text-text-2 px-3 py-1 border border-border rounded-[6px] hover:bg-surface transition-colors"
          >
            {uploadsOpen ? 'Dismiss all' : 'Show'}
          </button>
        </div>

        {uploadsOpen && (
          <div className="flex">
            {/* Drop zone */}
            <div className="w-[220px] flex-shrink-0 border-r border-border px-5 py-4 flex flex-col items-center justify-center gap-2 bg-surface hover:bg-indigo-lt cursor-pointer transition-colors text-center">
              <div className="w-9 h-9 rounded-[9px] bg-white border-[1.5px] border-dashed border-border-dk flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 3v10M5 7l4-4 4 4" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 15h14" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-xs text-text-2 leading-snug">
                <span className="text-indigo font-semibold">Click to upload</span> or drag &amp; drop files here
              </p>
              <p className="text-[10.5px] text-text-3">PDF, DOCX, TXT · Max 50 MB</p>
            </div>

            {/* Upload items */}
            <div className="flex-1 px-5 py-3 flex flex-col gap-2.5">
              {uploadItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-[7px] flex items-center justify-center flex-shrink-0"
                    style={{ background: item.type === 'pdf' ? '#FEE2E2' : '#DBEAFE' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 2h7l4 4v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke={item.type === 'pdf' ? '#DC2626' : '#3B82F6'} strokeWidth="1.2" />
                      <path d="M10 2v4h4" stroke={item.type === 'pdf' ? '#DC2626' : '#3B82F6'} strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-text truncate mb-1">{item.name}</p>
                    <div className="flex items-center gap-1 mb-1.5">
                      {item.stages.map((stage, i) => (
                        <span key={stage} className="flex items-center gap-0.5">
                          {i > 0 && <span className="text-border-dk text-[9px] mx-0.5">›</span>}
                          <span className={cn(
                            'text-[10px] font-medium flex items-center gap-1',
                            i < item.activeStage ? 'text-success' : i === item.activeStage - 1 && item.progress < 100 ? 'text-indigo font-semibold' : 'text-text-3'
                          )}>
                            <span className={cn(
                              'w-[5px] h-[5px] rounded-full',
                              i < item.activeStage ? 'bg-success' : i === item.activeStage - 1 && item.progress < 100 ? 'bg-indigo' : 'bg-border-dk'
                            )} />
                            {stage}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div className="h-1 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${item.progress}%`,
                          backgroundColor: item.progress === 100 ? '#059669' : item.activeStage === 0 ? '#D97706' : '#4338CA',
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.pct && <span className="text-[11.5px] font-semibold text-text-2">{item.pct}</span>}
                    <span className={cn('text-[10.5px] font-semibold px-2.5 py-0.5 rounded-pill', item.chipClass)}>{item.chip}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 flex min-h-0">

        {/* Collections panel */}
        <div className="w-[220px] flex-shrink-0 border-r border-border bg-surface flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[11.5px] font-bold text-text-3 uppercase tracking-wider">Collections</span>
            <button className="w-5 h-5 rounded-[5px] border border-border-dk flex items-center justify-center text-text-3 hover:bg-border hover:text-text-2 transition-colors">
              <Plus size={10} />
            </button>
          </div>

          <div className="px-2 pb-4">
            {/* All Documents */}
            <div
              onClick={() => setActiveCollection('all')}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-[6px] cursor-pointer text-[13px] font-medium mb-1',
                activeCollection === 'all' ? 'bg-indigo-lt text-indigo' : 'text-text-2 hover:bg-border'
              )}
            >
              <Folder size={14} className={activeCollection === 'all' ? 'text-indigo' : 'text-text-3'} />
              All Documents
              <span className={cn(
                'ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-pill',
                activeCollection === 'all' ? 'bg-indigo-mid text-indigo' : 'bg-border text-text-3'
              )}>147</span>
            </div>

            {/* Active Matters */}
            <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider px-2 pt-2.5 pb-1">Active Matters</p>

            {activeMatters.map((matter) => (
              <div key={matter.id}>
                <div
                  onClick={() => setActiveCollection(matter.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] cursor-pointer text-[13px] font-medium mb-0.5',
                    activeCollection === matter.id ? 'bg-indigo-lt text-indigo' : 'text-text-2 hover:bg-border'
                  )}
                >
                  {matter.expanded
                    ? <ChevronDown size={10} className="opacity-40 flex-shrink-0" />
                    : <ChevronRight size={10} className="opacity-40 flex-shrink-0" />
                  }
                  <Folder size={14} className="flex-shrink-0" style={{ color: matter.expanded ? matter.color : undefined }} />
                  {matter.label}
                  <span className={cn(
                    'ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-pill',
                    activeCollection === matter.id ? 'bg-indigo-mid text-indigo' : 'bg-border text-text-3'
                  )}>{matter.count}</span>
                </div>
                {matter.expanded && matter.children && (
                  <div className="pl-5">
                    {matter.children.map((child) => (
                      <div
                        key={child.id}
                        onClick={() => setActiveCollection(child.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] cursor-pointer text-[13px] font-medium mb-0.5',
                          activeCollection === child.id ? 'bg-indigo-lt text-indigo' : 'text-text-2 hover:bg-border'
                        )}
                      >
                        <FolderOpen size={12} className="flex-shrink-0" />
                        {child.label}
                        <span className={cn(
                          'ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-pill',
                          activeCollection === child.id ? 'bg-indigo-mid text-indigo' : 'bg-border text-text-3'
                        )}>{child.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* By Type */}
            <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider px-2 pt-3 pb-1">By Type</p>
            {byType.map((t) => (
              <div
                key={t.id}
                onClick={() => setActiveCollection(t.id)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-[6px] cursor-pointer text-[13px] font-medium mb-0.5',
                  activeCollection === t.id ? 'bg-indigo-lt text-indigo' : 'text-text-2 hover:bg-border'
                )}
              >
                <Folder size={14} className="text-text-3" />
                {t.label}
                <span className={cn(
                  'ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-pill',
                  activeCollection === t.id ? 'bg-indigo-mid text-indigo' : 'bg-border text-text-3'
                )}>{t.count}</span>
              </div>
            ))}

            {/* Other */}
            <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider px-2 pt-3 pb-1">Other</p>
            <div
              onClick={() => setActiveCollection('archived')}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-[6px] cursor-pointer text-[13px] font-medium',
                activeCollection === 'archived' ? 'bg-indigo-lt text-indigo' : 'text-text-3 hover:bg-border'
              )}
            >
              <Folder size={14} className="text-text-3" />
              Archived
              <span className="ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-pill bg-border text-text-3">23</span>
            </div>
          </div>
        </div>

        {/* File list panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2 bg-surface border border-border rounded-[7px] px-3 py-1.5 flex-1 max-w-[280px]">
              <Search size={13} className="text-text-3 flex-shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter in this folder…"
                className="border-none outline-none bg-transparent text-[12.5px] text-text placeholder:text-text-3 w-full"
              />
            </div>
            <div className="flex-1" />
            <select className="text-[12px] text-text-2 border-none outline-none bg-transparent cursor-pointer font-medium">
              <option>Sort by: Date added</option>
              <option>Name</option>
              <option>Type</option>
            </select>
            <div className="flex gap-0.5">
              <button
                onClick={() => {}}
                className={cn(
                  'w-7 h-7 rounded-[6px] border border-border flex items-center justify-center',
                  viewMode === 'list' ? 'bg-indigo-lt border-indigo-mid' : 'bg-white'
                )}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1.5 2.5h10M1.5 5.5h10M1.5 8.5h10M1.5 11.5h6" stroke={viewMode === 'list' ? '#4338CA' : '#94A3B8'} strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
              <button className="w-7 h-7 rounded-[6px] border border-border bg-white flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <rect x="1.5" y="1.5" width="4" height="4" rx="1" stroke="#94A3B8" strokeWidth="1.2" />
                  <rect x="7.5" y="1.5" width="4" height="4" rx="1" stroke="#94A3B8" strokeWidth="1.2" />
                  <rect x="1.5" y="7.5" width="4" height="4" rx="1" stroke="#94A3B8" strokeWidth="1.2" />
                  <rect x="7.5" y="7.5" width="4" height="4" rx="1" stroke="#94A3B8" strokeWidth="1.2" />
                </svg>
              </button>
            </div>
          </div>

          {/* File table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-8 px-6 py-2.5 text-left bg-surface border-b border-border sticky top-0 z-10" />
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Name</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Type</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Parties</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10 whitespace-nowrap">Date</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Status</th>
                  <th className="px-6 py-2.5 bg-surface border-b border-border sticky top-0 z-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => {
                  const iconColor = fileIconColor(doc.type)
                  const iconBg = typeBadgeStyle[doc.type]?.bg ?? '#FEE2E2'
                  const badge = typeBadgeStyle[doc.type]
                  const isSelected = selectedDoc?.id === doc.id

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setSelectedDoc(isSelected ? null : doc)}
                      className={cn(
                        'cursor-pointer border-b border-border transition-colors group',
                        isSelected ? 'bg-indigo-lt' : 'hover:bg-surface'
                      )}
                    >
                      <td className="px-6 py-2.5">
                        <div className={cn(
                          'w-[15px] h-[15px] rounded-[4px] border-[1.5px] flex items-center justify-center',
                          isSelected ? 'bg-indigo border-indigo' : 'border-border-dk'
                        )}>
                          {isSelected && (
                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                              <path d="M1.5 4.5l2.5 2.5 4-4" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
                            <FileIcon color={iconColor} />
                          </div>
                          <div>
                            <p className={cn('text-[13px] font-semibold', isSelected ? 'text-indigo' : 'text-text')}>{doc.name}</p>
                            <p className="text-[11px] text-text-3">{doc.size} · {doc.pageCount} pages</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {badge ? (
                          <span
                            className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-[4px] whitespace-nowrap"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {doc.type}
                          </span>
                        ) : (
                          <span className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-[4px] bg-surface text-text-2 border border-border">{doc.type}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] text-text-2">{doc.parties.join(' ↔ ')}</td>
                      <td className="px-4 py-2.5 text-[12.5px] text-text-2 whitespace-nowrap">{formatDate(doc.uploadedAt)}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-success" />
                          {doc.status === 'processed' ? 'Analyzed' : doc.status === 'processing' ? 'Processing' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-6 py-2.5">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation() }}
                            className="text-[11.5px] font-medium px-2.5 py-1 border border-border rounded-[5px] bg-white text-text-2 hover:bg-surface transition-colors"
                          >
                            Open
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation() }}
                            className="text-[11.5px] font-medium px-2.5 py-1 border border-border rounded-[5px] bg-white text-text-2 hover:bg-surface transition-colors"
                          >
                            Audit
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
