const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const DEFAULT_TIMEOUT_MS = 30_000

function withTimeout(options: RequestInit, ms: number): [RequestInit, AbortController] {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  const cleanup = () => clearTimeout(timer)
  const signal = controller.signal
  signal.addEventListener('abort', cleanup, { once: true })
  return [{ ...options, signal }, controller]
}

export async function apiFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const [opts] = withTimeout(options, timeoutMs)
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out — the server took too long to respond')
    }
    throw err
  }

  const text = await res.text()
  const body = text ? JSON.parse(text) : {}

  if (!res.ok) {
    throw new Error(body.detail ?? `API error ${res.status}`)
  }

  return body as T
}

// For file uploads — does NOT set Content-Type (browser sets it with boundary)
export async function apiUpload<T>(
  path: string,
  token: string,
  formData: FormData,
  timeoutMs = 120_000  // uploads get 2 minutes
): Promise<T> {
  const [opts] = withTimeout({ method: 'POST', body: formData }, timeoutMs)
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Upload timed out — check your connection and try again')
    }
    throw err
  }

  const text = await res.text()
  const body = text ? JSON.parse(text) : {}

  if (!res.ok) {
    throw new Error(body.detail ?? `API error ${res.status}`)
  }

  return body as T
}

// ─── Vault ────────────────────────────────────────────────────────────────────

export interface ContractDTO {
  id: string
  name: string
  original_filename: string
  file_type: string
  file_size: number | null
  status: 'pending' | 'processing' | 'ready' | 'failed'
  contract_type: string | null
  parties: string[]
  effective_date: string | null
  expiry_date: string | null
  jurisdiction: string | null
  summary: string | null
  page_count: number | null
  created_at: string
  download_url?: string
}

export interface ContractStatusDTO {
  contract_id: string
  status: string
  error: string | null
}

export interface CollectionDTO {
  id: string
  name: string
  color: string
  created_at: string
}

export interface SearchResultDTO extends ContractDTO {
  score: number
  snippet: string
  section_heading: string | null
}

// ─── Obligations ──────────────────────────────────────────────────────────────

export interface ObligationDTO {
  id: string
  contract_id: string
  contract_name: string
  title: string
  description: string
  responsible_party: string | null
  due_date: string | null
  recurrence: string | null
  category: string
  status: 'pending' | 'done' | 'snoozed'
  note: string | null
  section: string | null
  source_clause: string | null
  snooze_until: string | null
  reminder_date: string | null
  reminder_email: string | null
  reminder_sent: boolean
  created_at: string
}

export interface ObligationPatch {
  status?: string
  note?: string
  title?: string
  due_date?: string           // YYYY-MM-DD or "" to clear
  category?: string
  responsible_party?: string
  snooze_until?: string       // YYYY-MM-DD or "" to clear; auto-sets status=snoozed
  reminder_date?: string      // ISO string or "" to clear
  reminder_email?: string
}

export interface ObligationCreate {
  contract_id: string
  title: string
  description?: string
  category?: string
  due_date?: string
  responsible_party?: string
  recurrence?: string
}

export const obligationsApi = {
  extract: (token: string, contractIds: string[], forceRegenerate = false) =>
    apiFetch<{ obligations: ObligationDTO[] }>('/api/v1/obligations/extract', token, {
      method: 'POST',
      body: JSON.stringify({ contract_ids: contractIds, force_regenerate: forceRegenerate }),
    }),

  list: (token: string, params?: { status_filter?: string; category?: string }) =>
    apiFetch<{ obligations: ObligationDTO[] }>(
      `/api/v1/obligations/?${new URLSearchParams(params as Record<string, string>)}`,
      token
    ),

  update: (token: string, id: string, patch: ObligationPatch) =>
    apiFetch<ObligationDTO>(`/api/v1/obligations/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  delete: (token: string, id: string) =>
    apiFetch<void>(`/api/v1/obligations/${id}`, token, { method: 'DELETE' }),

  create: (token: string, body: ObligationCreate) =>
    apiFetch<ObligationDTO>('/api/v1/obligations/manual', token, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

// ─── Org management ───────────────────────────────────────────────────────────

export interface OrgMemberDTO {
  membership_id: string
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  org_role: string
  membership_status: string
  user_status: string
  last_active_at: string | null
  joined_at: string
}

export interface OrgInvitationDTO {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  invited_by_name: string | null
}

export interface OrgOverviewDTO {
  members: OrgMemberDTO[]
  invitations: OrgInvitationDTO[]
  org_name: string
  plan: string
}

export const orgApi = {
  listMembers: (token: string) =>
    apiFetch<OrgOverviewDTO>('/api/v1/users/org/members', token),

  invite: (token: string, email: string, role: string, note?: string) =>
    apiFetch<{ id: string; email: string; role: string; token: string; invite_link: string }>(
      '/api/v1/users/org/invite', token, {
        method: 'POST',
        body: JSON.stringify({ email, role, note }),
      }
    ),

  updateRole: (token: string, membershipId: string, role: string) =>
    apiFetch<{ membership_id: string; org_role: string }>(
      `/api/v1/users/org/members/${membershipId}/role`, token, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }
    ),

  setStatus: (token: string, membershipId: string, memberStatus: 'active' | 'suspended') =>
    apiFetch<{ membership_id: string; status: string }>(
      `/api/v1/users/org/members/${membershipId}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: memberStatus }),
      }
    ),

  removeMember: (token: string, membershipId: string) =>
    apiFetch<void>(`/api/v1/users/org/members/${membershipId}`, token, { method: 'DELETE' }),

  revokeInvitation: (token: string, invitationId: string) =>
    apiFetch<void>(`/api/v1/users/org/invitations/${invitationId}`, token, { method: 'DELETE' }),

  resendInvitation: (token: string, invitationId: string) =>
    apiFetch<{ id: string; email: string; invite_link: string }>(
      `/api/v1/users/org/invitations/${invitationId}/resend`, token, { method: 'POST' }
    ),
}

// ─── Clause Audit ─────────────────────────────────────────────────────────────

export interface ClauseResultDTO {
  id: string
  clause_key: string
  clause_name: string
  playbook_type: string
  status: 'present' | 'partial' | 'missing'
  mandatory: boolean
  risk: 'high' | 'medium' | 'low'
  found_text: string | null
  ai_notes: string | null
  suggested_text: string | null
  override_status: 'present' | 'partial' | 'missing' | null
  override_note: string | null
}

export interface ClauseAuditDTO {
  id: string
  contract_id: string
  contract_name: string
  playbook_types: string[]
  status: 'pending' | 'running' | 'done' | 'failed'
  error: string | null
  overall_score: number | null
  created_at: string
  results: ClauseResultDTO[]
}

export interface PlaybookDTO {
  key: string
  name: string
  short: string
  clause_count: number
}

export const clauseAuditApi = {
  listPlaybooks: (token: string) =>
    apiFetch<{ playbooks: PlaybookDTO[] }>('/api/v1/clause-audit/playbooks', token),

  detect: (token: string, contractId: string) =>
    apiFetch<{ playbook_types: string[] }>(`/api/v1/clause-audit/detect/${contractId}`, token, {
      method: 'POST',
    }),

  run: (token: string, contractId: string, playbookTypes: string[]) =>
    apiFetch<ClauseAuditDTO>('/api/v1/clause-audit/run', token, {
      method: 'POST',
      body: JSON.stringify({ contract_id: contractId, playbook_types: playbookTypes }),
    }),

  getAudit: (token: string, auditId: string) =>
    apiFetch<ClauseAuditDTO>(`/api/v1/clause-audit/${auditId}`, token),

  listForContract: (token: string, contractId: string) =>
    apiFetch<{ audits: ClauseAuditDTO[] }>(`/api/v1/clause-audit/contract/${contractId}`, token),

  updateResult: (token: string, resultId: string, patch: { override_status: string | null; override_note: string | null }) =>
    apiFetch<ClauseResultDTO>(`/api/v1/clause-audit/results/${resultId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export interface TimelineEventDTO {
  id: string
  title: string
  date: string
  type: 'start' | 'milestone' | 'deadline' | 'renewal' | 'payment' | 'review'
  documentId: string
  documentName: string
  description: string
  status: 'completed' | 'upcoming' | 'overdue'
  section?: string | null
  sourceClause?: string | null
  amount?: string | null
}

export const timelineApi = {
  generate: (token: string, contractIds: string[], forceRegenerate = false) =>
    apiFetch<{ events: TimelineEventDTO[] }>('/api/v1/timeline/generate', token, {
      method: 'POST',
      body: JSON.stringify({ contract_ids: contractIds, force_regenerate: forceRegenerate }),
    }),
}

export interface ChatMessageDTO {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSourceDTO {
  contract_id: string
  contract_name: string
  snippet: string
}

export interface ChatResponseDTO {
  answer: string
  sources: ChatSourceDTO[]
}

export interface ContractsParams {
  collection_id?: string
  contract_type?: string
  status_filter?: string
  expiring_soon?: boolean
  sort_by?: 'date' | 'name' | 'type' | 'expiry'
  sort_dir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export const vaultApi = {
  listContracts: (token: string, params?: ContractsParams) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params ?? {})
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      )
    )
    return apiFetch<{ contracts: ContractDTO[]; total: number }>(
      `/api/v1/vault/contracts?${qs}`,
      token
    )
  },

  getContract: (token: string, id: string) =>
    apiFetch<ContractDTO>(`/api/v1/vault/contracts/${id}`, token),

  getStatus: (token: string, id: string) =>
    apiFetch<ContractStatusDTO>(`/api/v1/vault/contracts/${id}/status`, token),

  upload: (token: string, file: File, collectionId?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (collectionId) fd.append('collection_id', collectionId)
    return apiUpload<{ contract_id: string; status: string }>('/api/v1/vault/upload', token, fd)
  },

  renameContract: (token: string, id: string, name: string) =>
    apiFetch<ContractDTO>(`/api/v1/vault/contracts/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  moveToCollection: (token: string, id: string, collectionId: string | null) =>
    apiFetch<{ contract_id: string; collection_id: string | null }>(
      `/api/v1/vault/contracts/${id}/collection`, token, {
        method: 'PATCH',
        body: JSON.stringify({ collection_id: collectionId }),
      }
    ),

  deleteContract: (token: string, id: string) =>
    apiFetch<void>(`/api/v1/vault/contracts/${id}`, token, { method: 'DELETE' }),

  bulkDelete: (token: string, contractIds: string[]) =>
    apiFetch<{ deleted: string[]; count: number }>('/api/v1/vault/contracts/bulk-delete', token, {
      method: 'POST',
      body: JSON.stringify({ contract_ids: contractIds }),
    }),

  listCollections: (token: string) =>
    apiFetch<{ collections: CollectionDTO[] }>('/api/v1/vault/collections', token),

  createCollection: (token: string, name: string, color = '#4338CA') =>
    apiFetch<CollectionDTO>('/api/v1/vault/collections', token, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),

  updateCollection: (token: string, id: string, patch: { name?: string; color?: string }) =>
    apiFetch<CollectionDTO>(`/api/v1/vault/collections/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteCollection: (token: string, id: string) =>
    apiFetch<void>(`/api/v1/vault/collections/${id}`, token, { method: 'DELETE' }),

  search: (token: string, query: string, topK = 10) =>
    apiFetch<{ results: SearchResultDTO[]; query: string }>('/api/v1/vault/search', token, {
      method: 'POST',
      body: JSON.stringify({ query, top_k: topK }),
    }),

  chat: (token: string, contractIds: string[], message: string, history: ChatMessageDTO[]) =>
    apiFetch<ChatResponseDTO>('/api/v1/vault/chat', token, {
      method: 'POST',
      body: JSON.stringify({ contract_ids: contractIds, message, history }),
    }),
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export interface WorkflowDTO {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'active' | 'paused'
  nodes: WorkflowNodeDTO[]
  edges: WorkflowEdgeDTO[]
  last_run: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowNodeDTO {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface WorkflowEdgeDTO {
  id: string
  source: string
  target: string
  label?: string
}

export interface WorkflowRunDTO {
  id: string
  workflow_id: string
  contract_id: string | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  trigger_type: string | null
  run_log: WorkflowRunLogEntry[]
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface WorkflowRunLogEntry {
  node_id: string
  node_type: string
  node_label: string
  status: 'success' | 'skipped' | 'failed'
  message: string
  output: Record<string, unknown>
  duration_ms: number
}

export const workflowApi = {
  list: (token: string) =>
    apiFetch<{ workflows: WorkflowDTO[] }>('/api/v1/workflows', token),

  get: (token: string, id: string) =>
    apiFetch<WorkflowDTO>(`/api/v1/workflows/${id}`, token),

  create: (token: string, body: { name: string; description?: string; status?: string; nodes?: WorkflowNodeDTO[]; edges?: WorkflowEdgeDTO[] }) =>
    apiFetch<WorkflowDTO>('/api/v1/workflows', token, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (token: string, id: string, body: Partial<{ name: string; description: string; status: string; nodes: WorkflowNodeDTO[]; edges: WorkflowEdgeDTO[] }>) =>
    apiFetch<WorkflowDTO>(`/api/v1/workflows/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (token: string, id: string) =>
    apiFetch<void>(`/api/v1/workflows/${id}`, token, { method: 'DELETE' }),

  run: (token: string, id: string, contractId?: string) =>
    apiFetch<{ run_id: string; status: string }>(`/api/v1/workflows/${id}/run`, token, {
      method: 'POST',
      body: JSON.stringify({ contract_id: contractId ?? null, trigger_type: 'manual' }),
    }),

  listRuns: (token: string, workflowId: string) =>
    apiFetch<{ runs: WorkflowRunDTO[] }>(`/api/v1/workflows/${workflowId}/runs`, token),

  getRun: (token: string, runId: string) =>
    apiFetch<WorkflowRunDTO>(`/api/v1/workflows/runs/${runId}`, token),
}
