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
  Zap, ChevronDown, ChevronRight, Info,
} from 'lucide-react'
import type { Workflow } from '@/types'
import { useWorkflows, useCreateWorkflow, useUpdateWorkflow, useDeleteWorkflow, useRunWorkflow } from '@/hooks/useWorkflow'

// ── Config ───────────────────────────────────────────────────────────────────

const nodeTypeConfig = {
  trigger: { label: 'Trigger',        color: '#059669', iconBg: '#DCFCE7' },
  ai:      { label: 'AI Process',     color: '#4338CA', iconBg: '#EEF2FF' },
  branch:  { label: 'Condition',      color: '#D97706', iconBg: '#FEF9C3' },
  action:  { label: 'Action',         color: '#475569', iconBg: '#F1F5F9' },
  notify:  { label: 'Notify',         color: '#7C3AED', iconBg: '#F5F3FF' },
  review:  { label: 'Human Review',   color: '#0369A1', iconBg: '#E0F2FE' },
}

// Output variables each node type produces — used for variable picker downstream
const nodeOutputVars: Record<string, { key: string; label: string; hint: string }[]> = {
  trigger: [
    { key: '{{document.name}}',    label: 'Document Name',  hint: 'Name of the triggering document' },
    { key: '{{document.type}}',    label: 'Document Type',  hint: 'e.g. NDA, MSA, Loan Agreement' },
    { key: '{{document.parties}}', label: 'Parties',        hint: 'Comma-separated list of parties' },
    { key: '{{document.date}}',    label: 'Effective Date', hint: 'Contract effective date' },
  ],
  ai: [
    { key: '{{ai.output}}',        label: 'Full AI Output', hint: 'Complete analysis text' },
    { key: '{{ai.summary}}',       label: 'Summary',        hint: 'Plain-language contract summary' },
    { key: '{{ai.risk_score}}',    label: 'Risk Score',     hint: 'Numeric risk score (0–100)' },
    { key: '{{ai.risk_level}}',    label: 'Risk Level',     hint: 'High / Medium / Low' },
    { key: '{{ai.findings}}',      label: 'Key Findings',   hint: 'Bulleted list of key findings' },
    { key: '{{ai.missing_clauses}}', label: 'Missing Clauses', hint: 'Clauses flagged as absent' },
    { key: '{{ai.obligations}}',   label: 'Obligations',    hint: 'Extracted obligations list' },
  ],
  action: [
    { key: '{{action.result}}',    label: 'Action Result',  hint: 'Confirmation / result of the action' },
  ],
  review: [
    { key: '{{review.decision}}',  label: 'Decision',       hint: 'Approved / Rejected / Escalated' },
    { key: '{{review.notes}}',     label: 'Reviewer Notes', hint: 'Notes entered by the reviewer' },
    { key: '{{review.reviewer}}',  label: 'Reviewer',       hint: 'Name / email of reviewer' },
  ],
}

const PALETTE_TYPES = ['trigger', 'ai', 'branch', 'action', 'notify', 'review'] as const

function getDefaultNodeData(type: string): Record<string, unknown> {
  switch (type) {
    case 'trigger': return {
      triggerType: 'upload',
      contractTypeFilter: '',
      scheduleInterval: 'weekly',
      scheduleTime: '09:00',
      scheduleDay: 'monday',
      scheduleDayOfMonth: '1',
    }
    case 'ai': return {
      analysisMode: 'full',
      customPrompt: '',
      outputVarName: 'ai',
    }
    case 'branch': return {
      field: 'ai.risk_score',
      operator: 'gte',
      value: '70',
      trueLabel: 'Yes',
      falseLabel: 'No',
    }
    case 'action': return {
      actionType: 'tag_contract',
      tagValue: '',
      collectionName: '',
      newStatus: 'approved',
      webhookUrl: '',
      webhookPayload: '{\n  "document": "{{document.name}}",\n  "summary": "{{ai.summary}}"\n}',
    }
    case 'notify': return {
      channel: 'email',
      recipients: '',
      subject: 'Workflow Alert: {{document.name}}',
      messageTemplate: 'Hello,\n\nThe following document has been processed:\n\nDocument: {{document.name}}\nType: {{document.type}}\n\nAI Summary:\n{{ai.summary}}\n\nRisk Score: {{ai.risk_score}}\n\nKey Findings:\n{{ai.findings}}\n\nRegards,\nLegalFlow',
      slackChannel: '#legal-alerts',
      slackMessage: '*Document:* {{document.name}}\n*Risk:* {{ai.risk_level}}\n\n{{ai.summary}}',
    }
    case 'review': return {
      reviewerEmails: '',
      instructions: 'Please review the AI analysis and approve or reject this document.',
      timeoutDays: '3',
      timeoutAction: 'escalate',
    }
    default: return {}
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

function NodeIcon({ type, color, size = 16 }: { type: string; color: string; size?: number }) {
  if (type === 'trigger') return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <polygon points="4,2 14,9 4,16" stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill={color + '30'}/>
    </svg>
  )
  if (type === 'ai') return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L10 6H14.5L11 8.5 12.5 13 8 10.5 3.5 13 5 8.5 1.5 6H6L8 1.5Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill={color + '20'}/>
    </svg>
  )
  if (type === 'branch') return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5" stroke={color} strokeWidth="1.3" fill={color + '20'}/>
      <path d="M5.5 8h5M8 5.5v5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'action') return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="4" width="12" height="8" rx="2" stroke={color} strokeWidth="1.3" fill={color + '20'}/>
      <path d="M5 8h6M9.5 6l2 2-2 2" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'review') return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="2" stroke={color} strokeWidth="1.3" fill={color + '20'}/>
      <path d="M5 8l2 2 4-4" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="6" r="3" stroke={color} strokeWidth="1.3" fill={color + '20'}/>
      <path d="M4 14c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

// ── Canvas node ───────────────────────────────────────────────────────────────

function WorkflowNode({ data, type, selected }: NodeProps) {
  const cfg = nodeTypeConfig[type as keyof typeof nodeTypeConfig] ?? nodeTypeConfig.action
  const outputs = nodeOutputVars[type ?? 'action'] ?? []

  return (
    <div
      className="flex items-stretch bg-white rounded-[10px] overflow-hidden"
      style={{
        width: 196,
        border: selected ? `1.5px solid ${cfg.color}` : '1.5px solid #E2E8F0',
        boxShadow: selected
          ? `0 0 0 3px ${cfg.color}20, 0 4px 12px ${cfg.color}25`
          : '0 1px 4px rgba(0,0,0,0.07)',
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
        {outputs.length > 0 && (
          <p className="text-[9px] text-text-3 mt-1 leading-tight truncate">
            Outputs: {outputs.slice(0, 2).map(v => v.key).join(', ')}{outputs.length > 2 ? '…' : ''}
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-white !border-2 !border-[#CBD5E1]" />
    </div>
  )
}

const nodeTypes = {
  trigger: WorkflowNode, ai: WorkflowNode, branch: WorkflowNode,
  action: WorkflowNode,  notify: WorkflowNode, review: WorkflowNode,
}

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
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-3">
          <div className="w-12 h-12 rounded-[10px] bg-white border border-border flex items-center justify-center shadow-sm">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="8" width="7" height="6" rx="2" stroke="#CBD5E1" strokeWidth="1.5"/>
              <rect x="13" y="3" width="7" height="6" rx="2" stroke="#CBD5E1" strokeWidth="1.5"/>
              <rect x="13" y="13" width="7" height="6" rx="2" stroke="#CBD5E1" strokeWidth="1.5"/>
              <path d="M9 11h2.5m1.5-5v3m0 6v-2" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-[13px] font-medium text-text-2">Drag a node from the left panel to start</p>
            <p className="text-[11.5px] text-text-3 mt-1">Connect nodes by dragging from the right handle to the left handle of the next node</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Variable Picker ───────────────────────────────────────────────────────────

function VariablePicker({
  allNodes,
  currentNodeId,
  onInsert,
}: {
  allNodes: Node[]
  currentNodeId: string
  onInsert: (variable: string) => void
}) {
  const [open, setOpen] = useState(false)

  const upstreamTypes = allNodes
    .filter(n => n.id !== currentNodeId && nodeOutputVars[n.type ?? ''])
    .map(n => ({ nodeId: n.id, type: n.type!, label: n.data.label as string, vars: nodeOutputVars[n.type!] }))

  if (upstreamTypes.length === 0) return (
    <p className="text-[10.5px] text-text-3 italic mt-1">Add upstream Trigger or AI nodes to unlock variables.</p>
  )

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo hover:text-indigo-dk transition-colors mt-1"
      >
        <Zap size={11} /> Insert variable {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-[280px] bg-white border border-border rounded-[10px] shadow-lg z-20 overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-surface">
              <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider">Available Variables</p>
              <p className="text-[10px] text-text-3 mt-0.5">Click to insert into your message</p>
            </div>
            <div className="max-h-[240px] overflow-y-auto divide-y divide-border">
              {upstreamTypes.map(({ nodeId, label, vars }) => (
                <div key={nodeId} className="px-3 py-2">
                  <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1.5">{label}</p>
                  <div className="flex flex-wrap gap-1">
                    {vars.map(v => (
                      <button
                        key={v.key}
                        title={v.hint}
                        onClick={() => { onInsert(v.key); setOpen(false) }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-lt border border-indigo-mid rounded-[4px] text-[10.5px] font-mono font-semibold text-indigo hover:bg-indigo/10 transition-colors"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Output Schema Display ─────────────────────────────────────────────────────

function OutputSchemaInfo({ type }: { type: string }) {
  const vars = nodeOutputVars[type] ?? []
  if (vars.length === 0) return null
  return (
    <div className="rounded-[8px] bg-[#F8FAFC] border border-border p-3 mt-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Info size={11} className="text-text-3 flex-shrink-0" />
        <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider">This node outputs</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {vars.map(v => (
          <span key={v.key} title={v.hint}
            className="inline-flex items-center px-2 py-0.5 bg-white border border-border rounded-[4px] text-[10px] font-mono text-text-2">
            {v.key}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-text-3 mt-1.5">Reference these in any downstream Notify or Action node.</p>
    </div>
  )
}

// ── Properties Panel ──────────────────────────────────────────────────────────

interface PropsPanelProps {
  selectedNode: Node | null
  selectedEdge: Edge | null
  allNodes: Node[]
  onUpdateNodeData: (key: string, value: unknown) => void
  onDeleteNode: (id: string) => void
  onUpdateEdgeLabel: (id: string, label: string) => void
  onDeleteEdge: (id: string) => void
}

const fieldOptions = [
  { value: 'ai.risk_score',    label: 'AI Risk Score (0–100)' },
  { value: 'ai.risk_level',    label: 'AI Risk Level' },
  { value: 'contract_type',    label: 'Contract Type' },
  { value: 'page_count',       label: 'Page Count' },
  { value: 'days_to_expiry',   label: 'Days to Expiry' },
  { value: 'parties_count',    label: 'Parties Count' },
]

const operatorOptions = [
  { value: 'gte',      label: '≥ (greater or equal)' },
  { value: 'lte',      label: '≤ (less or equal)' },
  { value: 'eq',       label: '= (equals)' },
  { value: 'neq',      label: '≠ (not equals)' },
  { value: 'contains', label: 'contains' },
]

const inputCls = 'w-full px-3 py-2 text-[13px] border border-border rounded-[7px] bg-white text-text focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo'
const labelCls = 'block text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1.5'
const sectionCls = 'space-y-4'

function PropertiesPanel({ selectedNode, selectedEdge, allNodes, onUpdateNodeData, onDeleteNode, onUpdateEdgeLabel, onDeleteEdge }: PropsPanelProps) {
  const [copied, setCopied] = useState(false)
  const msgRef = useRef<HTMLTextAreaElement>(null)

  const d = selectedNode?.data ?? {}
  const cfg = selectedNode ? (nodeTypeConfig[selectedNode.type as keyof typeof nodeTypeConfig] ?? nodeTypeConfig.action) : null

  function upd(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onUpdateNodeData(key, e.target.value)
  }

  function insertVariable(variable: string) {
    const el = msgRef.current
    if (!el) {
      onUpdateNodeData('messageTemplate', ((d.messageTemplate as string) ?? '') + variable)
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end   = el.selectionEnd   ?? el.value.length
    const newVal = el.value.slice(0, start) + variable + el.value.slice(end)
    onUpdateNodeData('messageTemplate', newVal)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + variable.length, start + variable.length)
    }, 0)
  }

  function insertSlackVariable(variable: string) {
    const current = (d.slackMessage as string) ?? ''
    onUpdateNodeData('slackMessage', current + variable)
  }

  // Edge selected
  if (selectedEdge) {
    return (
      <div className="w-[280px] flex-shrink-0 flex flex-col border-l border-border bg-white overflow-y-auto">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="w-9 h-9 rounded-[8px] bg-surface flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M10 5l3 3-3 3" stroke="#475569" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[13.5px] font-bold text-text">Connection</p>
            <span className="text-[11px] text-text-3">Label this path</span>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <div>
            <label className={labelCls}>Path Label</label>
            <input
              className={inputCls}
              placeholder='e.g. "High Risk", "Approved", "Yes", "No"'
              value={(selectedEdge.label as string) ?? ''}
              onChange={e => onUpdateEdgeLabel(selectedEdge.id, e.target.value)}
            />
            <p className="text-[11px] text-text-3 mt-1.5">Labels appear on the connecting arrow to describe the condition outcome or data flowing through this path.</p>
          </div>
        </div>
        <div className="p-4 border-t border-border">
          <button onClick={() => onDeleteEdge(selectedEdge.id)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-danger hover:text-danger/80 transition-colors">
            <Trash2 size={12} /> Delete connection
          </button>
        </div>
      </div>
    )
  }

  // Nothing selected
  if (!selectedNode || !cfg) {
    return (
      <div className="w-[280px] flex-shrink-0 flex flex-col border-l border-border bg-white">
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
            <p className="text-[11px] text-text-3 mt-1">Click any node or connection to configure it</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[280px] flex-shrink-0 flex flex-col border-l border-border bg-white overflow-y-auto">
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
            <label className={labelCls}>Step Name</label>
            <input className={inputCls} value={d.label as string} onChange={upd('label')} />
          </div>
          <div>
            <label className={labelCls}>Description (optional)</label>
            <textarea className={`${inputCls} resize-none`} rows={2}
              placeholder="What does this step do?"
              value={d.description as string} onChange={upd('description')} />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* ── Trigger ── */}
        {selectedNode.type === 'trigger' && (
          <div className={sectionCls}>
            <div>
              <label className={labelCls}>Trigger Type</label>
              <select className={inputCls} value={d.triggerType as string} onChange={upd('triggerType')}>
                <option value="upload">New Contract Uploaded</option>
                <option value="schedule">Scheduled (Time-based)</option>
                <option value="webhook">Incoming Webhook</option>
                <option value="manual">Manual Run</option>
              </select>
            </div>

            {d.triggerType === 'upload' && (
              <div>
                <label className={labelCls}>Contract Type Filter</label>
                <select className={inputCls} value={d.contractTypeFilter as string} onChange={upd('contractTypeFilter')}>
                  <option value="">Any type</option>
                  {['NDA', 'MSA', 'SaaS Agreement', 'Employment Agreement', 'SOW', 'DPA',
                    'Shareholders Agreement', 'Share Subscription Agreement', 'Business Transfer Agreement',
                    'Consulting Agreement', 'Service Agreement', 'Lease Agreement', 'Loan Agreement',
                  ].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <p className="text-[11px] text-text-3 mt-1.5">Only trigger when the uploaded contract matches this type. Leave blank for any.</p>
              </div>
            )}

            {d.triggerType === 'schedule' && (
              <>
                <div>
                  <label className={labelCls}>Frequency</label>
                  <select className={inputCls} value={d.scheduleInterval as string} onChange={upd('scheduleInterval')}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Time of Day</label>
                  <input type="time" className={inputCls} value={d.scheduleTime as string} onChange={upd('scheduleTime')} />
                </div>
                {d.scheduleInterval === 'weekly' && (
                  <div>
                    <label className={labelCls}>Day of Week</label>
                    <select className={inputCls} value={d.scheduleDay as string} onChange={upd('scheduleDay')}>
                      {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                        <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                      ))}
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
              </>
            )}

            {d.triggerType === 'webhook' && (
              <div>
                <label className={labelCls}>Webhook Endpoint</label>
                <div className="flex gap-1.5">
                  <input readOnly className={`${inputCls} flex-1 text-text-3 text-[11.5px] bg-surface cursor-text`}
                    value="https://api.legalflow.io/hooks/{{workflow_id}}" />
                  <button className="flex items-center gap-1 px-2.5 py-2 rounded-[7px] border border-border text-[11px] font-medium text-text-2 hover:bg-surface transition-colors flex-shrink-0"
                    onClick={() => { navigator.clipboard.writeText('https://api.legalflow.io/hooks/...'); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
                    {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                  </button>
                </div>
                <p className="text-[11px] text-text-3 mt-1.5">Send a POST with <code className="font-mono bg-surface px-1 rounded text-[10px]">contract_id</code> in the body to trigger this workflow.</p>
              </div>
            )}

            <OutputSchemaInfo type="trigger" />
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
                  { value: 'full',          label: 'Full contract analysis',     hint: 'Risk score + summary + key findings' },
                  { value: 'risk_only',     label: 'Risk clause detection',      hint: 'Flags problematic clauses + risk score' },
                  { value: 'clause_audit',  label: 'Clause audit (playbook)',    hint: 'Checks presence of required clauses' },
                  { value: 'obligations',   label: 'Extract obligations',        hint: 'Pulls all deadlines and duties' },
                  { value: 'summary',       label: 'Plain-language summary',     hint: 'Clear, concise summary only' },
                  { value: 'custom',        label: 'Custom AI instruction',      hint: 'Write your own prompt for the AI' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-start gap-2.5 cursor-pointer" onClick={() => onUpdateNodeData('analysisMode', opt.value)}>
                    <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ borderColor: d.analysisMode === opt.value ? '#4338CA' : '#CBD5E1' }}>
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

            {d.analysisMode === 'custom' && (
              <div>
                <label className={labelCls}>Your AI Instruction</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={5}
                  placeholder={`Describe what you want the AI to do, e.g.:\n\n"Review the indemnification and limitation of liability clauses. Identify any one-sided terms and suggest balanced alternatives."`}
                  value={(d.customPrompt as string) ?? ''}
                  onChange={upd('customPrompt')}
                />
                <p className="text-[11px] text-text-3 mt-1.5">You can reference <code className="font-mono bg-surface px-1 rounded text-[10px]">{'{{document.name}}'}</code> and <code className="font-mono bg-surface px-1 rounded text-[10px]">{'{{document.type}}'}</code> in your instruction.</p>
              </div>
            )}

            <OutputSchemaInfo type="ai" />
          </div>
        )}

        {/* ── Branch / Condition ── */}
        {selectedNode.type === 'branch' && (
          <div className={sectionCls}>
            <div>
              <label className={labelCls}>Condition</label>
              <div className="space-y-2">
                <select className={inputCls} value={d.field as string} onChange={upd('field')}>
                  {fieldOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className="flex gap-1.5 items-center">
                  <select className={`${inputCls} flex-1`} value={d.operator as string} onChange={upd('operator')}>
                    {operatorOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input
                    className="w-20 px-2 py-2 text-[13px] border border-border rounded-[7px] bg-white text-text focus:outline-none focus:border-indigo"
                    value={d.value as string}
                    onChange={upd('value')}
                    placeholder="70"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>True path label</label>
                <input className={inputCls} value={(d.trueLabel as string) ?? 'Yes'} onChange={upd('trueLabel')} placeholder="Yes / High Risk" />
              </div>
              <div>
                <label className={labelCls}>False path label</label>
                <input className={inputCls} value={(d.falseLabel as string) ?? 'No'} onChange={upd('falseLabel')} placeholder="No / Low Risk" />
              </div>
            </div>

            <div className="rounded-[8px] bg-indigo-lt border border-indigo-mid p-3">
              <p className="text-[11.5px] text-indigo leading-relaxed">
                Draw two connections out from this node — label each one using the condition labels above, or click a connection to rename it.
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
                <optgroup label="Document">
                  <option value="tag_contract">Tag Contract</option>
                  <option value="move_collection">Move to Folder</option>
                  <option value="update_status">Update Contract Status</option>
                </optgroup>
                <optgroup label="AI Analysis">
                  <option value="run_clause_audit">Run Clause Audit</option>
                  <option value="extract_obligations">Extract Obligations</option>
                  <option value="generate_timeline">Generate Timeline</option>
                </optgroup>
                <optgroup label="Integrations">
                  <option value="webhook">Send to Webhook (POST)</option>
                  <option value="create_task">Create Task (Jira/Linear)</option>
                </optgroup>
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
                <label className={labelCls}>Folder Name</label>
                <input className={inputCls} placeholder='e.g. "Flagged" or "Approved"' value={d.collectionName as string} onChange={upd('collectionName')} />
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

            {d.actionType === 'webhook' && (
              <>
                <div>
                  <label className={labelCls}>Webhook URL</label>
                  <input className={inputCls} placeholder="https://hooks.example.com/..." value={(d.webhookUrl as string) ?? ''} onChange={upd('webhookUrl')} />
                </div>
                <div>
                  <label className={labelCls}>JSON Payload</label>
                  <textarea className={`${inputCls} resize-none font-mono text-[11.5px]`} rows={5}
                    value={(d.webhookPayload as string) ?? ''}
                    onChange={upd('webhookPayload')} />
                  <p className="text-[10.5px] text-text-3 mt-1.5">Use <code className="font-mono bg-surface px-1 rounded text-[10px]">{'{{ai.summary}}'}</code>, <code className="font-mono bg-surface px-1 rounded text-[10px]">{'{{document.name}}'}</code> etc. in the payload.</p>
                </div>
              </>
            )}

            {(d.actionType === 'run_clause_audit' || d.actionType === 'extract_obligations' || d.actionType === 'generate_timeline') && (
              <div className="rounded-[8px] bg-surface border border-border p-3">
                <p className="text-[11.5px] text-text-3 leading-relaxed">
                  {d.actionType === 'run_clause_audit'    && 'Automatically runs a clause audit using the playbook for this contract type. Results appear in Clause Audit.'}
                  {d.actionType === 'extract_obligations' && 'Extracts all obligations and deadlines from the contract and adds them to Obligation Tracking.'}
                  {d.actionType === 'generate_timeline'   && 'Generates a timeline of key dates and milestones from the contract and adds it to Timeline Generator.'}
                </p>
              </div>
            )}

            <OutputSchemaInfo type="action" />
          </div>
        )}

        {/* ── Notify ── */}
        {selectedNode.type === 'notify' && (
          <div className={sectionCls}>
            <div>
              <label className={labelCls}>Notification Channel</label>
              <div className="flex gap-1.5">
                {(['email', 'slack', 'webhook'] as const).map(ch => (
                  <button key={ch} onClick={() => onUpdateNodeData('channel', ch)}
                    className="flex-1 py-1.5 rounded-[7px] text-[12px] font-semibold transition-colors capitalize"
                    style={d.channel === ch
                      ? { background: '#4338CA', color: '#fff' }
                      : { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }
                    }
                  >{ch}</button>
                ))}
              </div>
            </div>

            {/* Email */}
            {d.channel === 'email' && (
              <>
                <div>
                  <label className={labelCls}>Recipients</label>
                  <input className={inputCls} placeholder="partner@firm.com, associate@firm.com"
                    value={d.recipients as string} onChange={upd('recipients')} />
                  <p className="text-[11px] text-text-3 mt-1">Separate multiple addresses with commas.</p>
                </div>
                <div>
                  <label className={labelCls}>Subject</label>
                  <input className={inputCls} placeholder="Workflow Alert: {{document.name}}"
                    value={(d.subject as string) ?? ''} onChange={upd('subject')} />
                </div>
                <div>
                  <label className={labelCls}>Message Body</label>
                  <textarea ref={msgRef}
                    className={`${inputCls} resize-none font-mono text-[11.5px]`}
                    rows={7}
                    placeholder="Write your message. Use variables like {{ai.summary}}, {{document.name}}, {{ai.risk_score}}…"
                    value={(d.messageTemplate as string) ?? ''}
                    onChange={upd('messageTemplate')}
                  />
                  <VariablePicker allNodes={allNodes} currentNodeId={selectedNode.id} onInsert={insertVariable} />
                </div>
              </>
            )}

            {/* Slack */}
            {d.channel === 'slack' && (
              <>
                <div>
                  <label className={labelCls}>Slack Channel</label>
                  <input className={inputCls} placeholder="#legal-alerts"
                    value={(d.slackChannel as string) ?? ''} onChange={upd('slackChannel')} />
                </div>
                <div>
                  <label className={labelCls}>Message</label>
                  <textarea className={`${inputCls} resize-none font-mono text-[11.5px]`} rows={5}
                    placeholder="*Document:* {{document.name}}&#10;*Risk:* {{ai.risk_level}}&#10;&#10;{{ai.summary}}"
                    value={(d.slackMessage as string) ?? ''}
                    onChange={upd('slackMessage')}
                  />
                  <VariablePicker allNodes={allNodes} currentNodeId={selectedNode.id} onInsert={insertSlackVariable} />
                </div>
                <div className="rounded-[8px] bg-surface border border-border p-3">
                  <p className="text-[11px] text-text-3 leading-relaxed">Connect your Slack workspace in <strong className="text-text-2">Settings → Integrations</strong> to enable delivery.</p>
                </div>
              </>
            )}

            {/* Webhook */}
            {d.channel === 'webhook' && (
              <>
                <div>
                  <label className={labelCls}>Webhook URL</label>
                  <input className={inputCls} placeholder="https://hooks.zapier.com/..."
                    value={(d.webhookUrl as string) ?? ''} onChange={upd('webhookUrl')} />
                </div>
                <div>
                  <label className={labelCls}>JSON Payload</label>
                  <textarea className={`${inputCls} resize-none font-mono text-[11.5px]`} rows={5}
                    value={(d.webhookPayload as string) ?? '{\n  "document": "{{document.name}}",\n  "summary": "{{ai.summary}}",\n  "risk_score": "{{ai.risk_score}}"\n}'}
                    onChange={upd('webhookPayload')}
                  />
                  <VariablePicker allNodes={allNodes} currentNodeId={selectedNode.id} onInsert={(v) => onUpdateNodeData('webhookPayload', ((d.webhookPayload as string) ?? '') + v)} />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Human Review ── */}
        {selectedNode.type === 'review' && (
          <div className={sectionCls}>
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-[8px] bg-[#E0F2FE] border border-[#BAE6FD]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5">
                <rect x="1" y="1" width="12" height="12" rx="2" stroke="#0369A1" strokeWidth="1.1" fill="#0369A115"/>
                <path d="M4 7l2 2 4-4" stroke="#0369A1" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-[11.5px] font-semibold text-[#0369A1]">Pauses the workflow until a designated reviewer approves or rejects.</p>
            </div>

            <div>
              <label className={labelCls}>Reviewer Emails</label>
              <input className={inputCls} placeholder="partner@firm.com, gc@company.com"
                value={(d.reviewerEmails as string) ?? ''} onChange={upd('reviewerEmails')} />
              <p className="text-[11px] text-text-3 mt-1">Reviewers receive an email with the AI analysis and approve/reject buttons.</p>
            </div>

            <div>
              <label className={labelCls}>Instructions for Reviewer</label>
              <textarea className={`${inputCls} resize-none`} rows={3}
                placeholder="Please review the AI risk analysis and decide whether to proceed…"
                value={(d.instructions as string) ?? ''} onChange={upd('instructions')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Timeout (days)</label>
                <input type="number" min="1" max="30" className={inputCls}
                  value={(d.timeoutDays as string) ?? '3'} onChange={upd('timeoutDays')} />
              </div>
              <div>
                <label className={labelCls}>If no response</label>
                <select className={inputCls} value={(d.timeoutAction as string) ?? 'escalate'} onChange={upd('timeoutAction')}>
                  <option value="escalate">Escalate to admin</option>
                  <option value="approve">Auto-approve</option>
                  <option value="reject">Auto-reject</option>
                  <option value="pause">Keep waiting</option>
                </select>
              </div>
            </div>

            <OutputSchemaInfo type="review" />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button onClick={() => onDeleteNode(selectedNode.id)}
          className="flex items-center gap-1.5 text-[12px] font-medium text-danger hover:text-danger/80 transition-colors">
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
    <div className="w-[200px] flex-shrink-0 flex flex-col border-r border-border bg-white overflow-y-auto">
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
                  <NodeIcon type={type} color={cfg.color} size={14} />
                </div>
                <div className="flex-1 flex items-center px-2 py-2">
                  <p className="text-[11.5px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
                </div>
                <div className="flex items-center pr-2">
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
          <button onClick={onNewWorkflow}
            className="w-5 h-5 flex items-center justify-center rounded-[4px] text-text-3 hover:bg-surface hover:text-text-2 transition-colors"
            title="New workflow">
            <Plus size={12} />
          </button>
        </div>
        <div className="space-y-1">
          {workflows.map(wf => (
            <div key={wf.id} className="group relative"
              onMouseEnter={() => setHoverWfId(wf.id)}
              onMouseLeave={() => setHoverWfId(null)}>
              <button onClick={() => onLoadWorkflow(wf)}
                className={`w-full text-left px-2.5 py-2 rounded-[7px] transition-colors pr-7 ${
                  activeWfId === wf.id ? 'bg-indigo-lt text-indigo' : 'text-text-2 hover:bg-surface'
                }`}>
                <p className="text-[12px] font-medium leading-snug truncate">{wf.name}</p>
                <p className="text-[10.5px] mt-0.5" style={{ color: activeWfId === wf.id ? '#6366F1' : '#94A3B8' }}>
                  {wf.nodes.length} steps · {wf.status}
                </p>
              </button>
              {hoverWfId === wf.id && (
                <button onClick={e => { e.stopPropagation(); onDeleteWorkflow(wf.id) }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-[4px] text-text-3 hover:text-danger hover:bg-danger-lt transition-colors"
                  title="Delete workflow">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
          {workflows.length === 0 && (
            <p className="text-[11.5px] text-text-3 px-2.5 py-2">No workflows yet. Click + to create one.</p>
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

  useEffect(() => {
    if (!wfLoading && workflows.length > 0 && !activeWf) loadWorkflow(workflows[0])
  }, [wfLoading, workflows.length]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setNodes(snap.nodes); setEdges(snap.edges)
    setSelectedNode(null); setSelectedEdge(null)
    setIsDirty(true)
  }, [canUndo, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    if (!canRedo) return
    histIdx.current++
    const snap = history.current[histIdx.current]
    setNodes(snap.nodes); setEdges(snap.edges)
    setSelectedNode(null); setSelectedEdge(null)
    setIsDirty(true)
  }, [canRedo, setNodes, setEdges])

  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => {
      const newEdges = addEdge({ ...connection, type: 'smoothstep', style: { stroke: '#CBD5E1', strokeWidth: 2 } }, eds)
      pushHistory(nodes, newEdges)
      return newEdges
    })
    setIsDirty(true)
  }, [setEdges, nodes, pushHistory])

  const handleAddNode = useCallback((nodeType: string) => {
    const cfg = nodeTypeConfig[nodeType as keyof typeof nodeTypeConfig]
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position: { x: 80 + (nodes.length % 4) * 220, y: 80 + Math.floor(nodes.length / 4) * 160 },
      data: { label: cfg.label, description: '', ...getDefaultNodeData(nodeType) },
    }
    setNodes(nds => {
      const updated = [...nds, newNode]
      pushHistory(updated, edges)
      return updated
    })
    setIsDirty(true)
  }, [nodes.length, edges, setNodes, pushHistory])

  const updateNodeData = useCallback((key: string, value: unknown) => {
    if (!selectedNode) return
    const id = selectedNode.id
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n))
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, [key]: value } } : null)
    setIsDirty(true)
  }, [selectedNode, setNodes])

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

  const updateEdgeLabel = useCallback((edgeId: string, label: string) => {
    setEdges(eds => eds.map(e => e.id === edgeId ? { ...e, label } : e))
    setSelectedEdge(prev => prev ? { ...prev, label } : null)
    setIsDirty(true)
  }, [setEdges])

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges(eds => {
      const newEdges = eds.filter(e => e.id !== edgeId)
      pushHistory(nodes, newEdges)
      return newEdges
    })
    setSelectedEdge(null)
    setIsDirty(true)
  }, [setEdges, nodes, pushHistory])

  const handleNodeClickCb = useCallback((node: Node) => { setSelectedNode(node); setSelectedEdge(null) }, [])
  const handleEdgeClickCb = useCallback((edge: Edge) => { setSelectedEdge(edge); setSelectedNode(null) }, [])
  const handlePaneClickCb = useCallback(() => { setSelectedNode(null); setSelectedEdge(null) }, [])

  const handleSave = useCallback(async () => {
    const wf = activeWfRef.current
    if (!wf) { setSaveError('No workflow loaded — use + to create one first'); return }
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

  const handleNewWorkflow = useCallback(async () => {
    setSaveError(null)
    try {
      const newWf = await createWfMutation.mutateAsync({ name: 'New Workflow' })
      loadWorkflow(newWf)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create workflow')
    }
  }, [createWfMutation, loadWorkflow])

  const handleDeleteWorkflow = useCallback(async (id: string) => {
    await deleteWfMutation.mutateAsync(id)
    if (activeWfId === id) {
      const remaining = workflows.filter(w => w.id !== id)
      if (remaining.length > 0) loadWorkflow(remaining[0])
      else { setNodes([]); setEdges([]); setActiveWfId(null); setActiveWf(null) }
    }
  }, [activeWfId, workflows, deleteWfMutation, loadWorkflow, setNodes, setEdges])

  const startRename = () => {
    setRenameVal(localName ?? activeWf?.name ?? '')
    setIsRenaming(true)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }
  const commitRename = () => {
    const name = renameVal.trim()
    if (name) { setLocalName(name); if (activeWf) setIsDirty(true) }
    setIsRenaming(false)
  }

  const handleRun = useCallback(async () => {
    if (!activeWf || runWfMutation.isPending) return
    const result = await runWfMutation.mutateAsync({ id: activeWf.id })
    setRunInfo(`Run queued (ID: ${result.run_id.slice(0, 8)}…)`)
  }, [activeWf, runWfMutation])

  const handleSetStatus = useCallback(async (status: 'draft' | 'active' | 'paused') => {
    if (!activeWf || updateWfMutation.isPending) return
    const updated = await updateWfMutation.mutateAsync({
      id: activeWf.id,
      status,
      name: localNameRef.current ?? activeWf.name,
      nodes: nodesRef.current.map(n => ({ id: n.id, type: n.type!, position: n.position, data: n.data })),
      edges: edgesRef.current.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label as string | undefined })),
    })
    setActiveWf(updated)
    if (status === 'active') {
      setSaveError(null)
      setSavedAt(new Date())
      setIsDirty(false)
      setRunInfo(null)
    }
  }, [activeWf, updateWfMutation])

  const displayName = localName ?? activeWf?.name ?? 'New Workflow'

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
  const savedLabel  = saveError ? saveError : runInfo ? runInfo : isDirty ? 'Unsaved changes' : savedAt ? `Saved ${timeAgo(savedAt)}` : activeWf ? 'All changes saved' : ''

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
          <input ref={renameInputRef}
            className="text-[14px] font-semibold text-text border-b border-indigo bg-transparent outline-none w-48"
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setIsRenaming(false) }}
          />
        ) : (
          <button onClick={startRename}
            className="flex items-center gap-1.5 text-[14px] font-semibold text-text hover:text-indigo transition-colors group"
            title="Click to rename">
            {displayName}
            <PenLine size={12} className="text-text-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}

        {activeWf && (
          <span className="text-[11px] font-semibold px-2.5 py-[3px] rounded-pill" style={{ background: statusBg, color: statusColor }}>
            {activeWf.status.charAt(0).toUpperCase() + activeWf.status.slice(1)}
          </span>
        )}

        <span className={`text-[11.5px] ${saveError ? 'text-danger font-medium' : isDirty ? 'text-warning font-medium' : runInfo ? 'text-success font-medium' : 'text-text-3'}`}>
          {savedLabel}
        </span>

        <div className="flex-1" />

        <div className="flex items-center">
          <button onClick={handleUndo} disabled={!canUndo} title="Undo (⌘Z)"
            className={`w-[30px] h-[30px] flex items-center justify-center rounded-[6px] transition-colors ${canUndo ? 'text-text-2 hover:bg-surface' : 'text-text-3 opacity-40 cursor-not-allowed'}`}>
            <Undo2 size={14} />
          </button>
          <button onClick={handleRedo} disabled={!canRedo} title="Redo (⌘Y)"
            className={`w-[30px] h-[30px] flex items-center justify-center rounded-[6px] transition-colors ${canRedo ? 'text-text-2 hover:bg-surface' : 'text-text-3 opacity-40 cursor-not-allowed'}`}>
            <Redo2 size={14} />
          </button>
        </div>

        <div className="w-px h-5 bg-border" />

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

        <button onClick={handleRun} disabled={!activeWf || runWfMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-[7px] text-[13px] font-semibold text-white bg-success rounded-[7px] hover:bg-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Play size={13} fill="white" /> {runWfMutation.isPending ? 'Running…' : 'Run'}
        </button>
        <button onClick={handleSave} disabled={updateWfMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-[7px] text-[13px] font-semibold text-white bg-indigo rounded-[7px] hover:bg-indigo-dk transition-colors disabled:opacity-50">
          <Save size={13} /> {updateWfMutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => handleSetStatus(activeWf?.status === 'active' ? 'draft' : 'active')}
          disabled={!activeWf || updateWfMutation.isPending}
          className={`flex items-center gap-1.5 px-4 py-[7px] text-[13px] font-semibold rounded-[7px] transition-colors disabled:opacity-50 ${activeWf?.status === 'active' ? 'text-text-2 bg-surface hover:bg-border' : 'text-white bg-warning hover:bg-warning/90'}`}
        >
          {activeWf?.status === 'active' ? 'Deactivate' : 'Activate'}
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
          allNodes={nodes}
          onUpdateNodeData={updateNodeData}
          onDeleteNode={deleteNode}
          onUpdateEdgeLabel={updateEdgeLabel}
          onDeleteEdge={deleteEdge}
        />
      </div>
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export function WorkflowBuilderPage() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  )
}
