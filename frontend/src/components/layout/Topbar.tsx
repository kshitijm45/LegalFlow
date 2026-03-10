import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopbarProps {
  breadcrumb: { label: string; href?: string }[]
  actions?: React.ReactNode
  className?: string
}

export function Topbar({ breadcrumb, actions, className }: TopbarProps) {
  return (
    <div
      className={cn(
        'h-[60px] flex-shrink-0 flex items-center justify-between px-6 border-b border-border bg-white',
        className
      )}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5">
        {breadcrumb.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={14} className="text-text-3" />}
            <span
              className={cn(
                'text-sm',
                i === breadcrumb.length - 1
                  ? 'text-text font-medium'
                  : 'text-text-3'
              )}
            >
              {item.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Actions */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
