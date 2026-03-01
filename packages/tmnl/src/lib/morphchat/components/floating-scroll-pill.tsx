/**
 * FloatingScrollPill — Floating auto-scroll indicator & jump-to-latest.
 *
 * EPOCH-0005: Replaces the docked ThreadTailControls bar.
 * No layout displacement — sticky bottom-3 with pointer-events passthrough.
 * AnimatePresence for smooth enter/exit.
 *
 * Shows:
 * - LIVE (green dot) when tailing and new content arrives
 * - PAUSED (amber dot) + unread count + ↓ jump when user scrolls away
 * - Hidden when tailing and no unread (no noise)
 *
 * PURPOSE: Scroll state is communicated via a floating pill, not a docked bar
 * that steals vertical space from the conversation thread.
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
    <div className="sticky bottom-3 w-full flex justify-center pointer-events-none z-10">
      <AnimatePresence>
        {show && (
          <motion.button
            key="scroll-pill"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
            transition={TRANSITION}
            onClick={tail.jumpToLatest}
            className={cn(
              'pointer-events-auto',
              'inline-flex items-center gap-2 px-4 py-1.5 rounded-full',
              'font-mono tabular-nums',
              'bg-neutral-900/90 backdrop-blur-sm',
              'border border-neutral-700/50',
              'shadow-lg shadow-black/30',
              'hover:bg-neutral-800/90 hover:border-neutral-600/50',
              'transition-colors duration-150',
              'cursor-pointer',
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
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

            {/* Unread count */}
            {tail.unreadCount > 0 && (
              <span className="text-neutral-400">
                · {tail.unreadCount} new
              </span>
            )}

            {/* Down arrow for jump affordance */}
            {tail.tailMode === 'inspect' && (
              <span className="text-cyan-400">↓</span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
})

FloatingScrollPill.displayName = 'MorphChat.FloatingScrollPill'
