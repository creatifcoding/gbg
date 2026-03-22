import { cn } from '@/lib/utils'

export interface InlineTaskRowProgressProps {
  progress: number
  status: string
  className?: string
}

const BAR_COLOR: Record<string, string> = {
  completed: 'bg-emerald-400',
  failed: 'bg-red-400',
  running: 'bg-cyan-400',
  blocked: 'bg-amber-400',
}

export function InlineTaskRowProgress({ progress, status, className }: InlineTaskRowProgressProps) {
  const clamped = Math.max(0, Math.min(100, progress))
  const color = BAR_COLOR[status] ?? 'bg-neutral-500'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span
        className="font-mono text-neutral-500 tabular-nums shrink-0"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {Math.round(clamped)}%
      </span>
    </div>
  )
}

InlineTaskRowProgress.displayName = 'InlineTaskShell.RowProgress'
