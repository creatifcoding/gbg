import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ArtifactCardHeaderProps = ComponentPropsWithoutRef<'header'>

export const ArtifactCardHeader = forwardRef<HTMLElement, ArtifactCardHeaderProps>(
  ({ className, ...props }, ref) => (
    <header
      ref={ref}
      data-slot="rvn-chat-artifact-card-header"
      className={cn('rvn-chat__artifact-card-header', className)}
      {...props}
    />
  ),
)

ArtifactCardHeader.displayName = 'RvnChatArtifactCard.Header'
