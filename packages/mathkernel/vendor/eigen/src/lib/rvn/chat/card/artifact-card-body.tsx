import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ArtifactCardBodyProps = ComponentPropsWithoutRef<'div'>

export const ArtifactCardBody = forwardRef<HTMLDivElement, ArtifactCardBodyProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-artifact-card-body"
      className={cn('rvn-chat__artifact-card-body', className)}
      {...props}
    />
  ),
)

ArtifactCardBody.displayName = 'RvnChatArtifactCard.Body'
