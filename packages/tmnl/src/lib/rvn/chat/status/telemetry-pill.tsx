import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface RvnChatTelemetryPillProps extends ComponentPropsWithoutRef<'span'> {
  icon?: string
}

export const RvnChatTelemetryPill = forwardRef<HTMLSpanElement, RvnChatTelemetryPillProps>(
  ({ icon = '◇', className, children, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="rvn-chat-telemetry-pill"
      className={cn('rvn-chat__telemetry-pill', className)}
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </span>
  ),
)

RvnChatTelemetryPill.displayName = 'RvnChatTelemetryPill'
