import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Archive,
  BarChart2,
  ClipboardCheck,
  Bell,
  GitCommitHorizontal,
  Workflow,
  Users,
  Shield,
  CreditCard,
  LogOut,
  Scale,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  LayoutDashboard,
  Archive,
  BarChart2,
  ClipboardCheck,
  Bell,
  GitCommitHorizontal,
  Workflow,
  Users,
  Shield,
  CreditCard,
}

interface NavItemProps {
  to: string
  icon: string
  label: string
  badge?: number
}

function SidebarNavItem({ to, icon, label, badge }: NavItemProps) {
  const location = useLocation()
  const isActive = location.pathname === to
  const Icon = iconMap[icon]

  return (
    <NavLink
      to={to}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-sm font-medium transition-colors',
        isActive
          ? 'bg-indigo-lt text-indigo font-semibold'
          : 'text-text-2 hover:bg-surface hover:text-text'
      )}
    >
      {Icon && <Icon size={16} className={isActive ? 'text-indigo' : 'text-text-3'} />}
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs font-semibold bg-danger text-white rounded-pill px-1.5 py-0.5 leading-none">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user ? getInitials(user.name) : 'JM'

  return (
    <aside className="w-[224px] flex-shrink-0 h-full flex flex-col bg-white border-r border-border">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo rounded-[7px] flex items-center justify-center">
            <Scale size={14} className="text-white" />
          </div>
          <span className="font-semibold text-text text-[15px] tracking-tight">LegalFlow</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* Main nav */}
        <SidebarNavItem to="/app/dashboard" icon="LayoutDashboard" label="Dashboard" />
        <SidebarNavItem to="/app/vault" icon="Archive" label="The Vault" />

        {/* AI Tools section */}
        <div className="pt-4 pb-1">
          <p className="px-3 text-[10px] font-semibold text-text-3 uppercase tracking-widest mb-1">
            AI Tools
          </p>
        </div>
        <SidebarNavItem to="/app/market-analysis" icon="BarChart2" label="Market Analysis" />
        <SidebarNavItem to="/app/clause-audit" icon="ClipboardCheck" label="Clause Audit" />
        <SidebarNavItem to="/app/obligations" icon="Bell" label="Obligations" badge={3} />
        <SidebarNavItem to="/app/timeline" icon="GitCommitHorizontal" label="Timeline" />
        <SidebarNavItem to="/app/workflow-builder" icon="Workflow" label="Workflow Builder" />


          <>
            <div className="pt-4 pb-1">
              <p className="px-3 text-[10px] font-semibold text-text-3 uppercase tracking-widest mb-1">
                Firm Settings
              </p>
            </div>
            <SidebarNavItem to="/app/settings/users" icon="Users" label="User Management" />
            <SidebarNavItem to="/app/settings/security" icon="Shield" label="Security & SSO" />
            <SidebarNavItem to="/app/settings/billing" icon="CreditCard" label="Billing & Plan" />
          </>
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-[8px] group">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: '#4338CA' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-text truncate">{user?.name ?? 'Arjun Mehta'}</p>
            <p className="text-[11px] text-text-3 truncate">
              Firm Admin
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface text-text-3 hover:text-danger"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
