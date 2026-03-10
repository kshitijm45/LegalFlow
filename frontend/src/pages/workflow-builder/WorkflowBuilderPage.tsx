import { useState, useCallback } from 'react'
import ReactFlow, {
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Play, Save, Undo2, Redo2, Plus, Minus, Trash2 } from 'lucide-react'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { useWorkflows } from '@/hooks/useMockQuery'
import type { Workflow } from '@/types'

const nodeTypeConfig = {
  trigger: { label: 'Trigger',        color: '#059669', iconBg: '#DCFCE7' },
  ai:      { label: 'AI Process',     color: '#4338CA', iconBg: '#EEF2FF' },
  branch:  { label: 'Branch / Logic', color: '#D97706', iconBg: '#FEF9C3' },
  action:  { label: 'Action',         color: '#475569', iconBg: '#F1F5F9' },
  notify:  { label: 'Notify',         color: '#7C3AED', iconBg: '#F5F3FF' },
}

const PALETTE_NODE_TYPES = ['trigger', 'ai', 'branch', 'action', 'notify'] as const

function NodeIcon({ type, color }: { type: string; color: string }) {
  if (type === 'trigger') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M4 4h10l-1.5 5H5.5L4 4z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M9 13V8M7 13h4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'ai') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L10 6H14.5L11 8.5 12.5 13 8 10.5 3.5 13 5 8.5 1.5 6H6L8 1.5Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'branch') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 12V4M12 4v3M12 11v1M4 4l8 0M8 8l4 3M8 8l4-3" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
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

function WorkflowNode({ data, type, selected }: NodeProps) {
  const config = nodeTypeConfig[type as keyof typeof nodeTypeConfig] ?? nodeTypeConfig.action
  return (
    <div
      className="flex items-stretch bg-white rounded-[10px] overflow-hidden"
      style={{
        width: 180,
        border: selected ? `1.5px solid ${config.color}` : '1.5px solid #E2E8F0',
        boxShadow: selected
          ? `0 0 0 3px ${config.color}20, 0 4px 12px ${config.color}25`
          : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-white !border-2 !border-[#CBD5E1]" />
      <div className="w-[44px] flex items-center justify-center flex-shrink-0 rounded-l-[8px]" style={{ background: config.iconBg }}>
        <NodeIcon type={type ?? 'action'} color={config.color} />
      </div>
      <div className="flex-1 py-2.5 px-3 min-w-0">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.07em] mb-0.5" style={{ color: config.color }}>
          {config.label}
        </p>
        <p className="text-[12.5px] font-semibold text-text leading-snug truncate">{data.label}</p>
      </div>
      <div className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] rounded-full border-[1.5px] border-white bg-border-dk" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-white !border-2 !border-[#CBD5E1]" />
    </div>
  )
}

const nodeTypes = {
  trigger: WorkflowNode,
  ai: WorkflowNode,
  branch: WorkflowNode,
  action: WorkflowNode,
  notify: WorkflowNode,
}

function toRFNodes(workflow: Workflow): Node[] {
  return workflow.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
  }))
}

function toRFEdges(workflow: Workflow): Edge[] {
  return workflow.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: 'smoothstep',
    style: { stroke: '#CBD5E1', strokeWidth: 2 },
    labelStyle: { fontSize: 9, fill: '#059669', fontWeight: 700 },
    labelBgStyle: { fill: '#D1FAE5', stroke: 'none', borderRadius: 3 },
  }))
}

// ── Inner canvas: uses useReactFlow (must be inside ReactFlowProvider) ──────
interface FlowCanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: ReturnType<typeof useNodesState>[2]
  onEdgesChange: ReturnType<typeof useEdgesState>[2]
  onConnect: (c: Connection) => void
  setNodes: ReturnType<typeof useNodesState>[1]
  onNodeClick: (node: Node) => void
  onPaneClick: () => void
}

function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, setNodes, onNodeClick, onPaneClick }: FlowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow()

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const nodeType = e.dataTransfer.getData('nodeType')
    if (!nodeType || !nodeTypeConfig[nodeType as keyof typeof nodeTypeConfig]) return

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const config = nodeTypeConfig[nodeType as keyof typeof nodeTypeConfig]
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position,
      data: { label: config.label, description: '' },
    }
    setNodes((nds) => [...nds, newNode])
  }, [screenToFlowPosition, setNodes])

  return (
    <div className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node)}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        deleteKeyCode="Delete"
      >
        <Background color="#CBD5E1" gap={24} size={1} style={{ backgroundColor: '#FAFAFA' }} />
      </ReactFlow>

      {nodes.length === 0 && (
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

// ── Left palette panel ───────────────────────────────────────────────────────
interface PaletteProps {
  workflows: Workflow[]
  activeWf: Workflow | null
  onLoadWorkflow: (wf: Workflow) => void
  onAddNode: (nodeType: string) => void
}

function NodePalette({ workflows, activeWf, onLoadWorkflow, onAddNode }: PaletteProps) {
  return (
    <div className="w-[196px] flex-shrink-0 flex flex-col border-r border-border bg-white overflow-y-auto">
      {/* Add Nodes section */}
      <div className="px-3 pt-4 pb-2">
        <p className="text-[10px] font-semibold text-text-3 uppercase tracking-widest mb-3">Add Node</p>
        <div className="space-y-1.5">
          {PALETTE_NODE_TYPES.map((type) => {
            const cfg = nodeTypeConfig[type]
            return (
              <div
                key={type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('nodeType', type)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onClick={() => onAddNode(type)}
                className="flex items-stretch bg-white rounded-[8px] border border-border cursor-grab active:cursor-grabbing hover:border-[#CBD5E1] hover:shadow-sm transition-all select-none"
              >
                {/* Colored icon column */}
                <div
                  className="w-[36px] flex items-center justify-center flex-shrink-0 rounded-l-[7px]"
                  style={{ background: cfg.iconBg }}
                >
                  <NodeIcon type={type} color={cfg.color} />
                </div>
                {/* Label */}
                <div className="flex-1 flex items-center px-2.5 py-2.5">
                  <p className="text-[12px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
                </div>
                {/* Drag handle dots */}
                <div className="flex items-center pr-2.5">
                  <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                    <circle cx="2" cy="2" r="1.2" fill="#CBD5E1"/>
                    <circle cx="6" cy="2" r="1.2" fill="#CBD5E1"/>
                    <circle cx="2" cy="6" r="1.2" fill="#CBD5E1"/>
                    <circle cx="6" cy="6" r="1.2" fill="#CBD5E1"/>
                    <circle cx="2" cy="10" r="1.2" fill="#CBD5E1"/>
                    <circle cx="6" cy="10" r="1.2" fill="#CBD5E1"/>
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mx-3 my-3 h-px bg-border" />

      {/* Workflows section */}
      <div className="px-3 pb-4">
        <p className="text-[10px] font-semibold text-text-3 uppercase tracking-widest mb-2">Workflows</p>
        <div className="space-y-1">
          {workflows.map((wf) => (
            <button
              key={wf.id}
              onClick={() => onLoadWorkflow(wf)}
              className={`w-full text-left px-2.5 py-2 rounded-[7px] transition-colors ${
                activeWf?.id === wf.id
                  ? 'bg-indigo-lt text-indigo'
                  : 'text-text-2 hover:bg-surface'
              }`}
            >
              <p className="text-[12px] font-medium leading-snug truncate">{wf.name}</p>
              <p className="text-[10.5px] mt-0.5" style={{ color: activeWf?.id === wf.id ? '#6366F1' : '#94A3B8' }}>
                {wf.nodes?.length ?? 0} nodes
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function WorkflowBuilderPage() {
  const { data: workflows, isLoading } = useWorkflows()
  const [activeWf, setActiveWf] = useState<Workflow | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [zoom] = useState(100)

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, type: 'smoothstep', style: { stroke: '#CBD5E1', strokeWidth: 2 } }, eds)),
    [setEdges]
  )

  const loadWorkflow = useCallback((wf: Workflow) => {
    setActiveWf(wf)
    setNodes(toRFNodes(wf))
    setEdges(toRFEdges(wf))
    setSelectedNode(null)
  }, [setNodes, setEdges])

  // Click-to-add: place node at a staggered canvas position
  const handleAddNode = useCallback((nodeType: string) => {
    const config = nodeTypeConfig[nodeType as keyof typeof nodeTypeConfig]
    const idx = nodes.length
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position: { x: 80 + (idx % 3) * 220, y: 80 + Math.floor(idx / 3) * 130 },
      data: { label: config.label, description: '' },
    }
    setNodes((nds) => [...nds, newNode])
  }, [nodes.length, setNodes])

  if (isLoading) return (
    <div className="flex-1 flex flex-col">
      <div className="h-[56px] border-b border-border flex items-center px-5 bg-white flex-shrink-0">
        <span className="text-[14px] font-semibold text-text">Workflow Builder</span>
      </div>
      <PageLoader />
    </div>
  )

  if (workflows && workflows.length > 0 && !activeWf) {
    loadWorkflow(workflows[0])
  }

  const selNodeConfig = selectedNode
    ? nodeTypeConfig[selectedNode.type as keyof typeof nodeTypeConfig] ?? nodeTypeConfig.action
    : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Topbar */}
      <div className="h-[56px] border-b border-border flex items-center gap-4 px-5 bg-white flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[13px] text-text-3">
          <span>AI Tools</span>
          <span className="text-border-dk">/</span>
          <span>Workflows</span>
          <span className="text-border-dk">/</span>
        </div>
        <span className="text-[14px] font-semibold text-text">
          {activeWf?.name ?? 'New Workflow'}
        </span>
        <span className="text-[11px] font-semibold px-2.5 py-[3px] rounded-pill bg-warning-lt text-warning">
          {activeWf?.status === 'active' ? 'Active' : activeWf?.status === 'paused' ? 'Paused' : 'Draft'}
        </span>
        <span className="text-[12px] text-text-3">Saved 2 min ago</span>

        <div className="flex-1" />

        <div className="flex items-center">
          <button className="w-[30px] h-[30px] flex items-center justify-center rounded-[6px] text-text-2 hover:bg-surface transition-colors">
            <Undo2 size={14} />
          </button>
          <button className="w-[30px] h-[30px] flex items-center justify-center rounded-[6px] text-text-2 hover:bg-surface transition-colors opacity-40">
            <Redo2 size={14} />
          </button>
        </div>

        <div className="w-px h-5 bg-border" />

        <div className="flex items-center">
          <button className="w-[30px] h-[30px] flex items-center justify-center rounded-[6px] text-text-2 hover:bg-surface transition-colors">
            <Plus size={13} />
          </button>
          <span className="text-[12px] font-semibold text-text-2 w-11 text-center">{zoom}%</span>
          <button className="w-[30px] h-[30px] flex items-center justify-center rounded-[6px] text-text-2 hover:bg-surface transition-colors">
            <Minus size={13} />
          </button>
        </div>

        <div className="w-px h-5 bg-border" />

        <button className="flex items-center gap-1.5 px-4 py-[7px] text-[13px] font-semibold text-white bg-success rounded-[7px] hover:bg-success/90 transition-colors">
          <Play size={13} fill="white" /> Run
        </button>
        <button className="flex items-center gap-1.5 px-4 py-[7px] text-[13px] font-semibold text-white bg-indigo rounded-[7px] hover:bg-indigo-dk transition-colors">
          <Save size={13} /> Save
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left — Node palette */}
        <NodePalette
          workflows={workflows ?? []}
          activeWf={activeWf}
          onLoadWorkflow={loadWorkflow}
          onAddNode={handleAddNode}
        />

        {/* Center — Canvas (wrapped in ReactFlowProvider for useReactFlow) */}
        <ReactFlowProvider>
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            setNodes={setNodes}
            onNodeClick={setSelectedNode}
            onPaneClick={() => setSelectedNode(null)}
          />
        </ReactFlowProvider>

        {/* Right — Properties panel */}
        <div className="w-[264px] flex-shrink-0 flex flex-col border-l border-border bg-white overflow-y-auto">
          {selectedNode && selNodeConfig ? (
            <>
              <div className="flex items-center gap-3 p-4 border-b border-border">
                <div
                  className="w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0"
                  style={{ background: selNodeConfig.iconBg }}
                >
                  <NodeIcon type={selectedNode.type ?? 'action'} color={selNodeConfig.color} />
                </div>
                <div>
                  <p className="text-[13.5px] font-bold text-text">{selectedNode.data.label}</p>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-pill"
                    style={{ backgroundColor: selNodeConfig.iconBg, color: selNodeConfig.color }}
                  >
                    {selNodeConfig.label}
                  </span>
                </div>
              </div>

              <div className="flex-1 p-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1.5">Node name</label>
                  <input
                    className="w-full px-3 py-2 text-sm border border-border rounded-[7px] bg-white text-text focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                    defaultValue={selectedNode.data.label}
                  />
                </div>
                {selectedNode.type === 'ai' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1.5">AI Model</label>
                      <select className="w-full px-3 py-2 text-sm border border-border rounded-[7px] bg-white text-text focus:outline-none focus:border-indigo">
                        <option>claude-sonnet-4-5</option>
                        <option>claude-opus-4-6</option>
                        <option>gpt-4o</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1.5">Analysis Mode</label>
                      <div className="space-y-1.5">
                        {['Full contract analysis', 'Risk clauses only'].map((opt) => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer">
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${opt === 'Risk clauses only' ? 'border-indigo' : 'border-border-dk'}`}>
                              {opt === 'Risk clauses only' && <div className="w-1.5 h-1.5 rounded-full bg-indigo" />}
                            </div>
                            <span className="text-[13px] text-text-2">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1.5">Risk Threshold</label>
                      <div className="flex items-center justify-between text-[11px] text-text-3 mb-2">
                        <span>Low risk</span>
                        <span className="font-semibold text-text">65%</span>
                        <span>High risk</span>
                      </div>
                      <div className="w-full h-1.5 bg-border rounded-full relative">
                        <div className="h-full bg-indigo rounded-full" style={{ width: '65%' }} />
                        <div className="absolute w-3 h-3 bg-white border-2 border-indigo rounded-full -top-[3px]" style={{ left: 'calc(65% - 6px)' }} />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-border rounded-[7px] bg-white text-text-2 focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo resize-none"
                    rows={3}
                    defaultValue={selectedNode.data.description}
                  />
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-[11px] font-semibold text-text-3 uppercase tracking-wider">Connections</p>
                  <div className="text-[12px] text-text-3 flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M8 6H2M6 4l-2 2 2 2" stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-text-2">Input</span>
                    <span className="text-text-3">—</span>
                    <span>Previous node</span>
                  </div>
                  <div className="text-[12px] text-text-3 flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M4 6h6M8 4l2 2-2 2" stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-text-2">Output</span>
                    <span className="text-text-3">—</span>
                    <span>Next node</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border">
                <button
                  onClick={() => {
                    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id))
                    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id))
                    setSelectedNode(null)
                  }}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-danger hover:text-danger/80 transition-colors"
                >
                  <Trash2 size={12} /> Delete node
                </button>
              </div>
            </>
          ) : (
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
                <p className="text-[11px] text-text-3 mt-1">Click any node to view and edit its properties</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
