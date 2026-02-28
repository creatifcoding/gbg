/**
 * ActionSegment — Retry button (error only).
 *
 * Reveals rightward via max-width when segments >= 3.
 * Contains the divider + retry button.
 *
 * @module connection-capsule/action-segment
 */

import { memo } from 'react'
import { REVEAL_MS, REVEAL_EASE } from './constants'

interface ActionSegmentProps {
  show: boolean
  dividerColor: string
  onRetry: () => void
}

export const ActionSegment = memo(function ActionSegment({
  show, dividerColor, onRetry,
}: ActionSegmentProps) {
  return (
    <div
      className="flex items-center overflow-hidden"
      style={{
        maxWidth: show ? 80 : 0,
        opacity: show ? 1 : 0,
        transition: [
          `max-width ${REVEAL_MS}ms ${REVEAL_EASE}`,
          `opacity ${REVEAL_MS}ms ${REVEAL_EASE}`,
        ].join(', '),
      }}
    >
      {/* Divider */}
      <div
        className="w-px self-stretch my-1 shrink-0"
        style={{
          background: dividerColor,
          opacity: show ? 1 : 0,
          transition: `opacity ${REVEAL_MS}ms ${REVEAL_EASE}`,
        }}
      />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRetry() }}
        className="px-2 py-0.5 font-mono text-cyan-400 hover:text-cyan-300 transition-colors duration-150 active:scale-[0.97] whitespace-nowrap"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Retry
      </button>
    </div>
  )
})
