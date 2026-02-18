/**
 * Thread Tail Controls — TMNL-styled LIVE/PAUSED + jump-to-latest.
 *
 * Reads from ChatThreadBand's tail context (useChatThreadTail).
 * Only rendered when spec.scrollBehavior !== 'manual'.
 *
 * @module morphchat/components/thread-tail-controls
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useChatThreadTail } from '@/lib/chat/shell'
import { useMorphChatContext } from './surface-context'

export function ThreadTailControls() {
  const { spec } = useMorphChatContext()
  const tail = useChatThreadTail()

  // Don't render if manual scroll or no tail context
  if (spec.scrollBehavior === 'manual' || !tail) return null

  // In tail mode with nothing unread — hide entirely (no noise)
  if (tail.tailMode === 'tail' && tail.unreadCount === 0) return null

  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-1',
        'border-t border-neutral-800/30',
        'bg-neutral-950/80 backdrop-blur-sm',
      )}
    >
      {/* Mode indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            tail.tailMode === 'tail'
              ? 'bg-emerald-500'
              : 'bg-amber-500',
          )}
        />
        <span
          className={cn(
            'font-mono uppercase tracking-wider',
            tail.tailMode === 'tail' ? 'text-emerald-500' : 'text-amber-500',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {tail.tailMode === 'tail' ? 'LIVE' : 'PAUSED'}
        </span>
      </div>

      {/* Unread count + jump button */}
      {tail.tailMode === 'inspect' && tail.unreadCount > 0 && (
        <button
          onClick={tail.jumpToLatest}
          className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded',
            'font-mono text-cyan-400',
            'border border-cyan-800/50 bg-cyan-500/5',
            'hover:bg-cyan-500/10 hover:border-cyan-700',
            'transition-colors',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          title="Jump to latest"
        >
          <span>↓</span>
          <span>{tail.unreadCount} new</span>
        </button>
      )}

      {/* Resume button when paused but no unread */}
      {tail.tailMode === 'inspect' && tail.unreadCount === 0 && (
        <button
          onClick={tail.jumpToLatest}
          className={cn(
            'font-mono text-neutral-500',
            'hover:text-neutral-300 transition-colors',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          title="Resume auto-scroll"
        >
          ▶ Resume
        </button>
      )}
    </div>
  )
}

ThreadTailControls.displayName = 'MorphChat.ThreadTailControls'
