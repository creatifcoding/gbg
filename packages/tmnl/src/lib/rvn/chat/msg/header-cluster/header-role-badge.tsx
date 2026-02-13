import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import {
  RVN_CHAT_ICON_STROKE_WIDTH,
  RVN_CHAT_ROLE_ICON_SIZE,
  getRvnChatRoleIcon,
  normalizeRvnChatRole,
  type RvnChatRawRole,
} from '../iconography'

export interface RvnChatMessageHeaderRoleBadgeProps extends ComponentPropsWithoutRef<'span'> {
  role: RvnChatRawRole
  label?: string
}

export const RvnChatMessageHeaderRoleBadge = forwardRef<
  HTMLSpanElement,
  RvnChatMessageHeaderRoleBadgeProps
>(({ role, label, className, ...props }, ref) => {
  const semanticRole = normalizeRvnChatRole(role)
  const Icon = getRvnChatRoleIcon(role)

  return (
    <span
      ref={ref}
      data-slot="rvn-chat-message-header-role-badge"
      data-role={semanticRole}
      className={cn('rvn-chat__message-role-badge', className)}
      {...props}
    >
      <Icon
        size={RVN_CHAT_ROLE_ICON_SIZE}
        strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
        aria-hidden="true"
      />
      <span className="rvn-chat__message-role-badge-label">{label ?? semanticRole}</span>
    </span>
  )
})

RvnChatMessageHeaderRoleBadge.displayName = 'RvnChatMessage.HeaderCluster.RoleBadge'
