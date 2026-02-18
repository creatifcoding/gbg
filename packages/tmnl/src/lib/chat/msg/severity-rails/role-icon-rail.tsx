import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import {
  CHAT_ICON_STROKE_WIDTH,
  CHAT_ROLE_ICON_SIZE,
  getChatRoleIcon,
  normalizeChatRole,
  type ChatRawRole,
} from '../iconography'

export interface ChatMessageRoleIconRailProps extends ComponentPropsWithoutRef<'div'> {
  role: ChatRawRole
  streaming?: boolean
  showLabel?: boolean
}

const ROLE_ICON_COLORS: Record<string, string> = {
  operator: 'text-cyan-400',
  agent: 'text-emerald-400',
  system: 'text-amber-400',
  tool: 'text-violet-400',
}

export const ChatMessageRoleIconRail = forwardRef<HTMLDivElement, ChatMessageRoleIconRailProps>(
  ({ role, streaming = false, showLabel = false, className, ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion()
    const semanticRole = normalizeChatRole(role)
    const Icon = getChatRoleIcon(role)
    const animateIcon = semanticRole === 'agent' && streaming && !prefersReducedMotion

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-message-role-icon-rail"
        data-role={semanticRole}
        data-streaming={streaming || undefined}
        className={cn(
          'flex flex-col items-center gap-1 pt-0.5',
          ROLE_ICON_COLORS[semanticRole] ?? 'text-neutral-500',
          className,
        )}
        {...props}
      >
        <motion.span
          className="inline-flex"
          animate={animateIcon ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
          transition={
            animateIcon
              ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0 }
          }
        >
          <Icon
            size={CHAT_ROLE_ICON_SIZE}
            strokeWidth={CHAT_ICON_STROKE_WIDTH}
            aria-hidden="true"
          />
        </motion.span>

        {showLabel && (
          <span
            className="font-mono uppercase tracking-wider text-neutral-600"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {semanticRole}
          </span>
        )}
      </div>
    )
  },
)

ChatMessageRoleIconRail.displayName = 'ChatMessage.SeverityRails.RoleIconRail'
