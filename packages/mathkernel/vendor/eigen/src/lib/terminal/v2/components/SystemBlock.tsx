/**
 * SystemBlock Component
 *
 * Renders a system notification block.
 */

import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { SystemBlock as SystemBlockType } from '../schemas'

export interface SystemBlockProps {
  /**
   * The system block data
   */
  block: SystemBlockType

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
 * SystemBlock - renders a system notification
 */
export const SystemBlock = memo(function SystemBlock({
  block,
  onClick,
  className,
}: SystemBlockProps) {
  const timestamp = useMemo(
    () => formatTimestamp(block.timestamp),
    [block.timestamp]
  )

  return (
    <div
      className={cn(
        'group relative rounded-lg border transition-colors',
        'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        {/* System icon */}
        <svg
          className="w-4 h-4 text-blue-400 shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>

        {/* Message */}
        <span
          className="text-blue-300 flex-1"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          {block.message}
        </span>

        {/* Timestamp */}
        <span
          className="font-mono text-blue-400/60 shrink-0"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {timestamp}
        </span>
      </div>
    </div>
  )
})

export default SystemBlock
