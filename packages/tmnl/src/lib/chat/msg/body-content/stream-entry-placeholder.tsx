/**
 * StreamEntryPlaceholder — Bridges the gap between Send and first token.
 *
 * Phases (driven by StreamingMetrics):
 * - **waiting**: Skeleton lines — model hasn't responded yet
 * - **thinking**: Orbital dots + "Thinking…" — model is reasoning
 * - **streaming with 0 tokens**: Same as thinking (delta not yet flushed)
 *
 * Disappears once text parts start rendering (tokensReceived > 0 and
 * parts array has content). AnimatePresence mode="wait" transitions
 * between phases smoothly.
 *
 * PURPOSE: Eliminates the 200ms-3s dead zone between pressing Send and
 * seeing the first token. The user always sees immediate visual feedback.
 *
 * @module chat/msg/body-content/stream-entry-placeholder
 */

import { memo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useStreamingMetrics } from '@/lib/morphchat/components/streaming-metrics-provider'

// =============================================================================
// Transition config (Emil Kowalski: ease-out, ≤300ms, transform+opacity only)
// =============================================================================

const TRANSITION = {
  duration: 0.2,
  ease: [0.32, 0.72, 0, 1] as const,
}

// =============================================================================
// Phase sub-components
// =============================================================================

function SkeletonLines() {
  return (
    <motion.div
      key="skeleton"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={TRANSITION}
      className="flex flex-col gap-2 py-2"
    >
      <div className="h-3 bg-neutral-800/40 rounded w-3/4 animate-pulse" />
      <div className="h-3 bg-neutral-800/30 rounded w-1/2 animate-pulse" style={{ animationDelay: '150ms' }} />
      <div className="h-3 bg-neutral-800/20 rounded w-2/3 animate-pulse" style={{ animationDelay: '300ms' }} />
    </motion.div>
  )
}

function ThinkingDots() {
  return (
    <motion.div
      key="thinking"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={TRANSITION}
      className="flex items-center gap-2 py-2"
    >
      <span className="inline-flex items-center gap-[3px]">
        <span className="tmnl-cursor-dot" style={{ animationDelay: '0ms' }} />
        <span className="tmnl-cursor-dot" style={{ animationDelay: '200ms' }} />
        <span className="tmnl-cursor-dot" style={{ animationDelay: '400ms' }} />
      </span>
      <span
        className="font-mono text-cyan-400/60"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Preparing response…
      </span>
    </motion.div>
  )
}

// =============================================================================
// Main component
// =============================================================================

/**
 * Render only during active streaming when no text content has arrived yet.
 * Parent should gate rendering on `isStreaming && hasNoTextContent`.
 */
export const StreamEntryPlaceholder = memo(function StreamEntryPlaceholder({
  className,
}: {
  className?: string
}) {
  const { phase, tokensReceived } = useStreamingMetrics()
  const prefersReducedMotion = useReducedMotion()

  // Determine placeholder phase
  const isWaiting = phase === 'waiting'
  const isThinking = phase === 'receiving' && tokensReceived === 0

  // Don't render if we have tokens (text parts are rendering)
  if (!isWaiting && !isThinking) return null

  // Reduced motion: show static indicator
  if (prefersReducedMotion) {
    return (
      <div className={cn('py-2', className)}>
        <span
          className="font-mono text-cyan-400/60"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {isWaiting ? 'Waiting for response…' : 'Preparing response…'}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('min-h-[40px]', className)}>
      <AnimatePresence mode="wait">
        {isWaiting ? <SkeletonLines /> : <ThinkingDots />}
      </AnimatePresence>
    </div>
  )
})

StreamEntryPlaceholder.displayName = 'ChatMessage.BodyContent.StreamEntryPlaceholder'
