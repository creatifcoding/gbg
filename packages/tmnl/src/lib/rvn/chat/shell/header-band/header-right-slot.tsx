import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatHeaderRightSlotProps = ComponentPropsWithoutRef<'div'>

export const RvnChatHeaderRightSlot = forwardRef<HTMLDivElement, RvnChatHeaderRightSlotProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-shell-header-right"
      className={cn('rvn-chat-shell__header-right', className)}
      {...props}
    />
  ),
)

RvnChatHeaderRightSlot.displayName = 'RvnChatShell.Header.Right'
