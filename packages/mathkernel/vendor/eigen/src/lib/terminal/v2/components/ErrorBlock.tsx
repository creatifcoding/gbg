/**
 * ErrorBlock Component
 *
 * Renders an error message block.
 */

import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ErrorBlock as ErrorBlockType } from '../schemas'

export interface ErrorBlockProps {
  /**
   * The error block data
   */
  block: ErrorBlockType

  /**
   * Optional click handler for the block
   */
  onClick?: () => void

  /**
   * Optional class name
   */
  className?: string
}

/**
 * Format timestamp
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/**
 * ErrorBlock - renders an error message
 */
export const ErrorBlock = memo(function ErrorBlock({
  block,
  onClick,
  className,
}: ErrorBlockProps) {
  const timestamp = useMemo(
    () => formatTimestamp(block.timestamp),
    [block.timestamp]
  )

  return (
    <div
      className={cn(
        'group relative rounded-lg border transition-colors',
        'bg-red-500/5 border-red-500/30 hover:border-red-500/50',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        {/* Error icon */}
        <svg
          className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>

        {/* Message */}
        <span
          className="text-red-400 flex-1"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          {block.message}
        </span>

        {/* Timestamp */}
        <span
          className="font-mono text-red-400/60 shrink-0"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {timestamp}
        </span>
      </div>
    </div>
  )
})

export default ErrorBlock
