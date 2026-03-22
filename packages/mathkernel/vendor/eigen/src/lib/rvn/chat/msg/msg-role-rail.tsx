import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import type { RvnChatMessageRole } from '../RvnChatMessage'

export interface RvnChatMessageRoleRailProps extends ComponentPropsWithoutRef<'div'> {
  role: RvnChatMessageRole
}

export const RvnChatMessageRoleRail = forwardRef<HTMLDivElement, RvnChatMessageRoleRailProps>(
  ({ role, className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-message-role-rail"
      data-role={role}
      className={cn('rvn-chat__message-role-rail', className)}
      {...props}
    />
  ),
)

RvnChatMessageRoleRail.displayName = 'RvnChatMessage.RoleRail'
