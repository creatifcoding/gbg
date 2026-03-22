import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatHeaderBadgesSlotProps = ComponentPropsWithoutRef<'div'>

export const RvnChatHeaderBadgesSlot = forwardRef<HTMLDivElement, RvnChatHeaderBadgesSlotProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-shell-header-badges"
      className={cn('rvn-chat__status-cluster', 'rvn-chat-shell__header-badges', className)}
      {...props}
    />
  ),
)

RvnChatHeaderBadgesSlot.displayName = 'RvnChatShell.Header.Badges'
