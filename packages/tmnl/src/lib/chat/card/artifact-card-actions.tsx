import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ArtifactCardActionsProps = ComponentPropsWithoutRef<'footer'>

export const ArtifactCardActions = forwardRef<HTMLElement, ArtifactCardActionsProps>(
  ({ className, ...props }, ref) => (
    <footer
      ref={ref}
      data-slot="tmnl-chat-artifact-card-actions"
      className={cn(
        'flex items-center gap-1.5 mt-2 pt-2',
        'border-t border-neutral-800/30',
        className,
      )}
      {...props}
    />
  ),
)

ArtifactCardActions.displayName = 'ChatArtifactCard.Actions'
