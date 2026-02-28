/**
 * TextSegment — Phase label (connecting/reconnecting/error).
 *
 * Reveals rightward via max-width when segments >= 2.
 * Contains the divider + text label.
 *
 * @module connection-capsule/text-segment
 */

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { REVEAL_MS, REVEAL_EASE } from './constants'

interface TextSegmentProps {
  show: boolean
  dividerColor: string
  textColor: string
  labelText: string
}

export const TextSegment = memo(function TextSegment({
  show, dividerColor, textColor, labelText,
}: TextSegmentProps) {
  return (
    <div
      className="flex items-center overflow-hidden"
      style={{
        maxWidth: show ? 200 : 0,
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
      <span
        className={cn('px-2 py-0.5 font-mono whitespace-nowrap', textColor)}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {labelText}
      </span>
    </div>
  )
})
