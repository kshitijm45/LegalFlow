import { Link } from 'react-router-dom'
import { Upload, Play, AlertTriangle, FileText, TrendingUp, CheckCircle, ArrowRight, Clock } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { useContracts, formatFileSize } from '@/hooks/useVault'
import { useObligationsList } from '@/hooks/useObligations'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'

export function DashboardPage() {
  const { user } = useAuth()
  const { data: contractsData, isLoading: contractsLoading } = useContracts()
  const { data: obligationsData, isLoading: obligationsLoading } = useObligationsList()

  if (contractsLoading || obligationsLoading) return (
    <div className="flex-1 flex flex-col">
      <Topbar breadcrumb={[{ label: 'Dashboard' }]} />
      <PageLoader />
    </div>
  )

  const contracts = contractsData?.contracts ?? []
  const obligations = obligationsData?.obligations ?? []
  const recentDocs = contracts.slice(0, 5)

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const contractsThisMonth = contracts.filter((c) => {
    const d = new Date(c.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const overdueObligations = obligations.filter(
    (o) => o.status !== 'done' && o.due_date && o.due_date < today
  )

  const expiringSoon = contracts.filter((c) => {
    if (!c.expiry_date) return false
    const daysLeft = Math.ceil((new Date(c.expiry_date).getTime() - now.getTime()) / 86_400_000)
    return daysLeft >= 0 && daysLeft <= 30
  })

  const firstName = user?.name?.split(' ')[0] ?? 'there'

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        breadcrumb={[{ label: 'Dashboard' }]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/app/workflow-builder" className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-2 border border-border rounded-[8px] hover:bg-surface transition-colors">
              <Play size={14} /> Run Workflow
            </Link>
            <Link to="/app/vault" className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-indigo rounded-[8px] hover:bg-indigo-dk transition-colors">
              <Upload size={14} /> Upload Contract
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-semibold text-text">{greeting}, {firstName}</h1>
          <p className="text-sm text-text-2 mt-0.5">Here's what needs your attention today.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: 'Total Contracts',
              value: contracts.length,
              icon: FileText,
              color: 'text-text',
              bg: 'bg-surface',
              iconColor: 'text-text-3',
              to: '/app/vault',
            },
            {
              label: 'Overdue Obligations',
              value: overdueObligations.length,
              icon: AlertTriangle,
              color: overdueObligations.length > 0 ? 'text-danger' : 'text-text',
              bg: overdueObligations.length > 0 ? 'bg-danger-lt' : 'bg-surface',
              iconColor: overdueObligations.length > 0 ? 'text-danger' : 'text-text-3',
              to: '/app/obligations',
            },
            {
              label: 'Analyzed',
              value: contracts.filter((c) => c.status === 'ready').length,
              icon: TrendingUp,
              color: 'text-indigo',
              bg: 'bg-indigo-lt',
              iconColor: 'text-indigo',
              to: '/app/vault',
            },
            {
              label: 'Added This Month',
              value: contractsThisMonth,
              icon: CheckCircle,
              color: 'text-success',
              bg: 'bg-success-lt',
              iconColor: 'text-success',
              to: '/app/vault',
            },
          ].map((card) => (
            <Link key={card.label} to={card.to} className="bg-white border border-border rounded-[9px] p-5 hover:border-border-dk transition-colors block">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-text-2">{card.label}</p>
                <div className={`p-2 rounded-[7px] ${card.bg}`}>
                  <card.icon size={16} className={card.iconColor} />
                </div>
              </div>
              <p className={`text-3xl font-semibold ${card.color}`}>{card.value}</p>
            </Link>
          ))}
        </div>

        {/* Expiry warning banner — only shown when contracts are expiring soon */}
        {expiringSoon.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-warning-lt border border-warning/30 rounded-[9px]">
            <div className="p-1.5 bg-warning/10 rounded-[6px] flex-shrink-0">
              <Clock size={16} className="text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-warning mb-0.5">
                {expiringSoon.length} contract{expiringSoon.length > 1 ? 's' : ''} expiring within 30 days
              </p>
              <p className="text-sm text-warning/80 truncate">
                {expiringSoon.map(c => c.name).join(' · ')}
              </p>
            </div>
            <Link to="/app/vault" className="flex items-center gap-1 text-xs font-semibold text-warning hover:underline flex-shrink-0">
              Review <ArrowRight size={12} />
            </Link>
          </div>
        )}

        {/* Bottom grid */}
        <div className="grid grid-cols-[1fr_360px] gap-5">
          {/* Recent contracts */}
          <div className="bg-white border border-border rounded-[9px] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text">Recent Contracts</h2>
              <Link to="/app/vault" className="text-xs text-indigo font-medium hover:underline flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {recentDocs.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <FileText size={24} className="text-text-3 mx-auto mb-2" />
                  <p className="text-sm text-text-2">No contracts yet</p>
                  <Link to="/app/vault" className="text-xs text-indigo font-medium hover:underline mt-1 inline-block">Upload your first contract</Link>
                </div>
              ) : (
                recentDocs.map((doc) => (
                  <Link key={doc.id} to="/app/vault" className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface transition-colors cursor-pointer">
                    <div className="w-8 h-8 bg-indigo-lt rounded-[7px] flex items-center justify-center text-xs font-bold text-indigo flex-shrink-0">
                      {(doc.contract_type ?? 'O').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">{doc.name}</p>
                      <p className="text-xs text-text-3 mt-0.5">{doc.contract_type ?? 'Unknown'} · {formatDate(doc.created_at)} · {formatFileSize(doc.file_size)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={doc.status === 'ready' ? 'processed' : doc.status === 'failed' ? 'failed' : 'processing'} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Overdue obligations panel */}
          <div className="bg-white border border-border rounded-[9px] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text">Overdue Obligations</h2>
              <Link to="/app/obligations" className="text-xs text-indigo font-medium hover:underline flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {overdueObligations.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle size={24} className="text-success mx-auto mb-2" />
                <p className="text-sm text-text-2">All caught up!</p>
                <p className="text-xs text-text-3 mt-1">No overdue obligations</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {overdueObligations.slice(0, 5).map((ob) => {
                  const daysOverdue = ob.due_date
                    ? Math.floor((now.getTime() - new Date(ob.due_date).getTime()) / 86_400_000)
                    : 0
                  return (
                    <Link key={ob.id} to="/app/obligations" className="flex items-start gap-3 px-4 py-3 hover:bg-surface transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{ob.title}</p>
                        <p className="text-xs text-danger mt-0.5">{daysOverdue}d overdue · {ob.category}</p>
                      </div>
                    </Link>
                  )
                })}
                {overdueObligations.length > 5 && (
                  <div className="px-4 py-2.5">
                    <Link to="/app/obligations" className="text-xs text-indigo font-medium hover:underline">
                      +{overdueObligations.length - 5} more
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
