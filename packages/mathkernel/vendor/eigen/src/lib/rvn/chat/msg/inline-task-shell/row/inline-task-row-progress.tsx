/**
 * InlineTaskRowProgress — standalone progress bar compound.
 *
 * Renders a track + fill + optional percentage label. Animated stripe
 * pattern for running/queued status. CSS: `.rvn-chat__inline-task-row-progress-standalone`.
 */
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import type { RvnChatInlineTaskStatus } from '../../inline-task-types'
import { cn } from '@/lib/utils'

export interface InlineTaskRowProgressProps extends ComponentPropsWithoutRef<'div'> {
  /** 0–100 */
  progress: number
  status: RvnChatInlineTaskStatus
  /** Show stripe animation for running status. Default true. */
  animated?: boolean
  /** Show percentage label. Default true. */
  showPercent?: boolean
}

export const InlineTaskRowProgress = forwardRef<HTMLDivElement, InlineTaskRowProgressProps>(
  ({ progress, status, animated = true, showPercent = true, className, ...props }, ref) => {
    const clamped = Math.max(0, Math.min(100, progress))
    const isAnimating = animated && (status === 'running' || status === 'queued')

    return (
      <div
        ref={ref}
        className={cn('rvn-chat__inline-task-row-progress-standalone', className)}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Task progress ${Math.round(clamped)}%`}
        {...props}
      >
        <div className="rvn-chat__inline-task-row-progress-track">
          <div
            className="rvn-chat__inline-task-row-progress-fill"
            data-status={status}
            data-animating={isAnimating || undefined}
            style={{ width: `${clamped}%` }}
          />
        </div>
        {showPercent ? (
          <span className="rvn-chat__inline-task-row-progress-percent">
            {Math.round(clamped)}%
          </span>
        ) : null}
      </div>
    )
  },
)

InlineTaskRowProgress.displayName = 'InlineTaskShell.RowProgress'
