import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import {
  RVN_CHAT_ICON_STROKE_WIDTH,
  RVN_CHAT_ROLE_ICON_SIZE,
  getRvnChatRoleIcon,
  normalizeRvnChatRole,
  type RvnChatRawRole,
} from '../iconography'

export interface RvnChatMessageRoleIconRailProps extends ComponentPropsWithoutRef<'div'> {
  role: RvnChatRawRole
  streaming?: boolean
  showLabel?: boolean
}

export const RvnChatMessageRoleIconRail = forwardRef<
  HTMLDivElement,
  RvnChatMessageRoleIconRailProps
>(({ role, streaming = false, showLabel = false, className, ...props }, ref) => {
  const prefersReducedMotion = useReducedMotion()
  const semanticRole = normalizeRvnChatRole(role)
  const Icon = getRvnChatRoleIcon(role)
  const animateIcon = semanticRole === 'agent' && streaming && !prefersReducedMotion

  return (
    <div
      ref={ref}
      data-slot="rvn-chat-message-role-icon-rail"
      data-role={semanticRole}
      data-streaming={streaming || undefined}
      className={cn('rvn-chat__message-role-icon-rail', className)}
      {...props}
    >
      <motion.span
        className="rvn-chat__message-role-icon-rail-icon"
        animate={animateIcon ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
        transition={animateIcon ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
      >
        <Icon
          size={RVN_CHAT_ROLE_ICON_SIZE}
          strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
          aria-hidden="true"
        />
      </motion.span>

      {showLabel ? (
        <span className="rvn-chat__message-role-icon-rail-label">{semanticRole}</span>
      ) : null}
    </div>
  )
})

RvnChatMessageRoleIconRail.displayName = 'RvnChatMessage.SeverityRails.RoleIconRail'
