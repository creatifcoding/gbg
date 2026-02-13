import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatMessageHeaderTimestampProps = ComponentPropsWithoutRef<'time'>

export const RvnChatMessageHeaderTimestamp = forwardRef<HTMLElement, RvnChatMessageHeaderTimestampProps>(
  ({ className, ...props }, ref) => (
    <time
      ref={ref}
      data-slot="rvn-chat-message-header-timestamp"
      className={cn('rvn-chat__message-timestamp', className)}
      {...props}
    />
  ),
)

RvnChatMessageHeaderTimestamp.displayName = 'RvnChatMessage.HeaderCluster.Timestamp'
