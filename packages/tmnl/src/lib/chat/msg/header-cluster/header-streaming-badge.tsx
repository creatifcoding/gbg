import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Bot } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import {
  CHAT_ICON_STROKE_WIDTH,
  CHAT_UTILITY_ICON_SIZE,
  normalizeChatRole,
  type ChatRawRole,
} from '../iconography'

export interface ChatMessageHeaderStreamingBadgeProps extends ComponentPropsWithoutRef<'span'> {
  streaming?: boolean
  role?: ChatRawRole
  label?: string
}

export const ChatMessageHeaderStreamingBadge = forwardRef<
  HTMLSpanElement,
  ChatMessageHeaderStreamingBadgeProps
>(({ streaming = false, role = 'agent', label, className, ...props }, ref) => {
  const prefersReducedMotion = useReducedMotion()
  const semanticRole = normalizeChatRole(role)
  const animateIcon = semanticRole === 'agent' && streaming && !prefersReducedMotion

  return (
    <span
      ref={ref}
      data-slot="tmnl-chat-message-header-streaming-badge"
      data-streaming={streaming || undefined}
      data-role={semanticRole}
      className={cn(
        'inline-flex items-center gap-1 font-mono',
        streaming ? 'text-cyan-400' : 'text-neutral-600',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
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
        <Bot
          size={CHAT_UTILITY_ICON_SIZE}
          strokeWidth={CHAT_ICON_STROKE_WIDTH}
          aria-hidden="true"
        />
      </motion.span>
      <span className="uppercase tracking-wider">
        {label ?? (streaming ? 'streaming' : 'idle')}
      </span>
    </span>
  )
})

ChatMessageHeaderStreamingBadge.displayName = 'ChatMessage.HeaderCluster.StreamingBadge'
