import { Link } from 'react-router-dom'
import { Upload, Play, AlertTriangle, FileText, TrendingUp, Clock, CheckCircle, ArrowRight } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { useDashboardStats, useDocuments, useObligations } from '@/hooks/useMockQuery'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, formatRelativeDate } from '@/lib/utils'

export function DashboardPage() {
  const { user } = useAuth()
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: documents } = useDocuments()
  const { data: obligations } = useObligations()

  if (statsLoading) return (
    <div className="flex-1 flex flex-col">
      <Topbar breadcrumb={[{ label: 'Dashboard' }]} />
      <PageLoader />
    </div>
  )

  const recentDocs = documents?.slice(0, 5) ?? []
  const overdueObs = obligations?.filter((o) => o.status === 'overdue').slice(0, 3) ?? []

  const firstName = user?.name.split(' ')[0] ?? 'James'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        breadcrumb={[{ label: 'Dashboard' }]}
        actions={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-2 border border-border rounded-[8px] hover:bg-surface transition-colors">
              <Play size={14} /> Run Workflow
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-indigo rounded-[8px] hover:bg-indigo-dk transition-colors">
              <Upload size={14} /> Upload Contract
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-semibold text-text">Good morning, {firstName} 👋</h1>
          <p className="text-sm text-text-2 mt-0.5">Here's what needs your attention today.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: 'Total Contracts',
              value: stats?.totalContracts ?? 0,
              icon: FileText,
              color: 'text-text',
              bg: 'bg-surface',
              iconColor: 'text-text-3',
            },
            {
              label: 'Overdue Obligations',
              value: stats?.overdueObligations ?? 0,
              icon: AlertTriangle,
              color: 'text-danger',
              bg: 'bg-danger-lt',
              iconColor: 'text-danger',
            },
            {
              label: 'Avg Coverage Score',
              value: `${stats?.avgCoverageScore ?? 0}%`,
              icon: TrendingUp,
              color: 'text-indigo',
              bg: 'bg-indigo-lt',
              iconColor: 'text-indigo',
            },
            {
              label: 'Added This Month',
              value: stats?.contractsThisMonth ?? 0,
              icon: CheckCircle,
              color: 'text-success',
              bg: 'bg-success-lt',
              iconColor: 'text-success',
            },
          ].map((card) => (
            <div key={card.label} className="bg-white border border-border rounded-[9px] p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-text-2">{card.label}</p>
                <div className={`p-2 rounded-[7px] ${card.bg}`}>
                  <card.icon size={16} className={card.iconColor} />
                </div>
              </div>
              <p className={`text-3xl font-semibold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* AI Insight banner */}
        <div className="flex items-start gap-3 p-4 bg-indigo-lt border border-indigo-mid rounded-[9px]">
          <div className="p-1.5 bg-indigo/10 rounded-[6px]">
            <TrendingUp size={16} className="text-indigo" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-indigo mb-0.5">⚡ AI Insight</p>
            <p className="text-sm text-indigo/80">
              2 contracts have missing IP assignment clauses — Tata Digital MSA and Razorpay SaaS Agreement.
              Review recommended before next renewal window opens on Feb 10.
            </p>
          </div>
          <Link to="/app/clause-audit" className="flex items-center gap-1 text-xs font-semibold text-indigo hover:underline flex-shrink-0">
            Review <ArrowRight size={12} />
          </Link>
        </div>

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
              {recentDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface transition-colors cursor-pointer">
                  <div className="w-8 h-8 bg-indigo-lt rounded-[7px] flex items-center justify-center text-xs font-bold text-indigo flex-shrink-0">
                    {doc.type.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{doc.name}</p>
                    <p className="text-xs text-text-3 mt-0.5">{doc.type} · {formatDate(doc.uploadedAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Coverage bar */}
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${doc.coverage}%`,
                            backgroundColor: doc.coverage >= 80 ? '#059669' : doc.coverage >= 60 ? '#4338CA' : '#D97706',
                          }}
                        />
                      </div>
                      <span className="text-xs text-text-3 w-8 text-right">{doc.coverage}%</span>
                    </div>
                    <StatusBadge status={doc.status as 'processed' | 'processing' | 'failed'} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Overdue obligations */}
          <div className="bg-white border border-border rounded-[9px] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text">Overdue Obligations</h2>
              <Link to="/app/obligations" className="text-xs text-indigo font-medium hover:underline flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {overdueObs.map((ob) => (
                <div key={ob.id} className="px-5 py-4 hover:bg-surface transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1 bg-danger-lt rounded-[5px]">
                      <Clock size={13} className="text-danger" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text leading-snug">{ob.title}</p>
                      <p className="text-xs text-text-3 mt-0.5 truncate">{ob.documentName}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-medium text-danger">
                          Due {formatRelativeDate(ob.dueDate)}
                        </span>
                        <span className="text-text-3">·</span>
                        <span className="text-xs text-text-3">{ob.assignee}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {overdueObs.length === 0 && (
                <div className="px-5 py-8 text-center">
                  <CheckCircle size={24} className="text-success mx-auto mb-2" />
                  <p className="text-sm text-text-2">All caught up!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
