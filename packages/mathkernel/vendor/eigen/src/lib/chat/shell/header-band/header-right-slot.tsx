import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatHeaderRightSlotProps = ComponentPropsWithoutRef<'div'>

export const ChatHeaderRightSlot = forwardRef<HTMLDivElement, ChatHeaderRightSlotProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-shell-header-right"
      className={cn('flex items-center gap-2 ml-auto', className)}
      {...props}
    />
  ),
)

ChatHeaderRightSlot.displayName = 'ChatShell.Header.Right'
