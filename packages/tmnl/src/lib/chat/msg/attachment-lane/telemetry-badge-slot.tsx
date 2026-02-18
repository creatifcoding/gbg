import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHAT_ICON_STROKE_WIDTH, CHAT_UTILITY_ICON_SIZE } from '../iconography'
import { useChatMessageAttachmentLaneContext } from './attachment-lane-context'

export interface ChatMessageTelemetryBadgeSlotProps extends ComponentPropsWithoutRef<'span'> {
  active?: boolean
  label?: string
}

export const ChatMessageTelemetryBadgeSlot = forwardRef<
  HTMLSpanElement,
  ChatMessageTelemetryBadgeSlotProps
>(({ active = true, label = 'telemetry', className, children, ...props }, ref) => {
  const { messageAnchorId } = useChatMessageAttachmentLaneContext(
    'ChatMessage.AttachmentLane.TelemetryBadge',
  )

  return (
    <span
      ref={ref}
      data-slot="tmnl-chat-message-telemetry-badge-slot"
      data-message-anchor-id={messageAnchorId}
      data-active={active || undefined}
      className={cn(
        'inline-flex items-center gap-1 font-mono',
        active ? 'text-amber-400' : 'text-neutral-600',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    >
      <Zap
        size={CHAT_UTILITY_ICON_SIZE}
        strokeWidth={CHAT_ICON_STROKE_WIDTH}
        aria-hidden="true"
      />
      <span>{children ?? label}</span>
    </span>
  )
})

ChatMessageTelemetryBadgeSlot.displayName = 'ChatMessage.AttachmentLane.TelemetryBadge'
