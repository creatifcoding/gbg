import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export type ChatStatusChipState =
  | 'online'
  | 'offline'
  | 'connecting'
  | 'reconnecting'
  | 'resyncing'
  | 'idle'
  | 'error'

export interface ChatStatusChipProps extends ComponentPropsWithoutRef<'span'> {
  state: ChatStatusChipState
  label?: string
  pulse?: boolean
  showDot?: boolean
}

const PULSE_STATES: ReadonlySet<ChatStatusChipState> = new Set([
  'connecting',
  'reconnecting',
  'resyncing',
])

const STATE_COLOR: Record<ChatStatusChipState, string> = {
  online: 'text-emerald-400 border-emerald-500/30',
  offline: 'text-red-400 border-red-500/30',
  connecting: 'text-amber-400 border-amber-500/30',
  reconnecting: 'text-amber-400 border-amber-500/30',
  resyncing: 'text-cyan-400 border-cyan-500/30',
  idle: 'text-neutral-500 border-neutral-700',
  error: 'text-red-400 border-red-500/30',
}

const DOT_COLOR: Record<ChatStatusChipState, string> = {
  online: 'bg-emerald-400',
  offline: 'bg-red-400',
  connecting: 'bg-amber-400',
  reconnecting: 'bg-amber-400',
  resyncing: 'bg-cyan-400',
  idle: 'bg-neutral-600',
  error: 'bg-red-400',
}

export const ChatStatusChip = forwardRef<HTMLSpanElement, ChatStatusChipProps>(
  ({ state, label, pulse, showDot = false, className, children, ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion()
    const shouldPulse = pulse ?? PULSE_STATES.has(state)

    return (
      <span
        ref={ref}
        data-slot="tmnl-chat-status-chip"
        data-state={state}
        role="status"
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md',
          'font-mono uppercase tracking-wider border',
          STATE_COLOR[state],
          className,
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        {...props}
      >
        {showDot && (
          <motion.span
            aria-hidden="true"
            className={cn('w-1.5 h-1.5 rounded-full', DOT_COLOR[state])}
            animate={
              shouldPulse && !prefersReducedMotion
                ? { opacity: [1, 0.4, 1] }
                : { opacity: 1 }
            }
            transition={
              shouldPulse && !prefersReducedMotion
                ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0 }
            }
          />
        )}
        {children ?? label ?? state}
      </span>
    )
  },
)

ChatStatusChip.displayName = 'ChatStatusChip'
