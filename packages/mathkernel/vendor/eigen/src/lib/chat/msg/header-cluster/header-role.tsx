import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatMessageHeaderRoleProps = ComponentPropsWithoutRef<'span'>

export const ChatMessageHeaderRole = forwardRef<HTMLSpanElement, ChatMessageHeaderRoleProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="tmnl-chat-message-header-role"
      className={cn(
        'font-mono uppercase tracking-widest text-neutral-400',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    />
  ),
)

ChatMessageHeaderRole.displayName = 'ChatMessage.HeaderCluster.Role'
