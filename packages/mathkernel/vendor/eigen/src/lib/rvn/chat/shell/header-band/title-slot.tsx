import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatHeaderTitleSlotProps = ComponentPropsWithoutRef<'h2'>

export const RvnChatHeaderTitleSlot = forwardRef<HTMLHeadingElement, RvnChatHeaderTitleSlotProps>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      data-slot="rvn-chat-shell-header-title"
      className={cn('rvn-chat__title', 'rvn-chat-shell__header-title', className)}
      {...props}
    />
  ),
)

RvnChatHeaderTitleSlot.displayName = 'RvnChatShell.Header.Title'
