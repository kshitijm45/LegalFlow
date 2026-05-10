import { useState } from 'react'
import { Search, Plus, X, Check, Loader2 } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import {
  useOrgMembers, useInviteMember, useUpdateMemberRole,
  useSetMemberStatus, useRemoveMember, useRevokeInvitation, useResendInvitation,
  memberDisplayName, memberInitials,
} from '@/hooks/useOrgManagement'
import type { OrgMemberDTO, OrgInvitationDTO } from '@/hooks/useOrgManagement'
import { cn } from '@/lib/utils'

const SEAT_TOTAL = 10

const ROLE_OPTIONS = [
  { value: 'admin',     label: 'Admin',           description: 'Full access including billing and user management' },
  { value: 'partner',   label: 'Partner',          description: 'Full feature access, can share externally' },
  { value: 'associate', label: 'Associate',        description: 'Full feature access, cannot manage users or billing' },
  { value: 'paralegal', label: 'Paralegal',        description: 'View and search only — cannot run audits or edit' },
  { value: 'guest',     label: 'Guest',            description: 'Time-limited read access to shared documents only' },
]

const roleStyles: Record<string, { bg: string; color: string }> = {
  admin:     { bg: '#FEE2E2', color: '#DC2626' },
  partner:   { bg: '#EEF2FF', color: '#4338CA' },
  associate: { bg: '#D1FAE5', color: '#059669' },
  paralegal: { bg: '#FEF3C7', color: '#D97706' },
  guest:     { bg: '#F1F5F9', color: '#475569' },
}

const AVATAR_COLORS = ['#4338CA', '#059669', '#DC2626', '#D97706', '#7C3AED', '#0369A1', '#16A34A']
function avatarColor(str: string) { return AVATAR_COLORS[str.charCodeAt(0) % AVATAR_COLORS.length] }

function RolePill({ role }: { role: string }) {
  const s = roleStyles[role] ?? roleStyles.guest
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-pill" style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    active:    { bg: '#D1FAE5', color: '#059669' },
    suspended: { bg: '#FEE2E2', color: '#DC2626' },
    invited:   { bg: '#FEF3C7', color: '#D97706' },
  }
  const s = styles[status] ?? styles.active
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-pill" style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Edit Role dropdown ────────────────────────────────────────────────────────

function EditRoleDropdown({ membershipId, currentRole, onClose }: {
  membershipId: string; currentRole: string; onClose: () => void
}) {
  const updateRole = useUpdateMemberRole()
  return (
    <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-border rounded-[9px] shadow-lg z-30 py-1 overflow-hidden">
      {ROLE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          disabled={updateRole.isPending}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface transition-colors',
            currentRole === opt.value ? 'bg-indigo-lt' : ''
          )}
          onClick={async () => {
            await updateRole.mutateAsync({ membershipId, role: opt.value })
            onClose()
          }}
        >
          {currentRole === opt.value && <Check size={12} className="text-indigo flex-shrink-0" />}
          <div className={currentRole === opt.value ? 'pl-0' : 'pl-[20px]'}>
            <p className="text-[13px] font-medium text-text">{opt.label}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Active member row ─────────────────────────────────────────────────────────

function ActiveRow({ member, isMe }: { member: OrgMemberDTO; isMe: boolean }) {
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const setStatus  = useSetMemberStatus()
  const removeMutation = useRemoveMember()
  const isSuspended = member.membership_status === 'suspended'
  const name  = memberDisplayName(member)
  const initials = memberInitials(member)

  return (
    <tr className="border-b border-border hover:bg-surface transition-colors group">
      <td className="px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
            style={{ backgroundColor: avatarColor(member.email) }}
          >
            {initials}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-text leading-snug">
              {name}
              {isMe && <span className="ml-1.5 text-[11px] text-text-3 font-normal">(you)</span>}
            </p>
            <p className="text-[11px] text-text-3">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3"><RolePill role={member.org_role} /></td>
      <td className="px-5 py-3"><StatusPill status={member.membership_status} /></td>
      <td className="px-5 py-3 text-[13px] text-text-2">
        {member.last_active_at ? formatDate(member.last_active_at) : '—'}
      </td>
      <td className="px-5 py-3 text-[13px] text-text-2">{formatDate(member.joined_at)}</td>
      <td className="px-5 py-3">
        {!isMe && (
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity relative">
            <div className="relative">
              <button
                className="text-[11.5px] font-medium px-2.5 py-1 border border-border rounded-[5px] bg-white text-text-2 hover:bg-surface"
                onClick={() => setShowRoleMenu((v) => !v)}
              >
                Edit role
              </button>
              {showRoleMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowRoleMenu(false)} />
                  <EditRoleDropdown
                    membershipId={member.membership_id}
                    currentRole={member.org_role}
                    onClose={() => setShowRoleMenu(false)}
                  />
                </>
              )}
            </div>
            <button
              disabled={setStatus.isPending}
              className={cn(
                'text-[11.5px] font-medium px-2.5 py-1 border rounded-[5px] bg-white transition-colors',
                isSuspended
                  ? 'border-success/30 text-success hover:bg-success-lt'
                  : 'border-border text-warning hover:bg-warning-lt'
              )}
              onClick={() => setStatus.mutate({ membershipId: member.membership_id, memberStatus: isSuspended ? 'active' : 'suspended' })}
            >
              {isSuspended ? 'Activate' : 'Suspend'}
            </button>
            <button
              disabled={removeMutation.isPending}
              className="text-[11.5px] font-medium px-2.5 py-1 border border-border rounded-[5px] bg-white text-danger hover:bg-danger-lt transition-colors"
              onClick={() => {
                if (confirm(`Remove ${name} from the organisation?`)) {
                  removeMutation.mutate(member.membership_id)
                }
              }}
            >
              Remove
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

// ─── Invited row ───────────────────────────────────────────────────────────────

function InvitedRow({ invitation }: { invitation: OrgInvitationDTO }) {
  const revoke = useRevokeInvitation()
  const resend = useResendInvitation()

  return (
    <tr className="border-b border-border bg-warning-lt/30 hover:bg-warning-lt/50 transition-colors">
      <td className="px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-border-dk flex items-center justify-center text-text-3 text-sm font-medium flex-shrink-0">?</div>
          <div>
            <p className="text-[13px] font-medium text-text-2">{invitation.email}</p>
            <p className="text-[11px] text-text-3">
              {invitation.invited_by_name ? `Invited by ${invitation.invited_by_name}` : 'Invitation sent'}
              {' · '}{formatDate(invitation.created_at)}
            </p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3"><RolePill role={invitation.role} /></td>
      <td className="px-5 py-3"><StatusPill status="invited" /></td>
      <td className="px-5 py-3 text-[13px] text-text-3">—</td>
      <td className="px-5 py-3 text-[13px] text-text-3">—</td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-1.5">
          <button
            disabled={resend.isPending}
            className="text-[11.5px] font-medium px-2.5 py-1 border border-border rounded-[5px] bg-white text-text-2 hover:bg-surface flex items-center gap-1"
            onClick={() => resend.mutate(invitation.id)}
          >
            {resend.isPending && <Loader2 size={10} className="animate-spin" />} Resend
          </button>
          <button
            disabled={revoke.isPending}
            className="text-[11.5px] font-medium px-2.5 py-1 border border-border rounded-[5px] bg-white text-danger hover:bg-danger-lt flex items-center gap-1"
            onClick={() => revoke.mutate(invitation.id)}
          >
            {revoke.isPending && <Loader2 size={10} className="animate-spin" />} Revoke
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Invite panel ─────────────────────────────────────────────────────────────

function InvitePanel({ onClose, seatsRemaining }: { onClose: () => void; seatsRemaining: number }) {
  const [email, setEmail]   = useState('')
  const [role, setRole]     = useState('associate')
  const [note, setNote]     = useState('')
  const [sent, setSent]     = useState(false)
  const inviteMutation = useInviteMember()

  async function handleSend() {
    if (!email.trim()) return
    await inviteMutation.mutateAsync({ email: email.trim(), role, note: note || undefined })
    setSent(true)
    setTimeout(() => { setSent(false); setEmail(''); setNote('') }, 2000)
  }

  return (
    <div className="w-[300px] flex-shrink-0 flex flex-col overflow-hidden border-l border-border bg-white">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text">Invite Member</h3>
        <button onClick={onClose} className="text-text-3 hover:text-text p-1 rounded hover:bg-surface">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-text-3 uppercase tracking-wider mb-1">Email address</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-[8px] bg-white text-text focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
            placeholder="colleague@yourfirm.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-3 uppercase tracking-wider mb-2">Assign role</label>
          <div className="space-y-2">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRole(opt.value)}
                className={cn(
                  'w-full text-left p-3 border rounded-[8px] transition-colors flex items-start gap-2.5',
                  role === opt.value ? 'border-indigo bg-indigo-lt' : 'border-border hover:border-indigo-mid bg-white'
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                  role === opt.value ? 'border-indigo' : 'border-border'
                )}>
                  {role === opt.value && <div className="w-2 h-2 rounded-full bg-indigo" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">{opt.label}</p>
                  <p className="text-xs text-text-3 mt-0.5 leading-snug">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-3 uppercase tracking-wider mb-1">
            Personal note <span className="font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-[8px] bg-white text-text-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
            rows={3}
            placeholder="Add a message to the invitation…"
          />
        </div>
      </div>

      <div className="p-4 border-t border-border space-y-2">
        {inviteMutation.isError && (
          <p className="text-xs text-danger text-center">{(inviteMutation.error as Error).message}</p>
        )}
        <button
          disabled={!email.trim() || inviteMutation.isPending || sent}
          onClick={handleSend}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo text-white text-sm font-semibold rounded-[8px] hover:bg-indigo-dk transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {inviteMutation.isPending
            ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
            : sent
            ? <><Check size={14} /> Invitation sent!</>
            : <><Check size={14} /> Send Invitation</>
          }
        </button>
        {seatsRemaining > 0 && (
          <p className="text-xs text-text-3 text-center">Uses 1 of your {seatsRemaining} remaining seats</p>
        )}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type TabFilter = 'All' | 'Active' | 'Suspended' | 'Invited'

export function UserManagementPage() {
  const { data, isLoading } = useOrgMembers()
  const [search, setSearch]       = useState('')
  const [tab, setTab]             = useState<TabFilter>('All')
  const [inviteOpen, setInviteOpen] = useState(false)

  if (isLoading) return (
    <div className="flex-1 flex flex-col">
      <Topbar breadcrumb={[{ label: 'Firm Settings' }, { label: 'User Management' }]} />
      <PageLoader />
    </div>
  )

  const members     = data?.members ?? []
  const invitations = data?.invitations ?? []
  const orgName     = data?.org_name ?? 'Your Organisation'
  const plan        = data?.plan ?? 'trial'

  const activeCount    = members.filter((m) => m.membership_status === 'active').length
  const suspendedCount = members.filter((m) => m.membership_status === 'suspended').length
  const invitedCount   = invitations.length
  const seatsUsed      = activeCount
  const seatsRemaining = SEAT_TOTAL - seatsUsed

  // Determine current user — first admin or first member
  const currentUserMembershipId = members.find((m) => m.org_role === 'admin')?.membership_id ?? members[0]?.membership_id

  const filtered = members.filter((m) => {
    const name = memberDisplayName(m).toLowerCase()
    const matchSearch = name.includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase())
    const matchTab =
      tab === 'All' ||
      (tab === 'Active' && m.membership_status === 'active') ||
      (tab === 'Suspended' && m.membership_status === 'suspended')
    return matchSearch && matchTab
  })

  const showInvited = tab === 'All' || tab === 'Invited'
  const filteredInvitations = invitations.filter((inv) =>
    !search || inv.email.toLowerCase().includes(search.toLowerCase())
  )

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
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Firm header + seat meter */}
          <div className="flex items-start justify-between px-7 py-5 border-b border-border bg-white">
            <div>
              <h1 className="text-xl font-semibold text-text">{orgName}</h1>
              <p className="text-sm text-text-2 mt-0.5">
                {activeCount} active · {invitedCount} pending · {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
              </p>
            </div>
            <div className="p-4 border border-border rounded-[9px] bg-white min-w-[200px]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-text-3">Seats used</p>
                <p className="text-xs font-semibold text-text">{seatsUsed} / {SEAT_TOTAL}</p>
              </div>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full bg-indigo transition-all" style={{ width: `${Math.min((seatsUsed / SEAT_TOTAL) * 100, 100)}%` }} />
              </div>
              <p className="text-xs text-text-3">{seatsRemaining} seats remaining</p>
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
            <div className="flex items-center gap-1 ml-auto">
              {([
                ['All',       activeCount + suspendedCount],
                ['Active',    activeCount],
                ['Suspended', suspendedCount],
                ['Invited',   invitedCount],
              ] as [TabFilter, number][]).map(([t, count]) => (
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
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Member', 'Role', 'Status', 'Last Active', 'Joined', ''].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-[11px] font-bold text-text-3 uppercase tracking-wider bg-surface border-b border-border sticky top-0 z-10">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <ActiveRow key={m.membership_id} member={m} isMe={m.membership_id === currentUserMembershipId} />
                ))}
                {showInvited && filteredInvitations.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={6} style={{ padding: 0 }}>
                        <div className="flex items-center gap-3 px-5 py-2.5 bg-warning-lt border-y border-warning/20">
                          <span className="text-xs font-semibold text-warning">Pending Invitations</span>
                          <span className="text-xs text-warning/70">{filteredInvitations.length} awaiting</span>
                        </div>
                      </td>
                    </tr>
                    {filteredInvitations.map((inv) => (
                      <InvitedRow key={inv.id} invitation={inv} />
                    ))}
                  </>
                )}
                {filtered.length === 0 && (!showInvited || filteredInvitations.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-[13px] text-text-3">
                      {search ? 'No members match your search.' : 'No members yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {inviteOpen && (
          <InvitePanel onClose={() => setInviteOpen(false)} seatsRemaining={seatsRemaining} />
        )}
      </div>
    </div>
  )
}
