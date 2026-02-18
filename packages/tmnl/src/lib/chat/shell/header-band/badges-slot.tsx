import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatHeaderBadgesSlotProps = ComponentPropsWithoutRef<'div'>

export const ChatHeaderBadgesSlot = forwardRef<HTMLDivElement, ChatHeaderBadgesSlotProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-shell-header-badges"
      className={cn('flex items-center gap-1.5', className)}
      {...props}
    />
  ),
)

ChatHeaderBadgesSlot.displayName = 'ChatShell.Header.Badges'
