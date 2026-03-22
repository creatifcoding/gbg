import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export type RvnStatusChipState =
  | 'online'
  | 'offline'
  | 'connecting'
  | 'reconnecting'
  | 'resyncing'
  | 'idle'
  | 'error'

export interface RvnStatusChipProps extends ComponentPropsWithoutRef<'span'> {
  state: RvnStatusChipState
  label?: string
  tone?: string
  pulse?: boolean
  showDot?: boolean
}

const PULSE_STATES: ReadonlySet<RvnStatusChipState> = new Set([
  'connecting',
  'reconnecting',
  'resyncing',
])

export const RvnStatusChip = forwardRef<HTMLSpanElement, RvnStatusChipProps>(
  (
    {
      state,
      label,
      tone,
      pulse,
      showDot = false,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion()
    const shouldPulse = pulse ?? PULSE_STATES.has(state)

    return (
      <span
        ref={ref}
        data-slot="rvn-chat-status-chip"
        data-state={state}
        role="status"
        className={cn('rvn-chat__status-chip', `rvn-chat__status-chip--${state}`, className)}
        style={{
          '--cchat-chip-color': tone,
          ...style,
        } as CSSProperties}
        {...props}
      >
        {showDot ? (
          <motion.span
            aria-hidden="true"
            data-slot="rvn-chat-status-chip-dot"
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              marginRight: 6,
              border: '1px solid currentColor',
              background: 'currentColor',
            }}
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
        ) : null}
        {children ?? label ?? state}
      </span>
    )
  },
)

RvnStatusChip.displayName = 'RvnStatusChip'
