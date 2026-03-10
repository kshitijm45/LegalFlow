import { cn } from '@/lib/utils'

type Status = 'active' | 'invited' | 'suspended' | 'overdue' | 'pending' | 'completed' | 'processing' | 'processed' | 'failed'

const statusConfig: Record<Status, { label: string; dot: string; bg: string; text: string }> = {
  active: { label: 'Active', dot: '#059669', bg: '#D1FAE5', text: '#059669' },
  invited: { label: 'Invited', dot: '#D97706', bg: '#FEF3C7', text: '#D97706' },
  suspended: { label: 'Suspended', dot: '#94A3B8', bg: '#F1F5F9', text: '#475569' },
  overdue: { label: 'Overdue', dot: '#DC2626', bg: '#FEE2E2', text: '#DC2626' },
  pending: { label: 'Pending', dot: '#D97706', bg: '#FEF3C7', text: '#D97706' },
  completed: { label: 'Completed', dot: '#059669', bg: '#D1FAE5', text: '#059669' },
  processing: { label: 'Processing', dot: '#4338CA', bg: '#EEF2FF', text: '#4338CA' },
  processed: { label: 'Processed', dot: '#059669', bg: '#D1FAE5', text: '#059669' },
  failed: { label: 'Failed', dot: '#DC2626', bg: '#FEE2E2', text: '#DC2626' },
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.pending

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-medium', className)}
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: config.dot }}
      />
      {config.label}
    </span>
  )
}
