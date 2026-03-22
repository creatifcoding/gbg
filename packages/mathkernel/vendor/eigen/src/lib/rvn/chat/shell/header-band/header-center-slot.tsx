import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatHeaderCenterSlotProps = ComponentPropsWithoutRef<'div'>

export const RvnChatHeaderCenterSlot = forwardRef<HTMLDivElement, RvnChatHeaderCenterSlotProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-shell-header-center"
      className={cn('rvn-chat-shell__header-center', className)}
      {...props}
    />
  ),
)

RvnChatHeaderCenterSlot.displayName = 'RvnChatShell.Header.Center'
