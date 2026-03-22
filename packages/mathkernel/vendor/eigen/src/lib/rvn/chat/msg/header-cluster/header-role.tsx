import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatMessageHeaderRoleProps = ComponentPropsWithoutRef<'span'>

export const RvnChatMessageHeaderRole = forwardRef<HTMLSpanElement, RvnChatMessageHeaderRoleProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="rvn-chat-message-header-role"
      className={cn('rvn-chat__message-role', className)}
      {...props}
    />
  ),
)

RvnChatMessageHeaderRole.displayName = 'RvnChatMessage.HeaderCluster.Role'
