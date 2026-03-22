import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatHeaderLeftSlotProps = ComponentPropsWithoutRef<'div'>

export const RvnChatHeaderLeftSlot = forwardRef<HTMLDivElement, RvnChatHeaderLeftSlotProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-shell-header-left"
      className={cn('rvn-chat-shell__header-left', className)}
      {...props}
    />
  ),
)

RvnChatHeaderLeftSlot.displayName = 'RvnChatShell.Header.Left'
