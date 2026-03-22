import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatMessageActionsGroupProps = ComponentPropsWithoutRef<'div'>

export const RvnChatMessageActionsGroup = forwardRef<HTMLDivElement, RvnChatMessageActionsGroupProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-message-actions-group"
      className={cn('rvn-chat__message-actions-group', className)}
      {...props}
    />
  ),
)

RvnChatMessageActionsGroup.displayName = 'RvnChatMessage.FooterActions.Group'
