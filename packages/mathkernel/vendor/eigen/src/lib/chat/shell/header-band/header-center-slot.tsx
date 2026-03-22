import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatHeaderCenterSlotProps = ComponentPropsWithoutRef<'div'>

export const ChatHeaderCenterSlot = forwardRef<HTMLDivElement, ChatHeaderCenterSlotProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-shell-header-center"
      className={cn('flex items-center justify-center flex-1 min-w-0', className)}
      {...props}
    />
  ),
)

ChatHeaderCenterSlot.displayName = 'ChatShell.Header.Center'
