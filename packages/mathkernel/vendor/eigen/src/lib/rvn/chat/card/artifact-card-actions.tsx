import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ArtifactCardActionsProps = ComponentPropsWithoutRef<'footer'>

export const ArtifactCardActions = forwardRef<HTMLElement, ArtifactCardActionsProps>(
  ({ className, ...props }, ref) => (
    <footer
      ref={ref}
      data-slot="rvn-chat-artifact-card-actions"
      className={cn('rvn-chat__artifact-card-actions', className)}
      {...props}
    />
  ),
)

ArtifactCardActions.displayName = 'RvnChatArtifactCard.Actions'
