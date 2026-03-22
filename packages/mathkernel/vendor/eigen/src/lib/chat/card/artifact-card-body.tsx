import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ArtifactCardBodyProps = ComponentPropsWithoutRef<'div'>

export const ArtifactCardBody = forwardRef<HTMLDivElement, ArtifactCardBodyProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-artifact-card-body"
      className={cn('font-mono text-neutral-400', className)}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    />
  ),
)

ArtifactCardBody.displayName = 'ChatArtifactCard.Body'
