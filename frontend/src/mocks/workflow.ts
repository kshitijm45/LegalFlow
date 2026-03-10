import type { Workflow } from '@/types'

export const mockWorkflows: Workflow[] = [
  {
    id: 'wf-1',
    name: 'Contract Review Pipeline',
    description: 'Full AI review for new contracts: clause audit → market benchmarking → risk summary',
    lastRun: '2024-01-28T14:30:00Z',
    status: 'active',
    nodes: [
      {
        id: 'n1',
        type: 'trigger',
        position: { x: 80, y: 200 },
        data: { label: 'New Contract Upload', description: 'Triggers when a PDF is uploaded to The Vault' },
      },
      {
        id: 'n2',
        type: 'ai',
        position: { x: 300, y: 200 },
        data: { label: 'Extract Clauses', description: 'Claude identifies and categorises all clauses' },
      },
      {
        id: 'n3',
        type: 'ai',
        position: { x: 520, y: 120 },
        data: { label: 'Clause Audit', description: 'Compare against playbook — flag missing clauses' },
      },
      {
        id: 'n4',
        type: 'ai',
        position: { x: 520, y: 280 },
        data: { label: 'Market Benchmarking', description: 'Score each clause against 2,847 comparable Indian deals' },
      },
      {
        id: 'n5',
        type: 'branch',
        position: { x: 740, y: 200 },
        data: { label: 'Risk Assessment', description: 'Route based on overall risk score' },
      },
      {
        id: 'n6',
        type: 'notify',
        position: { x: 960, y: 120 },
        data: { label: 'Alert Partner', description: 'Slack + email alert for high-risk contracts' },
      },
      {
        id: 'n7',
        type: 'action',
        position: { x: 960, y: 280 },
        data: { label: 'Auto-Tag & File', description: 'Apply tags and move to correct folder in Vault' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n3', target: 'n5' },
      { id: 'e5', source: 'n4', target: 'n5' },
      { id: 'e6', source: 'n5', target: 'n6', label: 'High Risk' },
      { id: 'e7', source: 'n5', target: 'n7', label: 'Low / Med' },
    ],
  },
  {
    id: 'wf-2',
    name: 'NDA Fast-Track',
    description: 'Rapid review and approval workflow for standard NDAs',
    lastRun: '2024-01-25T09:15:00Z',
    status: 'active',
    nodes: [
      {
        id: 'n1',
        type: 'trigger',
        position: { x: 80, y: 180 },
        data: { label: 'NDA Received', description: 'Triggers on NDA document type detection' },
      },
      {
        id: 'n2',
        type: 'ai',
        position: { x: 300, y: 180 },
        data: { label: 'Standard NDA Check', description: 'Verify against our standard NDA template' },
      },
      {
        id: 'n3',
        type: 'branch',
        position: { x: 520, y: 180 },
        data: { label: 'Deviations?', description: 'Check if NDA deviates from standard' },
      },
      {
        id: 'n4',
        type: 'action',
        position: { x: 740, y: 100 },
        data: { label: 'Auto-Approve', description: 'Mark as approved and notify counterparty' },
      },
      {
        id: 'n5',
        type: 'notify',
        position: { x: 740, y: 260 },
        data: { label: 'Escalate to Associate', description: 'Send for manual review with AI summary' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4', label: 'Standard' },
      { id: 'e4', source: 'n3', target: 'n5', label: 'Deviations' },
    ],
  },
  {
    id: 'wf-3',
    name: 'Quarterly Compliance Audit',
    description: 'Automated compliance check across all active contracts each quarter',
    lastRun: '2024-01-01T00:00:00Z',
    status: 'draft',
    nodes: [
      {
        id: 'n1',
        type: 'trigger',
        position: { x: 80, y: 180 },
        data: { label: 'Schedule: Quarter End', description: 'Runs automatically on the last day of each quarter' },
      },
      {
        id: 'n2',
        type: 'ai',
        position: { x: 300, y: 180 },
        data: { label: 'Scan All Active Contracts', description: 'Pull all active contracts from The Vault' },
      },
      {
        id: 'n3',
        type: 'ai',
        position: { x: 520, y: 180 },
        data: { label: 'Obligation Extraction', description: 'Identify all Q-end obligations across contracts' },
      },
      {
        id: 'n4',
        type: 'action',
        position: { x: 740, y: 180 },
        data: { label: 'Update Obligation Tracker', description: 'Sync obligations to the tracking dashboard' },
      },
      {
        id: 'n5',
        type: 'notify',
        position: { x: 960, y: 180 },
        data: { label: 'Email Summary to Partners', description: 'Send compliance summary to all partner-level users' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },
]
