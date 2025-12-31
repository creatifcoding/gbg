/**
 * InteractiveBlock Component
 *
 * Renders an interactive terminal session block (vim, htop, etc.)
 * Contains an embedded xterm.js terminal for full PTY interaction.
 */

import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { InteractiveBlock as InteractiveBlockType } from '../schemas'

export interface InteractiveBlockProps {
  /**
   * The interactive block data
   */
  block: InteractiveBlockType

  /**
   * Optional click handler for the block
   */
  onClick?: () => void

  /**
   * Called when dismiss is requested
   */
  onDismiss?: () => void

  /**
   * Optional class name
   */
  className?: string
}

/**
 * Format duration in human-readable form
 */
function formatDuration(startTime: Date, endTime: Date | null): string {
  if (!endTime) return 'running...'
  const ms = endTime.getTime() - startTime.getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}

/**
 * InteractiveBlock - renders an interactive terminal session
 */
export const InteractiveBlock = memo(function InteractiveBlock({
  block,
  onClick,
  onDismiss,
  className,
}: InteractiveBlockProps) {
  const duration = useMemo(
    () => formatDuration(block.startTime, block.endTime),
    [block.startTime, block.endTime]
  )

  // If dismissed, show collapsed view
  if (block.dismissed) {
    return (
      <div
        className={cn(
          'group relative rounded-lg border transition-colors',
          'bg-surface-0 border-surface-2 opacity-60',
          onClick && 'cursor-pointer hover:opacity-80',
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-muted-foreground"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {block.command}
            </span>
            <span
              className="rounded px-1.5 py-0.5 bg-surface-2 text-muted-foreground font-mono"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              dismissed
            </span>
          </div>
          <span
            className="font-mono text-muted-foreground"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {duration}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative rounded-lg border transition-colors overflow-hidden',
        'bg-surface-1 border-surface-3 hover:border-surface-4',
        block.isRunning && 'border-amber-500/30',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-2 bg-surface-0">
        <div className="flex items-center gap-2">
          {/* Running indicator */}
          {block.isRunning && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
          )}

          {/* Command */}
          <code
            className="font-mono text-foreground"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {block.command}
          </code>

          {/* Interactive badge */}
          <span
            className={cn(
              'rounded px-1.5 py-0.5 font-mono',
              block.isRunning
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-surface-2 text-muted-foreground'
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            interactive
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {block.isRunning && onDismiss && (
            <button
              className={cn(
                'rounded px-2 py-1 font-mono transition-colors',
                'bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-foreground'
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              onClick={(e) => {
                e.stopPropagation()
                onDismiss()
              }}
            >
              Dismiss
            </button>
          )}

          <span
            className="font-mono text-muted-foreground"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {duration}
          </span>
        </div>
      </div>

      {/* Terminal area (placeholder - will be replaced with xterm) */}
      <div
        className="bg-black min-h-[200px] max-h-[400px] flex items-center justify-center"
        onClick={onClick}
      >
        {block.isRunning ? (
          <div className="text-muted-foreground font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            <span className="animate-pulse">Interactive session active...</span>
            <p className="mt-2 text-xs opacity-60">Click to focus</p>
          </div>
        ) : (
          <div className="text-muted-foreground font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Session ended
            {block.exitCode !== null && (
              <span className={cn('ml-2', block.exitCode === 0 ? 'text-emerald-500' : 'text-red-500')}>
                (exit {block.exitCode})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-surface-2 bg-surface-0">
        <span
          className="font-mono text-muted-foreground"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {block.cwd.replace(/^\/home\/[^/]+/, '~')}
        </span>

        {!block.isRunning && block.exitCode !== null && (
          <span
            className={cn('font-mono', block.exitCode === 0 ? 'text-emerald-500' : 'text-red-500')}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            exit {block.exitCode}
          </span>
        )}
      </div>
    </div>
  )
})

export default InteractiveBlock
