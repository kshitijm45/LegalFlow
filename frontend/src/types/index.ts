// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatarInitials: string
  avatarColor: string
  status: 'active' | 'invited' | 'suspended'
  lastActive: string
  joinedAt: string
  invitedBy?: string
}

export type UserRole = 'admin' | 'partner' | 'senior_associate' | 'associate' | 'paralegal' | 'guest'

// ─── Documents ───────────────────────────────────────────────────────────────

export interface Document {
  id: string
  name: string
  type: DocumentType
  parties: string[]
  uploadedAt: string
  size: string
  status: 'processed' | 'processing' | 'failed'
  coverage: number // 0-100, percentage of clauses present
  pageCount: number
  tags: string[]
}

export type DocumentType = 'MSA' | 'NDA' | 'SaaS Agreement' | 'Employment' | 'SOW' | 'License' | 'Amendment'

// ─── Clauses ─────────────────────────────────────────────────────────────────

export interface ClauseCategory {
  id: string
  name: string
  clauses: Clause[]
}

export interface Clause {
  id: string
  name: string
  status: 'present' | 'missing' | 'partial'
  risk: 'critical' | 'high' | 'medium' | 'low' | null
  suggestedText?: string
  sourceText?: string
  marketPercentile?: number
  marketPosition?: 'below' | 'at' | 'above'
}

// ─── Market Analysis ─────────────────────────────────────────────────────────

export interface MarketClause {
  id: string
  name: string
  category: string
  percentile: number
  position: 'below' | 'at' | 'above'
  yourText: string
  marketText: string
  differences: MarketDifference[]
  benchmarkStats: {
    p25: string
    p50: string
    p75: string
    yourValue: string
  }
}

export interface MarketDifference {
  type: 'risk' | 'warning' | 'ok'
  text: string
}

// ─── Obligations ─────────────────────────────────────────────────────────────

export interface Obligation {
  id: string
  title: string
  category: ObligationCategory
  documentId: string
  documentName: string
  section: string
  dueDate: string
  status: 'overdue' | 'pending' | 'completed'
  assignee: string
  counterparty: string
  sourceClause: string
  reminders: Reminder[]
  activity: ActivityEntry[]
}

export type ObligationCategory = 'Compliance' | 'Payment' | 'Reporting' | 'Renewal' | 'Delivery' | 'Review'

export interface Reminder {
  id: string
  type: 'email' | 'slack'
  timing: string
  recipient: string
  enabled: boolean
}

export interface ActivityEntry {
  id: string
  text: string
  timestamp: string
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string
  title: string
  date: string
  type: 'start' | 'milestone' | 'deadline' | 'renewal' | 'payment' | 'review'
  documentId: string
  documentName: string
  description: string
  status: 'completed' | 'upcoming' | 'overdue'
  section?: string
  sourceClause?: string
  amount?: string
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export interface Workflow {
  id: string
  name: string
  description: string
  lastRun: string
  status: 'active' | 'draft' | 'paused'
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface WorkflowNode {
  id: string
  type: 'trigger' | 'ai' | 'branch' | 'action' | 'notify'
  position: { x: number; y: number }
  data: {
    label: string
    description: string
  }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  label?: string
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalContracts: number
  overdueObligations: number
  contractsThisMonth: number
  avgCoverageScore: number
}
