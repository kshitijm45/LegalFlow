import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  className?: string
  size?: number
}

export function LoadingSpinner({ className, size = 20 }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className="border-2 border-border border-t-indigo rounded-full animate-spin"
        style={{ width: size, height: size }}
      />
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <LoadingSpinner size={28} />
    </div>
  )
}
