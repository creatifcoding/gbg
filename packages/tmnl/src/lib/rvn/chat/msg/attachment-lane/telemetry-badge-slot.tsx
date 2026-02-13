import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  RVN_CHAT_ICON_STROKE_WIDTH,
  RVN_CHAT_UTILITY_ICON_SIZE,
} from '../iconography'
import { useRvnChatMessageAttachmentLaneContext } from './attachment-lane-context'

export interface RvnChatMessageTelemetryBadgeSlotProps extends ComponentPropsWithoutRef<'span'> {
  active?: boolean
  label?: string
}

export const RvnChatMessageTelemetryBadgeSlot = forwardRef<
  HTMLSpanElement,
  RvnChatMessageTelemetryBadgeSlotProps
>(({ active = true, label = 'telemetry', className, children, ...props }, ref) => {
  const { messageAnchorId } = useRvnChatMessageAttachmentLaneContext(
    'RvnChatMessage.AttachmentLane.TelemetryBadge',
  )

  return (
    <span
      ref={ref}
      data-slot="rvn-chat-message-telemetry-badge-slot"
      data-message-anchor-id={messageAnchorId}
      data-active={active || undefined}
      className={cn('rvn-chat__message-telemetry-badge', className)}
      {...props}
    >
      <Zap
        size={RVN_CHAT_UTILITY_ICON_SIZE}
        strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
        aria-hidden="true"
      />
      <span className="rvn-chat__message-telemetry-badge-label">{children ?? label}</span>
    </span>
  )
})

RvnChatMessageTelemetryBadgeSlot.displayName = 'RvnChatMessage.AttachmentLane.TelemetryBadge'
