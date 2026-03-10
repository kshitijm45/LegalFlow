export interface NavItem {
  label: string
  path: string
  icon: string // lucide icon name
  badge?: number
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', path: '/app/dashboard', icon: 'LayoutDashboard' },
      { label: 'The Vault', path: '/app/vault', icon: 'Archive' },
    ],
  },
  {
    label: 'AI Tools',
    items: [
      { label: 'Market Analysis', path: '/app/market-analysis', icon: 'BarChart2' },
      { label: 'Clause Audit', path: '/app/clause-audit', icon: 'ClipboardCheck' },
      { label: 'Obligations', path: '/app/obligations', icon: 'Bell', badge: 3 },
      { label: 'Timeline', path: '/app/timeline', icon: 'GitCommitHorizontal' },
      { label: 'Workflow Builder', path: '/app/workflow-builder', icon: 'Workflow' },
    ],
  },
]

export const settingsNavItems: NavItem[] = [
  { label: 'User Management', path: '/app/settings/users', icon: 'Users' },
  { label: 'Security & SSO', path: '/app/settings/security', icon: 'Shield' },
  { label: 'Billing & Plan', path: '/app/settings/billing', icon: 'CreditCard' },
]
