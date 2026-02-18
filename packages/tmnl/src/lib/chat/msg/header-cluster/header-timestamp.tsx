import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatMessageHeaderTimestampProps = ComponentPropsWithoutRef<'time'>

export const ChatMessageHeaderTimestamp = forwardRef<HTMLElement, ChatMessageHeaderTimestampProps>(
  ({ className, ...props }, ref) => (
    <time
      ref={ref}
      data-slot="tmnl-chat-message-header-timestamp"
      className={cn('font-mono text-neutral-600', className)}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    />
  ),
)

ChatMessageHeaderTimestamp.displayName = 'ChatMessage.HeaderCluster.Timestamp'
