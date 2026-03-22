import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Bot } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import {
  RVN_CHAT_ICON_STROKE_WIDTH,
  RVN_CHAT_UTILITY_ICON_SIZE,
  normalizeRvnChatRole,
  type RvnChatRawRole,
} from '../iconography'

export interface RvnChatMessageHeaderStreamingBadgeProps extends ComponentPropsWithoutRef<'span'> {
  streaming?: boolean
  role?: RvnChatRawRole
  label?: string
}

export const RvnChatMessageHeaderStreamingBadge = forwardRef<
  HTMLSpanElement,
  RvnChatMessageHeaderStreamingBadgeProps
>(({ streaming = false, role = 'agent', label, className, ...props }, ref) => {
  const prefersReducedMotion = useReducedMotion()
  const semanticRole = normalizeRvnChatRole(role)
  const animateIcon = semanticRole === 'agent' && streaming && !prefersReducedMotion

  return (
    <span
      ref={ref}
      data-slot="rvn-chat-message-header-streaming-badge"
      data-streaming={streaming || undefined}
      data-role={semanticRole}
      className={cn('rvn-chat__message-streaming-badge', className)}
      {...props}
    >
      <motion.span
        className="rvn-chat__message-streaming-badge-icon"
        animate={animateIcon ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
        transition={animateIcon ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
      >
        <Bot
          size={RVN_CHAT_UTILITY_ICON_SIZE}
          strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
          aria-hidden="true"
        />
      </motion.span>
      <span className="rvn-chat__message-streaming-badge-label">
        {label ?? (streaming ? 'streaming' : 'idle')}
      </span>
    </span>
  )
})

RvnChatMessageHeaderStreamingBadge.displayName = 'RvnChatMessage.HeaderCluster.StreamingBadge'
