import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ArtifactCardHeaderProps = ComponentPropsWithoutRef<'header'>

export const ArtifactCardHeader = forwardRef<HTMLElement, ArtifactCardHeaderProps>(
  ({ className, ...props }, ref) => (
    <header
      ref={ref}
      data-slot="tmnl-chat-artifact-card-header"
      className={cn(
        'flex items-center gap-2 mb-2',
        'font-mono text-neutral-300',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      {...props}
    />
  ),
)

ArtifactCardHeader.displayName = 'ChatArtifactCard.Header'
