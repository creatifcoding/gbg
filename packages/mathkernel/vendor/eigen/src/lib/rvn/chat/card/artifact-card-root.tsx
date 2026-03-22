import { forwardRef, type ComponentPropsWithoutRef, type ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { ArtifactCardHeader } from './artifact-card-header'
import { ArtifactCardBody } from './artifact-card-body'
import { ArtifactCardMetric } from './artifact-card-metric'
import { ArtifactCardActions } from './artifact-card-actions'

export interface RvnChatArtifactCardRootProps extends ComponentPropsWithoutRef<'article'> {}

const Root = forwardRef<HTMLElement, RvnChatArtifactCardRootProps>(({ className, ...props }, ref) => (
  <article
    ref={ref}
    data-slot="rvn-chat-artifact-card"
    className={cn('rvn-chat__artifact-card', className)}
    {...props}
  />
))
Root.displayName = 'RvnChatArtifactCard.Root'

interface RvnChatArtifactCardComponent {
  (props: RvnChatArtifactCardRootProps): ReactElement
  displayName?: string
  Root: typeof Root
  Header: typeof ArtifactCardHeader
  Body: typeof ArtifactCardBody
  Metric: typeof ArtifactCardMetric
  Actions: typeof ArtifactCardActions
}

const RvnChatArtifactCard = Root as RvnChatArtifactCardComponent
RvnChatArtifactCard.Root = Root
RvnChatArtifactCard.Header = ArtifactCardHeader
RvnChatArtifactCard.Body = ArtifactCardBody
RvnChatArtifactCard.Metric = ArtifactCardMetric
RvnChatArtifactCard.Actions = ArtifactCardActions

export { RvnChatArtifactCard }
