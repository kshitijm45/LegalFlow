import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

const roleConfig: Record<UserRole, { label: string; bg: string; text: string }> = {
  admin: { label: 'Firm Admin', bg: '#FDF4FF', text: '#7C3AED' },
  partner: { label: 'Partner', bg: '#EEF2FF', text: '#4338CA' },
  senior_associate: { label: 'Senior Associate', bg: '#F8FAFC', text: '#475569' },
  associate: { label: 'Associate', bg: '#F8FAFC', text: '#475569' },
  paralegal: { label: 'Paralegal', bg: '#FEF3C7', text: '#D97706' },
  guest: { label: 'Guest', bg: '#F8FAFC', text: '#94A3B8' },
}

interface RoleBadgeProps {
  role: UserRole
  className?: string
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleConfig[role] ?? roleConfig.guest

  return (
    <span
      className={cn('inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium', className)}
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  )
}

export function getRoleLabel(role: UserRole): string {
  return roleConfig[role]?.label ?? role
}
