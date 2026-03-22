import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import {
  CHAT_ICON_STROKE_WIDTH,
  CHAT_ROLE_ICON_SIZE,
  getChatRoleIcon,
  normalizeChatRole,
  type ChatRawRole,
} from '../iconography'

export interface ChatMessageHeaderRoleBadgeProps extends ComponentPropsWithoutRef<'span'> {
  role: ChatRawRole
  label?: string
}

const ROLE_BADGE_COLORS: Record<string, string> = {
  operator: 'text-cyan-400',
  agent: 'text-emerald-400',
  system: 'text-amber-400',
  tool: 'text-violet-400',
}

export const ChatMessageHeaderRoleBadge = forwardRef<
  HTMLSpanElement,
  ChatMessageHeaderRoleBadgeProps
>(({ role, label, className, ...props }, ref) => {
  const semanticRole = normalizeChatRole(role)
  const Icon = getChatRoleIcon(role)

  return (
    <span
      ref={ref}
      data-slot="tmnl-chat-message-header-role-badge"
      data-role={semanticRole}
      className={cn(
        'inline-flex items-center gap-1.5 font-mono',
        ROLE_BADGE_COLORS[semanticRole] ?? 'text-neutral-400',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    >
      <Icon
        size={CHAT_ROLE_ICON_SIZE}
        strokeWidth={CHAT_ICON_STROKE_WIDTH}
        aria-hidden="true"
      />
      <span className="uppercase tracking-wider">{label ?? semanticRole}</span>
    </span>
  )
})

ChatMessageHeaderRoleBadge.displayName = 'ChatMessage.HeaderCluster.RoleBadge'
