/**
 * InlineTaskRowActionBtn — generic variant button for row toolbars.
 *
 * All action buttons share the same base shape with variant appearance
 * (default/danger) and an action callback. CSS: `.rvn-chat__inline-task-row-action-btn`.
 */
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface InlineTaskRowActionBtnProps extends ComponentPropsWithoutRef<'button'> {
  icon?: ReactNode
  label: string
  variant?: 'default' | 'danger'
}

export const InlineTaskRowActionBtn = forwardRef<HTMLButtonElement, InlineTaskRowActionBtnProps>(
  ({ icon, label, variant = 'default', className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'rvn-chat__inline-task-row-action-btn',
        variant === 'danger' && 'rvn-chat__inline-task-row-action-btn--danger',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="rvn-chat__inline-task-row-action-btn-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
    </button>
  ),
)

InlineTaskRowActionBtn.displayName = 'InlineTaskShell.RowActionBtn'
