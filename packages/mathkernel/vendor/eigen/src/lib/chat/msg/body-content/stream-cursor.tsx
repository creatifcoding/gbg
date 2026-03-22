/**
 * ChatMessageStreamCursor — Velocity-adaptive streaming cursor.
 *
 * Three visual modes driven by `useStreamingMetrics().velocity`:
 *
 * - **fast** (≥20 tok/s): Block cursor `▌` with brisk 300ms step-end blink.
 *   Signals high bandwidth — the model is producing rapidly.
 *
 * - **normal** (5–19 tok/s): Block cursor `▌` with breathing 900ms pulse.
 *   Default rhythm — comfortable streaming pace.
 *
 * - **slow** (<5 tok/s or waiting): Three orbital dots with staggered delays.
 *   Signals the model is thinking or tokens are arriving slowly.
 *
 * PURPOSE (Emil Kowalski): The cursor is a bandwidth indicator, not decoration.
 * Its behavior communicates streaming velocity to the user at a glance.
 *
 * @module chat/msg/body-content/stream-cursor
 */

import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useStreamingMetrics } from '@/lib/morphchat/components/streaming-metrics-provider'
import type { CursorVelocity } from '@/lib/morphchat/atoms/streaming-metrics'

export type ChatMessageStreamCursorProps = ComponentPropsWithoutRef<'span'> & {
  /** Override velocity from context (for testbed/storybook usage) */
  velocity?: CursorVelocity
}

/**
 * Cursor class map per velocity bucket.
 * All animations are CSS-only — no JS timers, no Framer Motion.
 * Respects prefers-reduced-motion via the @keyframes media query in globals.css.
 */
const CURSOR_CLASSES: Record<CursorVelocity, string> = {
  fast: 'tmnl-cursor-fast',
  normal: 'tmnl-cursor-normal',
  slow: '', // Slow uses orbital dots, not the block cursor
}

export const ChatMessageStreamCursor = forwardRef<HTMLSpanElement, ChatMessageStreamCursorProps>(
  ({ className, velocity: velocityProp, children, ...props }, ref) => {
    const metrics = useStreamingMetrics()
    const velocity = velocityProp ?? metrics.velocity

    // Slow / waiting: render orbital dots instead of block cursor
    if (velocity === 'slow') {
      return (
        <span
          ref={ref}
          data-slot="tmnl-chat-message-stream-cursor"
          data-velocity="slow"
          className={cn('inline-flex items-center gap-[3px] ml-1 align-middle', className)}
          {...props}
        >
          <span className="tmnl-cursor-dot" style={{ animationDelay: '0ms' }} />
          <span className="tmnl-cursor-dot" style={{ animationDelay: '200ms' }} />
          <span className="tmnl-cursor-dot" style={{ animationDelay: '400ms' }} />
        </span>
      )
    }

    // Fast / normal: block cursor with velocity-specific animation
    return (
      <span
        ref={ref}
        data-slot="tmnl-chat-message-stream-cursor"
        data-velocity={velocity}
        className={cn(
          'inline-block text-cyan-400',
          CURSOR_CLASSES[velocity],
          className,
        )}
        {...props}
      >
        {children ?? '▌'}
      </span>
    )
  },
)

ChatMessageStreamCursor.displayName = 'ChatMessage.BodyContent.StreamCursor'
