/**
 * CommandBlock Component
 *
 * Renders a shell command execution block with prompt, command, and output.
 * Follows TMNL design tokens and typography discipline.
 */

import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { CommandBlock as CommandBlockType } from '../schemas'

export interface CommandBlockProps {
  /**
   * The command block data
   */
  block: CommandBlockType

  /**
   * Optional click handler for the block
   */
  onClick?: () => void

  /**
   * Optional class name
   */
  className?: string

  /**
   * Whether to show timestamps
   */
  showTimestamp?: boolean

  /**
   * Whether to show CWD
   */
  showCwd?: boolean
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
 * Get exit code color
 */
function getExitCodeColor(exitCode: number | null): string {
  if (exitCode === null) return 'text-yellow-500'
  if (exitCode === 0) return 'text-emerald-500'
  return 'text-red-500'
}

/**
 * CommandBlock - renders a shell command execution
 */
export const CommandBlock = memo(function CommandBlock({
  block,
  onClick,
  className,
  showTimestamp = true,
  showCwd = true,
}: CommandBlockProps) {
  const duration = useMemo(
    () => formatDuration(block.startTime, block.endTime),
    [block.startTime, block.endTime]
  )

  const timestamp = useMemo(
    () => formatTimestamp(block.startTime),
    [block.startTime]
  )

  return (
    <div
      className={cn(
        'group relative rounded-lg border transition-colors',
        'bg-surface-1 border-surface-3 hover:border-surface-4',
        block.isRunning && 'border-cyan-500/30',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {/* Header: Prompt + Command */}
      <div className="flex items-start gap-2 px-3 py-2 border-b border-surface-2">
        {/* Prompt indicator */}
        <span
          className={cn(
            'font-mono shrink-0',
            block.isRunning ? 'text-cyan-400' : 'text-emerald-500'
          )}
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          $
        </span>

        {/* Command */}
        <code
          className="font-mono text-foreground break-all flex-1"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          {block.command}
        </code>

        {/* Metadata */}
        <div className="flex items-center gap-2 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          {showCwd && (
            <span
              className="font-mono text-muted-foreground"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              title={`Working directory: ${block.cwd}`}
            >
              {block.cwd.replace(/^\/home\/[^/]+/, '~')}
            </span>
          )}

          {showTimestamp && (
            <span
              className="font-mono text-muted-foreground"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {timestamp}
            </span>
          )}
        </div>
      </div>

      {/* Output */}
      {block.output && (
        <pre
          className={cn(
            'px-3 py-2 font-mono text-foreground/90 whitespace-pre-wrap overflow-x-auto',
            'max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-surface-4'
          )}
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          {block.output}
        </pre>
      )}

      {/* Footer: Status + Duration */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-surface-2 bg-surface-0">
        {/* Exit code / Running indicator */}
        <div className="flex items-center gap-2">
          {block.isRunning ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
              <span
                className="font-mono text-cyan-400"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                running
              </span>
            </>
          ) : (
            <span
              className={cn('font-mono', getExitCodeColor(block.exitCode))}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              exit {block.exitCode ?? '?'}
            </span>
          )}
        </div>

        {/* Duration */}
        <span
          className="font-mono text-muted-foreground"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {duration}
        </span>
      </div>
    </div>
  )
})

export default CommandBlock
