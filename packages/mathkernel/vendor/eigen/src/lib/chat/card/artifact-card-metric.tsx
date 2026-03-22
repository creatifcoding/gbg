import { cn } from '@/lib/utils'

export interface ArtifactCardMetricProps {
  label: string
  value: string | number
  color?: string
  className?: string
}

export function ArtifactCardMetric({ label, value, color, className }: ArtifactCardMetricProps) {
  return (
    <div className={cn('flex items-baseline gap-1', className)}>
      <span
        className={cn('font-mono tabular-nums', color ?? 'text-neutral-300')}
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {value}
      </span>
      <span
        className="font-mono text-neutral-600 uppercase tracking-wider"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {label}
      </span>
    </div>
  )
}

ArtifactCardMetric.displayName = 'ChatArtifactCard.Metric'
