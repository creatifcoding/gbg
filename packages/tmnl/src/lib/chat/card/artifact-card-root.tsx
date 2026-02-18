import { forwardRef, type ComponentPropsWithoutRef, type ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { ArtifactCardHeader, type ArtifactCardHeaderProps } from './artifact-card-header'
import { ArtifactCardBody, type ArtifactCardBodyProps } from './artifact-card-body'
import { ArtifactCardActions, type ArtifactCardActionsProps } from './artifact-card-actions'
import { ArtifactCardMetric, type ArtifactCardMetricProps } from './artifact-card-metric'

export interface ChatArtifactCardRootProps extends ComponentPropsWithoutRef<'div'> {
  variant?: 'default' | 'compact'
}

const Root = forwardRef<HTMLDivElement, ChatArtifactCardRootProps>(
  ({ variant = 'default', className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-artifact-card"
      data-variant={variant}
      className={cn(
        'rounded-lg border border-neutral-800/50 overflow-hidden',
        'bg-neutral-900/30',
        variant === 'compact' ? 'p-2' : 'p-3',
        className,
      )}
      {...props}
    />
  ),
)
Root.displayName = 'ChatArtifactCard.Root'

interface ChatArtifactCardComponent {
  (props: ChatArtifactCardRootProps): ReactElement
  displayName?: string
  Root: typeof Root
  Header: typeof ArtifactCardHeader
  Body: typeof ArtifactCardBody
  Actions: typeof ArtifactCardActions
  Metric: typeof ArtifactCardMetric
}

const ChatArtifactCard = Root as unknown as ChatArtifactCardComponent
ChatArtifactCard.Root = Root
ChatArtifactCard.Header = ArtifactCardHeader
ChatArtifactCard.Body = ArtifactCardBody
ChatArtifactCard.Actions = ArtifactCardActions
ChatArtifactCard.Metric = ArtifactCardMetric

export { ChatArtifactCard }
export type { ArtifactCardHeaderProps, ArtifactCardBodyProps, ArtifactCardActionsProps, ArtifactCardMetricProps }
