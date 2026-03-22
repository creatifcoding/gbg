import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatHeaderLeftSlotProps = ComponentPropsWithoutRef<'div'>

export const ChatHeaderLeftSlot = forwardRef<HTMLDivElement, ChatHeaderLeftSlotProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-shell-header-left"
      className={cn('flex items-center gap-2 min-w-0', className)}
      {...props}
    />
  ),
)

ChatHeaderLeftSlot.displayName = 'ChatShell.Header.Left'
