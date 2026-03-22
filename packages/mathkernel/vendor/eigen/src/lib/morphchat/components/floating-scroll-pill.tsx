/**
 * FloatingScrollPill — Footer overlay for scroll state.
 *
 * EPOCH-0005: Absolute-positioned footer overlay inside the thread container,
 * mirroring the StatusBannerView header overlay pattern. No layout displacement.
 *
 * Styling matches the connection badge language:
 * - Vantablack background (inherits from surface, not gray-900)
 * - `border border-neutral-800 hover:border-neutral-600`
 * - Monospace, 10px, uppercase tracking
 *
 * Shows:
 * - LIVE (green dot) when tailing and new content arrives
 * - PAUSED (amber dot) + ↓ jump when user scrolls away
 * - Hidden when tailing and no unread (no noise)
 *
 * Position: absolute bottom-3 inset-x-0, centered via flex justify-center.
 * Pointer-events: container is none, pill is auto.
 *
 * @module morphchat/components/floating-scroll-pill
 */

import { memo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useChatThreadTail } from '@/lib/chat/shell'
import { useMorphChatContext } from './surface-context'

const TRANSITION = {
  duration: 0.2,
  ease: [0.32, 0.72, 0, 1] as const,
}

export const FloatingScrollPill = memo(function FloatingScrollPill() {
  const { spec } = useMorphChatContext()
  const tail = useChatThreadTail()
  const prefersReducedMotion = useReducedMotion()

  // Don't render if manual scroll, no tail context, or tailing with nothing unread
  if (spec.scrollBehavior === 'manual' || !tail) return null
  const show = tail.tailMode === 'inspect' || (tail.tailMode === 'tail' && tail.unreadCount > 0)

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          key="scroll-pill"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
          transition={TRANSITION}
          onClick={tail.jumpToLatest}
          className={cn(
            'pointer-events-auto',
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md cursor-pointer',
            'font-mono transition-colors duration-150',
            // Match connection badge: vantablack + neutral-800 border
            'border border-neutral-800 hover:border-neutral-600',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
          title={tail.tailMode === 'tail' ? 'Following' : 'Jump to latest'}
        >
          {/* Status dot */}
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              tail.tailMode === 'tail' ? 'bg-emerald-500' : 'bg-amber-500',
            )}
          />

          {/* Label */}
          <span className={cn(
            'uppercase tracking-wider',
            tail.tailMode === 'tail' ? 'text-emerald-400' : 'text-amber-400',
          )}>
            {tail.tailMode === 'tail' ? 'LIVE' : 'PAUSED'}
          </span>

          {/* Down arrow for jump affordance */}
          {tail.tailMode === 'inspect' && (
            <span className="text-cyan-400">↓</span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  )
})

FloatingScrollPill.displayName = 'MorphChat.FloatingScrollPill'
