import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface ChatTelemetryPillProps extends ComponentPropsWithoutRef<'span'> {
  icon?: string
}

export const ChatTelemetryPill = forwardRef<HTMLSpanElement, ChatTelemetryPillProps>(
  ({ icon = '◇', className, children, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="tmnl-chat-telemetry-pill"
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded',
        'font-mono text-neutral-500 border border-neutral-800',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </span>
  ),
)

ChatTelemetryPill.displayName = 'ChatTelemetryPill'
