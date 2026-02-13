import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ArtifactCardMetricProps = ComponentPropsWithoutRef<'div'>

export const ArtifactCardMetric = forwardRef<HTMLDivElement, ArtifactCardMetricProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-artifact-card-metric"
      className={cn('rvn-chat__artifact-card-metric', className)}
      {...props}
    />
  ),
)

ArtifactCardMetric.displayName = 'RvnChatArtifactCard.Metric'
