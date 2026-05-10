import { useState, useCallback, useEffect, useRef } from 'react'
import ReactFlow, {
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useViewport,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Play, Save, Undo2, Redo2, Plus, Minus, Trash2, Check, PenLine, Copy,
} from 'lucide-react'
import type { Workflow } from '@/types'
import { useWorkflows, useCreateWorkflow, useUpdateWorkflow, useDeleteWorkflow, useRunWorkflow } from '@/hooks/useWorkflow'

// ── Config ───────────────────────────────────────────────────────────────────

const nodeTypeConfig = {
  trigger: { label: 'Trigger',        color: '#059669', iconBg: '#DCFCE7' },
  ai:      { label: 'AI Process',     color: '#4338CA', iconBg: '#EEF2FF' },
  branch:  { label: 'Branch / Logic', color: '#D97706', iconBg: '#FEF9C3' },
  action:  { label: 'Action',         color: '#475569', iconBg: '#F1F5F9' },
  notify:  { label: 'Notify',         color: '#7C3AED', iconBg: '#F5F3FF' },
}

const PALETTE_TYPES = ['trigger', 'ai', 'branch', 'action', 'notify'] as const

function getDefaultNodeData(type: string): Record<string, unknown> {
  switch (type) {
    case 'trigger': return { triggerType: 'upload', contractTypeFilter: '', scheduleInterval: 'weekly', scheduleTime: '09:00', scheduleDay: 'monday', scheduleDayOfMonth: '1' }
    case 'ai':      return { analysisMode: 'full' }
    case 'branch':  return { field: 'risk_score', operator: 'gte', value: '70' }
    case 'action':  return { actionType: 'tag_contract', tagValue: '', collectionName: '', newStatus: 'approved' }
    case 'notify':  return { channel: 'email', recipients: '', messageTemplate: 'A workflow action was triggered.' }
    default:        return {}
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRFNodes(wf: Workflow): Node[] {
  return wf.nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data }))
}

function toRFEdges(wf: Workflow): Edge[] {
  return wf.edges.map(e => ({
    id: e.id, source: e.source, target: e.target, label: e.label,
    type: 'smoothstep',
    style: { stroke: '#CBD5E1', strokeWidth: 2 },
    labelStyle: { fontSize: 9, fill: '#059669', fontWeight: 700 },
    labelBgStyle: { fill: '#D1FAE5', stroke: 'none', borderRadius: 3 },
  }))
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 10)   return 'just now'
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

// ── NodeIcon ──────────────────────────────────────────────────────────────────

function NodeIcon({ type, color }: { type: string; color: string }) {
  if (type === 'trigger') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <polygon points="4,2 14,9 4,16" stroke={color} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
    </svg>
  )
  if (type === 'ai') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L10 6H14.5L11 8.5 12.5 13 8 10.5 3.5 13 5 8.5 1.5 6H6L8 1.5Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'branch') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 12V4M12 4v3M12 11v1M4 4h8M8 8l4 3M8 8l4-3" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'action') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2a4 4 0 0 1 0 8 4 4 0 0 1 0-8zM8 12v2M6 14h4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

// ── Canvas node ───────────────────────────────────────────────────────────────

function WorkflowNode({ data, type, selected }: NodeProps) {
  const cfg = nodeTypeConfig[type as keyof typeof nodeTypeConfig] ?? nodeTypeConfig.action
  return (
    <div
      className="flex items-stretch bg-white rounded-[10px] overflow-hidden"
      style={{
        width: 180,
        border: selected ? `1.5px solid ${cfg.color}` : '1.5px solid #E2E8F0',
        boxShadow: selected
          ? `0 0 0 3px ${cfg.color}20, 0 4px 12px ${cfg.color}25`
          : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <Handle type="target" position={Position.Left}  className="!w-3 !h-3 !bg-white !border-2 !border-[#CBD5E1]" />
      <div className="w-[44px] flex items-center justify-center flex-shrink-0 rounded-l-[8px]" style={{ background: cfg.iconBg }}>
        <NodeIcon type={type ?? 'action'} color={cfg.color} />
      </div>
      <div className="flex-1 py-2.5 px-3 min-w-0">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.07em] mb-0.5" style={{ color: cfg.color }}>
          {cfg.label}
        </p>
        <p className="text-[12.5px] font-semibold text-text leading-snug truncate">{data.label as string}</p>
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-white !border-2 !border-[#CBD5E1]" />
    </div>
  )
}

const nodeTypes = { trigger: WorkflowNode, ai: WorkflowNode, branch: WorkflowNode, action: WorkflowNode, notify: WorkflowNode }

// ── Flow Canvas ───────────────────────────────────────────────────────────────

interface FlowCanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: ReturnType<typeof useNodesState>[2]
  onEdgesChange: ReturnType<typeof useEdgesState>[2]
  onConnect: (c: Connection) => void
  setNodes: ReturnType<typeof useNodesState>[1]
  onNodeClick: (node: Node) => void
  onEdgeClick: (edge: Edge) => void
  onPaneClick: () => void
}

function FlowCanvas(props: FlowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow()
  const { setNodes, onConnect, onNodeClick, onEdgeClick, onPaneClick,
          onNodesChange, onEdgesChange } = props

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const nodeType = e.dataTransfer.getData('nodeType')
    if (!nodeType || !nodeTypeConfig[nodeType as keyof typeof nodeTypeConfig]) return
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const cfg = nodeTypeConfig[nodeType as keyof typeof nodeTypeConfig]
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position,
      data: { label: cfg.label, description: '', ...getDefaultNodeData(nodeType) },
    }
    setNodes(nds => [...nds, newNode])
  }, [screenToFlowPosition, setNodes])

  const rfNodeClick = useCallback((_: React.MouseEvent, node: Node) => onNodeClick(node), [onNodeClick])
  const rfEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => onEdgeClick(edge), [onEdgeClick])

  return (
    <div className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={props.nodes}
        edges={props.edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={rfNodeClick}
        onEdgeClick={rfEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
      >
        <Background color="#CBD5E1" gap={24} size={1} style={{ backgroundColor: '#FAFAFA' }} />
      </ReactFlow>

      {props.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
          <div className="w-12 h-12 rounded-[10px] bg-white border border-border flex items-center justify-center shadow-sm">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="8" width="7" height="6" rx="2" stroke="#CBD5E1" strokeWidth="1.5"/>
              <rect x="13" y="3" width="7" height="6" rx="2" stroke="#CBD5E1" strokeWidth="1.5"/>
              <rect x="13" y="13" width="7" height="6" rx="2" stroke="#CBD5E1" strokeWidth="1.5"/>
              <path d="M9 11h2.5m1.5-5v3m0 6v-2" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-[13px] font-medium text-text-2">Drag a node from the left panel</p>
          <p className="text-[11.5px] text-text-3">or click a node type to add it to the canvas</p>
        </div>
      )}
    </div>
  )
}

// ── Properties Panel ──────────────────────────────────────────────────────────

interface PropsPanelProps {
  selectedNode: Node | null
  selectedEdge: Edge | null
  onUpdateNodeData: (key: string, value: unknown) => void
  onDeleteNode: (id: string) => void
  onUpdateEdgeLabel: (id: string, label: string) => void
  onDeleteEdge: (id: string) => void
}

const fieldOptions = [
  { value: 'risk_score',    label: 'Risk Score' },
  { value: 'contract_type', label: 'Contract Type' },
  { value: 'page_count',    label: 'Page Count' },
  { value: 'parties_count', label: 'Parties Count' },
  { value: 'days_to_expiry',label: 'Days to Expiry' },
]

const operatorOptions = [
  { value: 'gte',      label: '≥' },
  { value: 'lte',      label: '≤' },
  { value: 'eq',       label: '=' },
  { value: 'neq',      label: '≠' },
  { value: 'contains', label: 'contains' },
]

const inputCls = 'w-full px-3 py-2 text-[13px] border border-border rounded-[7px] bg-white text-text focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo'
const labelCls = 'block text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1.5'
const sectionCls = 'space-y-4'

function PropertiesPanel({ selectedNode, selectedEdge, onUpdateNodeData, onDeleteNode, onUpdateEdgeLabel, onDeleteEdge }: PropsPanelProps) {
  const [copied, setCopied] = useState(false)

  const d = selectedNode?.data ?? {}
  const cfg = selectedNode ? (nodeTypeConfig[selectedNode.type as keyof typeof nodeTypeConfig] ?? nodeTypeConfig.action) : null

  function upd(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onUpdateNodeData(key, e.target.value)
  }

  // Edge selected
  if (selectedEdge) {
    return (
      <div className="w-[264px] flex-shrink-0 flex flex-col border-l border-border bg-white overflow-y-auto">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="w-9 h-9 rounded-[8px] bg-surface flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M10 5l3 3-3 3" stroke="#475569" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[13.5px] font-bold text-text">Connection</p>
            <span className="text-[11px] text-text-3">Edge label</span>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <div>
            <label className={labelCls}>Condition Label</label>
            <input
              className={inputCls}
              placeholder='e.g. "High Risk" or "Approved"'
              value={(selectedEdge.label as string) ?? ''}
              onChange={e => onUpdateEdgeLabel(selectedEdge.id, e.target.value)}
            />
            <p className="text-[11px] text-text-3 mt-1.5">Labels appear on the connecting arrow and describe the condition outcome.</p>
          </div>
        </div>
        <div className="p-4 border-t border-border">
          <button
            onClick={() => onDeleteEdge(selectedEdge.id)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-danger hover:text-danger/80 transition-colors"
          >
            <Trash2 size={12} /> Delete connection
          </button>
        </div>
      </div>
    )
  }

  // Nothing selected
  if (!selectedNode || !cfg) {
    return (
      <div className="w-[264px] flex-shrink-0 flex flex-col border-l border-border bg-white">
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <div className="w-10 h-10 bg-surface rounded-[9px] flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="7" width="6" height="6" rx="2" stroke="#CBD5E1" strokeWidth="1.5"/>
                <rect x="12" y="3" width="6" height="6" rx="2" stroke="#CBD5E1" strokeWidth="1.5"/>
                <rect x="12" y="12" width="6" height="6" rx="2" stroke="#CBD5E1" strokeWidth="1.5"/>
                <path d="M8 10h2m2-4v2m0 6v-2M10 10h2" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-[13px] font-medium text-text-2">Select a node</p>
            <p className="text-[11px] text-text-3 mt-1">Click any node or connection to edit its properties</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[264px] flex-shrink-0 flex flex-col border-l border-border bg-white overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ background: cfg.iconBg }}>
          <NodeIcon type={selectedNode.type ?? 'action'} color={cfg.color} />
        </div>
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-text truncate">{d.label as string}</p>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-pill" style={{ backgroundColor: cfg.iconBg, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-5 overflow-y-auto">

        {/* Common: name + description */}
        <div className={sectionCls}>
          <div>
            <label className={labelCls}>Node Name</label>
            <input className={inputCls} value={d.label as string} onChange={upd('label')} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={d.description as string} onChange={upd('description')} />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* ── Trigger ── */}
        {selectedNode.type === 'trigger' && (
          <div className={sectionCls}>
            <div>
              <label className={labelCls}>Trigger Type</label>
              <select className={inputCls} value={d.triggerType as string} onChange={upd('triggerType')}>
                <option value="upload">New Contract Upload</option>
                <option value="schedule">Scheduled (Time-based)</option>
                <option value="webhook">Incoming Webhook</option>
              </select>
            </div>

            {d.triggerType === 'upload' && (
              <div>
                <label className={labelCls}>Contract Type Filter</label>
                <select className={inputCls} value={d.contractTypeFilter as string} onChange={upd('contractTypeFilter')}>
                  <option value="">Any type</option>
                  {['NDA', 'MSA', 'SaaS Agreement', 'Employment Agreement', 'SOW', 'DPA', 'Shareholders Agreement', 'Share Subscription Agreement', 'Business Transfer Agreement', 'Consulting Agreement', 'Service Agreement', 'Lease Agreement', 'Loan Agreement'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <p className="text-[11px] text-text-3 mt-1.5">Only trigger when uploaded contract matches this type. Leave blank to trigger on any upload.</p>
              </div>
            )}

            {d.triggerType === 'schedule' && (
              <>
                <div>
                  <label className={labelCls}>Run Frequency</label>
                  <select className={inputCls} value={d.scheduleInterval as string} onChange={upd('scheduleInterval')}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly (end of quarter)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Time of Day</label>
                  <input
                    type="time"
                    className={inputCls}
                    value={d.scheduleTime as string}
                    onChange={upd('scheduleTime')}
                  />
                </div>
                {d.scheduleInterval === 'weekly' && (
                  <div>
                    <label className={labelCls}>Day of Week</label>
                    <select className={inputCls} value={d.scheduleDay as string} onChange={upd('scheduleDay')}>
                      <option value="monday">Monday</option>
                      <option value="tuesday">Tuesday</option>
                      <option value="wednesday">Wednesday</option>
                      <option value="thursday">Thursday</option>
                      <option value="friday">Friday</option>
                      <option value="saturday">Saturday</option>
                      <option value="sunday">Sunday</option>
                    </select>
                  </div>
                )}
                {d.scheduleInterval === 'monthly' && (
                  <div>
                    <label className={labelCls}>Day of Month</label>
                    <select className={inputCls} value={d.scheduleDayOfMonth as string} onChange={upd('scheduleDayOfMonth')}>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={String(n)}>{n}</option>
                      ))}
                    </select>
                  </div>
                )}
                <p className="text-[10.5px] text-text-3 leading-relaxed">
                  Automatic scheduling requires Celery Beat / APScheduler to be configured on the backend.
                </p>
              </>
            )}

            {d.triggerType === 'webhook' && (
              <div>
                <label className={labelCls}>Webhook URL</label>
                <div className="flex gap-1.5">
                  <input
                    readOnly
                    className={`${inputCls} flex-1 text-text-3 text-[11.5px] bg-surface cursor-text`}
                    value="https://api.legalflow.io/hooks/..."
                  />
                  <button
                    className="flex items-center gap-1 px-2.5 py-2 rounded-[7px] border border-border text-[11px] font-medium text-text-2 hover:bg-surface transition-colors flex-shrink-0"
                    onClick={() => { navigator.clipboard.writeText('https://api.legalflow.io/hooks/...'); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                  >
                    {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI Process ── */}
        {selectedNode.type === 'ai' && (
          <div className={sectionCls}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-indigo-lt border border-indigo-mid">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                <path d="M7 1.5L8.5 5.5H12.5L9.5 7.5 10.5 11.5 7 9.5 3.5 11.5 4.5 7.5 1.5 5.5H5.5L7 1.5Z" stroke="#4338CA" strokeWidth="1.1" strokeLinejoin="round"/>
              </svg>
              <span className="text-[11.5px] font-semibold text-indigo">Powered by Claude AI</span>
            </div>

            <div>
              <label className={labelCls}>Analysis Mode</label>
              <div className="space-y-2">
                {[
                  { value: 'full',         label: 'Full contract analysis',    hint: 'Risk score + summary' },
                  { value: 'risk_only',    label: 'Risk clauses only',         hint: 'Flags risky clauses + risk score' },
                  { value: 'clause_audit', label: 'Clause audit (playbook)',   hint: 'Checks against playbook, sets coverage score' },
                  { value: 'obligations',  label: 'Extract obligations',       hint: 'Pulls deadlines and duties' },
                  { value: 'summary',      label: 'Summary only',              hint: 'Plain-language contract summary' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-start gap-2.5 cursor-pointer" onClick={() => onUpdateNodeData('analysisMode', opt.value)}>
                    <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ borderColor: d.analysisMode === opt.value ? '#4338CA' : '#CBD5E1' }}>
                      {d.analysisMode === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-indigo" />}
                    </div>
                    <div>
                      <span className="text-[12.5px] text-text-2 leading-snug">{opt.label}</span>
                      <p className="text-[10.5px] text-text-3 leading-tight mt-0.5">{opt.hint}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {(d.analysisMode === 'full' || d.analysisMode === 'risk_only' || d.analysisMode === 'clause_audit') && (
              <div className="rounded-[8px] bg-surface border border-border p-3">
                <p className="text-[11px] text-text-3 leading-relaxed">
                  This step outputs a <strong className="text-text-2">risk score (0–100)</strong>. Use a Branch node after this to route contracts based on that score.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Branch / Logic ── */}
        {selectedNode.type === 'branch' && (
          <div className={sectionCls}>
            <div>
              <label className={labelCls}>Condition</label>
              <div className="flex gap-1.5 items-center">
                <select className={`${inputCls} flex-1`} value={d.field as string} onChange={upd('field')}>
                  {fieldOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select className="px-2 py-2 text-[13px] border border-border rounded-[7px] bg-white text-text focus:outline-none focus:border-indigo" value={d.operator as string} onChange={upd('operator')}>
                  {operatorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input
                  className="w-14 px-2 py-2 text-[13px] border border-border rounded-[7px] bg-white text-text focus:outline-none focus:border-indigo"
                  value={d.value as string}
                  onChange={upd('value')}
                />
              </div>
            </div>
            <div className="rounded-[8px] bg-indigo-lt border border-indigo-mid p-3">
              <p className="text-[11.5px] text-indigo leading-relaxed">
                Click any outgoing arrow to set its condition label (e.g. "High Risk", "Approved", "Standard").
              </p>
            </div>
          </div>
        )}

        {/* ── Action ── */}
        {selectedNode.type === 'action' && (
          <div className={sectionCls}>
            <div>
              <label className={labelCls}>Action Type</label>
              <select className={inputCls} value={d.actionType as string} onChange={upd('actionType')}>
                <option value="tag_contract">Tag Contract</option>
                <option value="move_collection">Move to Collection</option>
                <option value="run_clause_audit">Run Clause Audit</option>
                <option value="extract_obligations">Extract Obligations</option>
                <option value="generate_timeline">Generate Timeline</option>
                <option value="update_status">Update Contract Status</option>
              </select>
            </div>

            {d.actionType === 'tag_contract' && (
              <div>
                <label className={labelCls}>Tag Value</label>
                <input className={inputCls} placeholder='e.g. "high-risk" or "reviewed"' value={d.tagValue as string} onChange={upd('tagValue')} />
              </div>
            )}

            {d.actionType === 'move_collection' && (
              <div>
                <label className={labelCls}>Collection Name</label>
                <input className={inputCls} placeholder='e.g. "Reviewed" or "Flagged"' value={d.collectionName as string} onChange={upd('collectionName')} />
              </div>
            )}

            {d.actionType === 'update_status' && (
              <div>
                <label className={labelCls}>New Status</label>
                <select className={inputCls} value={d.newStatus as string} onChange={upd('newStatus')}>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            )}

            {(d.actionType === 'run_clause_audit' || d.actionType === 'extract_obligations' || d.actionType === 'generate_timeline') && (
              <div className="rounded-[8px] bg-surface border border-border p-3">
                <p className="text-[11.5px] text-text-3 leading-relaxed">
                  {d.actionType === 'run_clause_audit'    && 'Automatically runs a clause audit using the detected playbook for the contract.'}
                  {d.actionType === 'extract_obligations' && 'Extracts all obligations from the contract and adds them to the Obligations tracker.'}
                  {d.actionType === 'generate_timeline'   && 'Generates a timeline of key milestones and dates from the contract.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Notify ── */}
        {selectedNode.type === 'notify' && (
          <div className={sectionCls}>
            <div>
              <label className={labelCls}>Channel</label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onUpdateNodeData('channel', 'email')}
                  className="flex-1 py-1.5 rounded-[7px] text-[12px] font-semibold transition-colors"
                  style={d.channel === 'email'
                    ? { background: '#4338CA', color: '#fff' }
                    : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }
                  }
                >
                  Email
                </button>
                <button
                  disabled
                  title="Slack integration coming soon"
                  className="flex-1 py-1.5 rounded-[7px] text-[12px] font-semibold opacity-40 cursor-not-allowed"
                  style={{ background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
                >
                  Slack <span className="text-[9px] font-normal">(soon)</span>
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Recipients</label>
              <input
                className={inputCls}
                placeholder="partner@firm.com, associate@firm.com"
                value={d.recipients as string}
                onChange={upd('recipients')}
              />
              <p className="text-[11px] text-text-3 mt-1.5">Separate multiple addresses with commas.</p>
            </div>
            <div>
              <label className={labelCls}>Message</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                placeholder="Use {contract} to insert the contract name."
                value={d.messageTemplate as string}
                onChange={upd('messageTemplate')}
              />
              <p className="text-[11px] text-text-3 mt-1.5">
                <code className="font-mono bg-surface px-1 py-0.5 rounded text-[10px]">{'{contract}'}</code> is replaced with the contract name at send time.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => onDeleteNode(selectedNode.id)}
          className="flex items-center gap-1.5 text-[12px] font-medium text-danger hover:text-danger/80 transition-colors"
        >
          <Trash2 size={12} /> Delete node
        </button>
      </div>
    </div>
  )
}

// ── Left Palette ──────────────────────────────────────────────────────────────

interface PaletteProps {
  workflows: Workflow[]
  activeWfId: string | null
  onLoadWorkflow: (wf: Workflow) => void
  onAddNode: (type: string) => void
  onNewWorkflow: () => void
  onDeleteWorkflow: (id: string) => void
}

function NodePalette({ workflows, activeWfId, onLoadWorkflow, onAddNode, onNewWorkflow, onDeleteWorkflow }: PaletteProps) {
  const [hoverWfId, setHoverWfId] = useState<string | null>(null)

  return (
    <div className="w-[196px] flex-shrink-0 flex flex-col border-r border-border bg-white overflow-y-auto">
      {/* Add Nodes */}
      <div className="px-3 pt-4 pb-2">
        <p className="text-[10px] font-semibold text-text-3 uppercase tracking-widest mb-3">Add Node</p>
        <div className="space-y-1.5">
          {PALETTE_TYPES.map(type => {
            const cfg = nodeTypeConfig[type]
            return (
              <div
                key={type}
                draggable
                onDragStart={e => { e.dataTransfer.setData('nodeType', type); e.dataTransfer.effectAllowed = 'move' }}
                onClick={() => onAddNode(type)}
                className="flex items-stretch bg-white rounded-[8px] border border-border cursor-grab active:cursor-grabbing hover:border-[#CBD5E1] hover:shadow-sm transition-all select-none"
              >
                <div className="w-[36px] flex items-center justify-center flex-shrink-0 rounded-l-[7px]" style={{ background: cfg.iconBg }}>
                  <NodeIcon type={type} color={cfg.color} />
                </div>
                <div className="flex-1 flex items-center px-2.5 py-2.5">
                  <p className="text-[12px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
                </div>
                <div className="flex items-center pr-2.5">
                  <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                    {[2,6,2,6,2,6].map((cx, i) => <circle key={i} cx={cx} cy={2 + Math.floor(i/2) * 4} r="1.2" fill="#CBD5E1"/>)}
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mx-3 my-3 h-px bg-border" />

      {/* Workflows */}
      <div className="px-3 pb-4 flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-text-3 uppercase tracking-widest">Workflows</p>
          <button
            onClick={onNewWorkflow}
            className="w-5 h-5 flex items-center justify-center rounded-[4px] text-text-3 hover:bg-surface hover:text-text-2 transition-colors"
            title="New workflow"
          >
            <Plus size={12} />
          </button>
        </div>
        <div className="space-y-1">
          {workflows.map(wf => (
            <div
              key={wf.id}
              className="group relative"
              onMouseEnter={() => setHoverWfId(wf.id)}
              onMouseLeave={() => setHoverWfId(null)}
            >
              <button
                onClick={() => onLoadWorkflow(wf)}
                className={`w-full text-left px-2.5 py-2 rounded-[7px] transition-colors pr-7 ${
                  activeWfId === wf.id ? 'bg-indigo-lt text-indigo' : 'text-text-2 hover:bg-surface'
                }`}
              >
                <p className="text-[12px] font-medium leading-snug truncate">{wf.name}</p>
                <p className="text-[10.5px] mt-0.5" style={{ color: activeWfId === wf.id ? '#6366F1' : '#94A3B8' }}>
                  {wf.nodes.length} nodes · {wf.status}
                </p>
              </button>
              {hoverWfId === wf.id && (
                <button
                  onClick={e => { e.stopPropagation(); onDeleteWorkflow(wf.id) }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-[4px] text-text-3 hover:text-danger hover:bg-danger-lt transition-colors"
                  title="Delete workflow"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
          {workflows.length === 0 && (
            <p className="text-[11.5px] text-text-3 px-2.5 py-2">No workflows yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── History helpers ───────────────────────────────────────────────────────────

type Snapshot = { nodes: Node[]; edges: Edge[] }

// ── Inner page (needs ReactFlowProvider) ─────────────────────────────────────

function WorkflowBuilderInner() {
  const { data: workflows = [], isLoading: wfLoading } = useWorkflows()
  const createWfMutation = useCreateWorkflow()
  const updateWfMutation = useUpdateWorkflow()
  const deleteWfMutation = useDeleteWorkflow()
  const runWfMutation = useRunWorkflow()

  const [activeWfId, setActiveWfId] = useState<string | null>(null)
  const [activeWf, setActiveWf] = useState<Workflow | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState('')
  const [localName, setLocalName] = useState<string | null>(null)
  const [runInfo, setRunInfo] = useState<string | null>(null)

  const history = useRef<Snapshot[]>([])
  const histIdx = useRef(-1)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Refs so handleSave always reads the latest values without stale closures
  const activeWfRef  = useRef<Workflow | null>(null)
  const localNameRef = useRef<string | null>(null)
  const nodesRef     = useRef<Node[]>([])
  const edgesRef     = useRef<Edge[]>([])
  useEffect(() => { activeWfRef.current  = activeWf  }, [activeWf])
  useEffect(() => { localNameRef.current = localName }, [localName])
  useEffect(() => { nodesRef.current     = nodes     }, [nodes])
  useEffect(() => { edgesRef.current     = edges     }, [edges])

  const { zoomIn, zoomOut } = useReactFlow()
  const { zoom: rfZoom } = useViewport()
  const zoom = Math.round(rfZoom * 100)

  // Load a workflow onto the canvas — sets activeWf as local state so it's
  // immediately available regardless of the server query cache state.
  const loadWorkflow = useCallback((wf: Workflow) => {
    const rfNodes = toRFNodes(wf)
    const rfEdges = toRFEdges(wf)
    setActiveWfId(wf.id)
    setActiveWf(wf)
    setNodes(rfNodes)
    setEdges(rfEdges)
    setSelectedNode(null)
    setSelectedEdge(null)
    setIsDirty(false)
    setSavedAt(null)
    setLocalName(null)
    setRunInfo(null)
    history.current = [{ nodes: rfNodes, edges: rfEdges }]
    histIdx.current = 0
  }, [setNodes, setEdges])

  // Init with first workflow once data loads
  useEffect(() => {
    if (!wfLoading && workflows.length > 0 && !activeWf) loadWorkflow(workflows[0])
  }, [wfLoading, workflows.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Push snapshot to history
  const pushHistory = useCallback((ns: Node[], es: Edge[]) => {
    const slice = history.current.slice(0, histIdx.current + 1)
    slice.push({ nodes: ns, edges: es })
    history.current = slice.slice(-30)
    histIdx.current = history.current.length - 1
  }, [])

  const canUndo = histIdx.current > 0
  const canRedo = histIdx.current < history.current.length - 1

  const handleUndo = useCallback(() => {
    if (!canUndo) return
    histIdx.current--
    const snap = history.current[histIdx.current]
    setNodes(snap.nodes)
    setEdges(snap.edges)
    setSelectedNode(null)
    setSelectedEdge(null)
    setIsDirty(true)
  }, [canUndo, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    if (!canRedo) return
    histIdx.current++
    const snap = history.current[histIdx.current]
    setNodes(snap.nodes)
    setEdges(snap.edges)
    setSelectedNode(null)
    setSelectedEdge(null)
    setIsDirty(true)
  }, [canRedo, setNodes, setEdges])

  // Connect nodes
  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => {
      const newEdges = addEdge({ ...connection, type: 'smoothstep', style: { stroke: '#CBD5E1', strokeWidth: 2 } }, eds)
      pushHistory(nodes, newEdges)
      return newEdges
    })
    setIsDirty(true)
  }, [setEdges, nodes, pushHistory])

  // Add node by click (from palette)
  const handleAddNode = useCallback((nodeType: string) => {
    const cfg = nodeTypeConfig[nodeType as keyof typeof nodeTypeConfig]
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position: { x: 80 + (nodes.length % 3) * 220, y: 80 + Math.floor(nodes.length / 3) * 140 },
      data: { label: cfg.label, description: '', ...getDefaultNodeData(nodeType) },
    }
    setNodes(nds => {
      const updated = [...nds, newNode]
      pushHistory(updated, edges)
      return updated
    })
    setIsDirty(true)
  }, [nodes.length, edges, setNodes, pushHistory])

  // Update node data from properties panel
  const updateNodeData = useCallback((key: string, value: unknown) => {
    if (!selectedNode) return
    const id = selectedNode.id
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n))
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, [key]: value } } : null)
    setIsDirty(true)
  }, [selectedNode, setNodes])

  // Delete node + its edges
  const deleteNode = useCallback((nodeId: string) => {
    setNodes(nds => {
      const newNodes = nds.filter(n => n.id !== nodeId)
      setEdges(eds => {
        const newEdges = eds.filter(e => e.source !== nodeId && e.target !== nodeId)
        pushHistory(newNodes, newEdges)
        return newEdges
      })
      return newNodes
    })
    setSelectedNode(null)
    setIsDirty(true)
  }, [setNodes, setEdges, pushHistory])

  // Update edge label
  const updateEdgeLabel = useCallback((edgeId: string, label: string) => {
    setEdges(eds => eds.map(e => e.id === edgeId ? { ...e, label } : e))
    setSelectedEdge(prev => prev ? { ...prev, label } : null)
    setIsDirty(true)
  }, [setEdges])

  // Delete edge
  const deleteEdge = useCallback((edgeId: string) => {
    setEdges(eds => {
      const newEdges = eds.filter(e => e.id !== edgeId)
      pushHistory(nodes, newEdges)
      return newEdges
    })
    setSelectedEdge(null)
    setIsDirty(true)
  }, [setEdges, nodes, pushHistory])

  // Stable canvas interaction callbacks (passed to FlowCanvas as stable refs)
  const handleNodeClickCb = useCallback((node: Node) => { setSelectedNode(node); setSelectedEdge(null) }, [])
  const handleEdgeClickCb = useCallback((edge: Edge) => { setSelectedEdge(edge); setSelectedNode(null) }, [])
  const handlePaneClickCb = useCallback(() => { setSelectedNode(null); setSelectedEdge(null) }, [])

  // Save — reads from refs so it always sees the latest state regardless of
  // when the callback was created (avoids stale-closure bugs with useCallback).
  const handleSave = useCallback(async () => {
    const wf = activeWfRef.current
    if (!wf) {
      setSaveError('No workflow loaded — use + to create one first')
      return
    }
    setSaveError(null)
    try {
      const updated = await updateWfMutation.mutateAsync({
        id: wf.id,
        name: localNameRef.current ?? wf.name,
        nodes: nodesRef.current.map(n => ({ id: n.id, type: n.type!, position: n.position, data: n.data })),
        edges: edgesRef.current.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label as string | undefined })),
      })
      setActiveWf(updated)
      setSavedAt(new Date())
      setIsDirty(false)
      setLocalName(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    }
  }, [updateWfMutation])

  // New workflow
  const handleNewWorkflow = useCallback(async () => {
    setSaveError(null)
    try {
      const newWf = await createWfMutation.mutateAsync({ name: 'New Workflow' })
      loadWorkflow(newWf)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create workflow')
    }
  }, [createWfMutation, loadWorkflow])

  // Delete workflow
  const handleDeleteWorkflow = useCallback(async (id: string) => {
    await deleteWfMutation.mutateAsync(id)
    if (activeWfId === id) {
      const remaining = workflows.filter(w => w.id !== id)
      if (remaining.length > 0) loadWorkflow(remaining[0])
      else { setNodes([]); setEdges([]); setActiveWfId(null); setActiveWf(null) }
    }
  }, [activeWfId, workflows, deleteWfMutation, loadWorkflow, setNodes, setEdges])

  // Rename — works regardless of whether activeWf is set yet
  const startRename = () => {
    setRenameVal(localName ?? activeWf?.name ?? '')
    setIsRenaming(true)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }
  const commitRename = () => {
    const name = renameVal.trim()
    if (name) {
      setLocalName(name)
      if (activeWf) setIsDirty(true)
    }
    setIsRenaming(false)
  }

  // Run
  const handleRun = useCallback(async () => {
    if (!activeWf || runWfMutation.isPending) return
    const result = await runWfMutation.mutateAsync({ id: activeWf.id })
    setRunInfo(`Run queued (ID: ${result.run_id.slice(0, 8)}…)`)
  }, [activeWf, runWfMutation])

  const displayName = localName ?? activeWf?.name ?? 'New Workflow'

  // Keyboard shortcut: Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo() }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave, handleUndo, handleRedo])

  const statusColor = activeWf?.status === 'active' ? '#059669' : activeWf?.status === 'paused' ? '#D97706' : '#475569'
  const statusBg    = activeWf?.status === 'active' ? '#D1FAE5' : activeWf?.status === 'paused' ? '#FEF3C7' : '#F1F5F9'

  const savedLabel = saveError ? saveError : runInfo ? runInfo : isDirty ? 'Unsaved changes' : savedAt ? `Saved ${timeAgo(savedAt)}` : activeWf ? 'All changes saved' : ''

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Topbar */}
      <div className="h-[56px] border-b border-border flex items-center gap-3 px-5 bg-white flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[13px] text-text-3">
          <span>AI Tools</span>
          <span className="text-border-dk">/</span>
          <span>Workflows</span>
          <span className="text-border-dk">/</span>
        </div>

        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="text-[14px] font-semibold text-text border-b border-indigo bg-transparent outline-none w-48"
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setIsRenaming(false) }}
          />
        ) : (
          <button
            onClick={startRename}
            className="flex items-center gap-1.5 text-[14px] font-semibold text-text hover:text-indigo transition-colors group"
            title="Click to rename"
          >
            {displayName}
            <PenLine size={12} className="text-text-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}

        {activeWf && (
          <span className="text-[11px] font-semibold px-2.5 py-[3px] rounded-pill" style={{ background: statusBg, color: statusColor }}>
            {activeWf.status.charAt(0).toUpperCase() + activeWf.status.slice(1)}
          </span>
        )}

        <span className={`text-[11.5px] ${saveError ? 'text-danger font-medium' : isDirty ? 'text-warning font-medium' : runInfo ? 'text-success font-medium' : 'text-text-3'}`}>{savedLabel}</span>

        <div className="flex-1" />

        {/* Undo / Redo */}
        <div className="flex items-center">
          <button onClick={handleUndo} disabled={!canUndo} title="Undo (⌘Z)" className={`w-[30px] h-[30px] flex items-center justify-center rounded-[6px] transition-colors ${canUndo ? 'text-text-2 hover:bg-surface' : 'text-text-3 opacity-40 cursor-not-allowed'}`}>
            <Undo2 size={14} />
          </button>
          <button onClick={handleRedo} disabled={!canRedo} title="Redo (⌘Y)" className={`w-[30px] h-[30px] flex items-center justify-center rounded-[6px] transition-colors ${canRedo ? 'text-text-2 hover:bg-surface' : 'text-text-3 opacity-40 cursor-not-allowed'}`}>
            <Redo2 size={14} />
          </button>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Zoom */}
        <div className="flex items-center">
          <button onClick={() => zoomOut({ duration: 150 })} className="w-[30px] h-[30px] flex items-center justify-center rounded-[6px] text-text-2 hover:bg-surface transition-colors">
            <Minus size={13} />
          </button>
          <span className="text-[12px] font-semibold text-text-2 w-11 text-center">{zoom}%</span>
          <button onClick={() => zoomIn({ duration: 150 })} className="w-[30px] h-[30px] flex items-center justify-center rounded-[6px] text-text-2 hover:bg-surface transition-colors">
            <Plus size={13} />
          </button>
        </div>

        <div className="w-px h-5 bg-border" />

        <button
          onClick={handleRun}
          disabled={!activeWf || runWfMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-[7px] text-[13px] font-semibold text-white bg-success rounded-[7px] hover:bg-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play size={13} fill="white" /> {runWfMutation.isPending ? 'Running…' : 'Run'}
        </button>
        <button
          onClick={handleSave}
          disabled={updateWfMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-[7px] text-[13px] font-semibold text-white bg-indigo rounded-[7px] hover:bg-indigo-dk transition-colors disabled:opacity-50"
        >
          <Save size={13} /> {updateWfMutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <NodePalette
          workflows={workflows}
          activeWfId={activeWfId}
          onLoadWorkflow={loadWorkflow}
          onAddNode={handleAddNode}
          onNewWorkflow={handleNewWorkflow}
          onDeleteWorkflow={handleDeleteWorkflow}
        />

        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          setNodes={setNodes}
          onNodeClick={handleNodeClickCb}
          onEdgeClick={handleEdgeClickCb}
          onPaneClick={handlePaneClickCb}
        />

        <PropertiesPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onUpdateNodeData={updateNodeData}
          onDeleteNode={deleteNode}
          onUpdateEdgeLabel={updateEdgeLabel}
          onDeleteEdge={deleteEdge}
        />
      </div>
    </div>
  )
}

// ── Page export (wraps with ReactFlowProvider) ────────────────────────────────

export function WorkflowBuilderPage() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  )
}
