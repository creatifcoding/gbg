import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatMessageActionsGroupProps = ComponentPropsWithoutRef<'div'>

export const ChatMessageActionsGroup = forwardRef<HTMLDivElement, ChatMessageActionsGroupProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-message-actions-group"
      className={cn('flex items-center gap-0.5', className)}
      {...props}
    />
  ),
)

ChatMessageActionsGroup.displayName = 'ChatMessage.FooterActions.Group'
