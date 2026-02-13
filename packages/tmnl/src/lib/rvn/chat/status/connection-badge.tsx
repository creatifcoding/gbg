import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
} from 'react'
import { RefreshCw, Wifi } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export type RvnChatConnectionState =
  | 'offline'
  | 'connecting'
  | 'online'
  | 'reconnecting'
  | 'resyncing'

export interface RvnChatConnectionBadgeProps extends ComponentPropsWithoutRef<'span'> {
  state: RvnChatConnectionState
  latencyMs?: number | null
  tone?: string
  onProbe?: () => void | Promise<void>
  probeLabel?: string
  onExpandedChange?: (expanded: boolean) => void
}

const PULSE_STATES: ReadonlySet<RvnChatConnectionState> = new Set([
  'connecting',
  'reconnecting',
  'resyncing',
])

const STATE_LABELS: Record<RvnChatConnectionState, string> = {
  offline: 'offline',
  connecting: 'connecting',
  online: 'online',
  reconnecting: 'reconnecting',
  resyncing: 'resyncing',
}

const STATE_TONES: Record<RvnChatConnectionState, string> = {
  online: '#065f46',
  offline: '#7f1d1d',
  connecting: '#78350f',
  reconnecting: '#78350f',
  resyncing: '#1e3a8a',
}

export const RvnChatConnectionBadge = forwardRef<HTMLSpanElement, RvnChatConnectionBadgeProps>(
  (
    {
      state,
      latencyMs = null,
      tone,
      onProbe,
      probeLabel = 'Probe',
      onExpandedChange,
      className,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion()
    const shouldPulse = PULSE_STATES.has(state)
    const [expanded, setExpanded] = useState(false)

    const hasExpandedDetail = latencyMs !== null || Boolean(onProbe)

    useEffect(() => {
      onExpandedChange?.(expanded)
    }, [expanded, onExpandedChange])

    const computedTone = tone ?? STATE_TONES[state]
    const stateLabel = STATE_LABELS[state]

    const detailLabel = useMemo(() => {
      if (latencyMs === null) return null
      return `${latencyMs}ms`
    }, [latencyMs])

    const handleMouseEnter = (_event: MouseEvent<HTMLSpanElement>) => {
      if (!hasExpandedDetail) return
      setExpanded(true)
    }

    const handleMouseLeave = (_event: MouseEvent<HTMLSpanElement>) => {
      setExpanded(false)
    }

    const handleBlurCapture = (event: FocusEvent<HTMLSpanElement>) => {
      const nextTarget = event.relatedTarget
      if (nextTarget && event.currentTarget.contains(nextTarget as Node)) return
      setExpanded(false)
    }

    return (
      <motion.span
        ref={ref}
        layout
        data-slot="rvn-chat-connection-badge"
        data-state={state}
        className={cn('rvn-chat__status-chip', 'rvn-chat__connection-badge', className)}
        style={{ '--cchat-chip-color': computedTone } as CSSProperties}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocusCapture={() => hasExpandedDetail && setExpanded(true)}
        onBlurCapture={handleBlurCapture}
        transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: 'easeOut' }}
        {...props}
      >
        <motion.span
          aria-hidden="true"
          data-slot="rvn-chat-connection-badge-dot"
          className="rvn-chat__connection-badge-dot"
          animate={
            shouldPulse && !prefersReducedMotion
              ? { opacity: [1, 0.3, 1] }
              : { opacity: 1 }
          }
          transition={
            shouldPulse && !prefersReducedMotion
              ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0 }
          }
        >
          <Wifi size={10} strokeWidth={2} aria-hidden="true" />
        </motion.span>

        <span className="rvn-chat__connection-badge-label">{stateLabel}</span>

        <AnimatePresence initial={false}>
          {expanded && hasExpandedDetail ? (
            <motion.span
              key="connection-details"
              layout
              initial={prefersReducedMotion ? undefined : { opacity: 0, x: -4 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: -4 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.14, ease: 'easeOut' }}
              className="rvn-chat__connection-badge-details"
            >
              {detailLabel ? (
                <span className="rvn-chat__connection-badge-latency">{detailLabel}</span>
              ) : null}

              {onProbe ? (
                <button
                  type="button"
                  className="rvn-chat__connection-badge-probe"
                  onClick={() => {
                    void onProbe()
                  }}
                  aria-label={probeLabel}
                >
                  <RefreshCw size={10} strokeWidth={2} aria-hidden="true" />
                  <span>{probeLabel}</span>
                </button>
              ) : null}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.span>
    )
  },
)

RvnChatConnectionBadge.displayName = 'RvnChatConnectionBadge'
