import { useState } from 'react'
import { Search, Plus, X, ChevronDown, Check } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { useUsers } from '@/hooks/useMockQuery'
import { cn } from '@/lib/utils'
import type { User, UserRole } from '@/types'

type TabFilter = 'All' | 'Active' | 'Invited' | 'Suspended'

const SEAT_TOTAL = 10

const roleOptions: { role: UserRole; label: string; description: string }[] = [
  { role: 'partner', label: 'Partner', description: 'Full access to all features, can share externally' },
  { role: 'associate', label: 'Associate', description: 'Full feature access, cannot manage users or billing' },
  { role: 'paralegal', label: 'Paralegal', description: 'View and search only — cannot run audits or edit' },
  { role: 'guest', label: 'Guest', description: 'Time-limited read access to shared documents only' },
]

const roleStyles: Record<string, { bg: string; color: string }> = {
  admin:            { bg: '#FEE2E2', color: '#DC2626' },
  partner:          { bg: '#EEF2FF', color: '#4338CA' },
  senior_associate: { bg: '#EEF2FF', color: '#4338CA' },
  associate:        { bg: '#D1FAE5', color: '#059669' },
  paralegal:        { bg: '#FEF3C7', color: '#D97706' },
  guest:            { bg: '#F1F5F9', color: '#475569' },
}

function roleLabelText(role: string) {
  const map: Record<string, string> = {
    admin: 'Admin', partner: 'Partner', senior_associate: 'Senior Associate',
    associate: 'Associate', paralegal: 'Paralegal', guest: 'Guest',
  }
  return map[role] ?? role
}

function RolePill({ role }: { role: string }) {
  const s = roleStyles[role] ?? roleStyles.guest
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-pill" style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {roleLabelText(role)}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    active:    { bg: '#D1FAE5', color: '#059669' },
    invited:   { bg: '#FEF3C7', color: '#D97706' },
    suspended: { bg: '#FEE2E2', color: '#DC2626' },
  }
  const s = styles[status] ?? styles.active
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-pill" style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export function UserManagementPage() {
  const { data: users, isLoading } = useUsers()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabFilter>('All')
  const [inviteOpen, setInviteOpen] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('rahul.verma@mehtaiyer.com')
  const [inviteRole, setInviteRole] = useState<UserRole>('associate')
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  if (isLoading) return (
    <div className="flex-1 flex flex-col">
      <Topbar breadcrumb={[{ label: 'Firm Settings' }, { label: 'User Management' }]} />
      <PageLoader />
    </div>
  )

  const allUsers = users ?? []
  const activeCount = allUsers.filter((u) => u.status === 'active').length
  const invitedCount = allUsers.filter((u) => u.status === 'invited').length
  const seatsUsed = activeCount

  const filtered = allUsers.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchTab =
      tab === 'All' ||
      (tab === 'Active' && u.status === 'active') ||
      (tab === 'Invited' && u.status === 'invited') ||
      (tab === 'Suspended' && u.status === 'suspended')
    return matchSearch && matchTab
  })

  const activeUsers = filtered.filter((u) => u.status === 'active')
  const invitedUsers = filtered.filter((u) => u.status === 'invited')

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const permissionsForRole = (role: UserRole) => [
    { feature: 'The Vault', access: role === 'guest' ? 'View only' : 'Full access' },
    { feature: 'Clause Audit', access: role === 'paralegal' || role === 'guest' ? 'View only' : 'Full access' },
    { feature: 'Market Analysis', access: role === 'guest' ? 'No access' : 'Full access' },
    { feature: 'Workflow Builder', access: role === 'associate' || role === 'paralegal' || role === 'guest' ? 'View & run only' : 'Full access' },
    { feature: 'User Management', access: role === 'partner' || role === 'admin' ? 'Full access' : 'No access' },
    { feature: 'Billing & Plan', access: role === 'partner' || role === 'admin' ? 'Full access' : 'No access' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        breadcrumb={[{ label: 'Firm Settings' }, { label: 'User Management' }]}
        actions={
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-indigo rounded-[8px] hover:bg-indigo-dk transition-colors"
          >
            <Plus size={14} /> Invite Member
          </button>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Main panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Firm header + seat meter */}
          <div className="flex items-start justify-between px-7 py-5 border-b border-border bg-white">
            <div>
              <h1 className="text-xl font-semibold text-text">Mehta & Iyer LLP</h1>
              <p className="text-sm text-text-2 mt-0.5">
                {activeCount} active members · {invitedCount} pending invitations · Enterprise Plan
              </p>
            </div>
            <div className="p-4 border border-border rounded-[9px] bg-white min-w-[200px]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-text-3">Seats used</p>
                <p className="text-xs font-semibold text-text">{seatsUsed} / {SEAT_TOTAL}</p>
              </div>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full bg-indigo" style={{ width: `${(seatsUsed / SEAT_TOTAL) * 100}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-3">{SEAT_TOTAL - seatsUsed} seats remaining</p>
                <button className="text-xs text-indigo font-medium hover:underline">Upgrade</button>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 px-7 py-3 border-b border-border bg-white">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members…"
                className="pl-8 pr-3 py-2 text-sm border border-border rounded-[8px] bg-white w-56 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
              />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-[8px] text-sm text-text-2 hover:bg-surface transition-colors">
              All Roles <ChevronDown size={14} className="text-text-3" />
            </button>
            <div className="flex items-center gap-1 ml-auto">
              {(['All', 'Active', 'Invited', 'Suspended'] as TabFilter[]).map((t) => {
                const count = t === 'All' ? allUsers.length : t === 'Active' ? activeCount : t === 'Invited' ? invitedCount : 0
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-pill transition-colors',
                      tab === t ? 'bg-indigo text-white' : 'bg-surface text-text-2 border border-border hover:border-indigo-mid'
                    )}
                  >
                    {t} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-10 px-6 py-2.5 bg-surface border-b border-border sticky top-0 z-10" />
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Member</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Role</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Status</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Last Active</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">Joined</th>
                  <th className="px-6 py-2.5 bg-surface border-b border-border sticky top-0 z-10" />
                </tr>
              </thead>
              <tbody>
                {activeUsers.map((user) => (
                  <ActiveRow
                    key={user.id}
                    user={user}
                    checked={checkedIds.has(user.id)}
                    onCheck={() => toggleCheck(user.id)}
                  />
                ))}
                {invitedUsers.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <div className="flex items-center gap-3 px-6 py-2.5 bg-warning-lt border-y border-warning/20">
                          <span className="text-xs font-semibold text-warning">Pending Invitations</span>
                          <span className="text-xs text-warning/70">{invitedUsers.length} awaiting</span>
                        </div>
                      </td>
                    </tr>
                    {invitedUsers.map((user) => (
                      <InvitedRow
                        key={user.id}
                        user={user}
                        checked={checkedIds.has(user.id)}
                        onCheck={() => toggleCheck(user.id)}
                      />
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invite panel */}
        {inviteOpen && (
          <div className="w-[300px] flex-shrink-0 flex flex-col overflow-hidden border-l border-border bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text">Invite Member</h3>
              <button onClick={() => setInviteOpen(false)} className="text-text-3 hover:text-text p-1 rounded hover:bg-surface">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-text-3 uppercase tracking-wider mb-1">Email address</label>
                <p className="text-xs text-text-3 mb-2">Use their work email — they'll receive an invitation link</p>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-[8px] bg-white text-text focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
                  placeholder="colleague@mehtaiyer.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-3 uppercase tracking-wider mb-1">Assign role</label>
                <p className="text-xs text-text-3 mb-2">Controls what this person can access</p>
                <div className="space-y-2">
                  {roleOptions.map(({ role, label, description }) => (
                    <button
                      key={role}
                      onClick={() => setInviteRole(role)}
                      className={cn(
                        'w-full text-left p-3 border rounded-[8px] transition-colors flex items-start gap-2.5',
                        inviteRole === role ? 'border-indigo bg-indigo-lt' : 'border-border hover:border-indigo-mid bg-white'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                        inviteRole === role ? 'border-indigo' : 'border-border'
                      )}>
                        {inviteRole === role && <div className="w-2 h-2 rounded-full bg-indigo" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text">{label}</p>
                        <p className="text-xs text-text-3 mt-0.5 leading-snug">{description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-2">
                  Permissions for {roleOptions.find(r => r.role === inviteRole)?.label}
                </p>
                <div className="border border-border rounded-[8px] divide-y divide-border">
                  {permissionsForRole(inviteRole).map(({ feature, access }) => (
                    <div key={feature} className="flex items-center justify-between px-3 py-2">
                      <p className="text-xs text-text-2">{feature}</p>
                      <p className={cn(
                        'text-xs font-medium',
                        access === 'Full access' ? 'text-success' : access === 'No access' ? 'text-text-3' : 'text-warning'
                      )}>{access}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-3 uppercase tracking-wider mb-1">
                  Personal note <span className="font-normal normal-case text-text-3">(optional)</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 text-sm border border-border rounded-[8px] bg-white text-text-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
                  rows={3}
                  placeholder="Add a message to the invitation email…"
                  defaultValue="Hi Rahul, joining you on LegalFlow for the Tata Digital matter. Let me know if you need any help getting started."
                />
              </div>
            </div>

            <div className="p-4 border-t border-border space-y-2">
              <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo text-white text-sm font-semibold rounded-[8px] hover:bg-indigo-dk transition-colors">
                <Check size={14} /> Send Invitation
              </button>
              <p className="text-xs text-text-3 text-center">Uses 1 of your {SEAT_TOTAL - seatsUsed} remaining seats</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ActiveRow({ user, checked, onCheck }: { user: User; checked: boolean; onCheck: () => void }) {
  return (
    <tr className="border-b border-border hover:bg-surface transition-colors group">
      <td className="px-6 py-3">
        <input type="checkbox" checked={checked} onChange={onCheck} className="w-[15px] h-[15px] accent-indigo cursor-pointer" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
            style={{ backgroundColor: user.avatarColor }}
          >
            {user.avatarInitials}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-text">
              {user.name}
              {user.id === 'u-1' && <span className="ml-1.5 text-[11px] text-text-3 font-normal">(you)</span>}
            </p>
            <p className="text-[11px] text-text-3">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><RolePill role={user.role} /></td>
      <td className="px-4 py-3"><StatusPill status={user.status} /></td>
      <td className={cn('px-4 py-3 text-[13px]', user.lastActive ? 'text-indigo font-medium' : 'text-text-2')}>
        {user.lastActive ? new Date(user.lastActive).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </td>
      <td className="px-4 py-3 text-[13px] text-text-2">
        {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="text-[11.5px] font-medium px-2.5 py-1 border border-border rounded-[5px] bg-white text-text-2 hover:bg-surface">Edit role</button>
          <button className="text-[11.5px] font-medium px-2.5 py-1 border border-border rounded-[5px] bg-white text-danger hover:bg-danger-lt">Suspend</button>
        </div>
      </td>
    </tr>
  )
}

function InvitedRow({ user, checked, onCheck }: { user: User; checked: boolean; onCheck: () => void }) {
  return (
    <tr className="border-b border-border bg-warning-lt/30 hover:bg-warning-lt/50 transition-colors">
      <td className="px-6 py-3">
        <input type="checkbox" checked={checked} onChange={onCheck} className="w-[15px] h-[15px] accent-indigo cursor-pointer" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-border-dk flex items-center justify-center text-text-3 text-lg leading-none flex-shrink-0">?</div>
          <div>
            <p className="text-[13px] font-medium text-text-2">{user.email}</p>
            <p className="text-[11px] text-text-3">Invited by {user.invitedBy ?? 'Arjun Mehta'} · 2 days ago</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><RolePill role={user.role} /></td>
      <td className="px-4 py-3"><StatusPill status="invited" /></td>
      <td className="px-4 py-3 text-[13px] text-text-3">—</td>
      <td className="px-4 py-3 text-[13px] text-text-2">
        {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center gap-1.5">
          <button className="text-[11.5px] font-medium px-2.5 py-1 border border-border rounded-[5px] bg-white text-text-2 hover:bg-surface">Resend</button>
          <button className="text-[11.5px] font-medium px-2.5 py-1 border border-border rounded-[5px] bg-white text-danger hover:bg-danger-lt">Revoke</button>
        </div>
      </td>
    </tr>
  )
}
