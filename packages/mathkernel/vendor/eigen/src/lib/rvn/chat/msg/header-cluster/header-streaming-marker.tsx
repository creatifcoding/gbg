import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface RvnChatMessageHeaderStreamingMarkerProps extends ComponentPropsWithoutRef<'span'> {
  streaming?: boolean
}

export const RvnChatMessageHeaderStreamingMarker = forwardRef<
  HTMLSpanElement,
  RvnChatMessageHeaderStreamingMarkerProps
>(({ streaming = false, className, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="rvn-chat-message-header-streaming-marker"
    data-streaming={streaming || undefined}
    className={cn('rvn-chat__message-streaming-marker', className)}
    {...props}
  />
))

RvnChatMessageHeaderStreamingMarker.displayName = 'RvnChatMessage.HeaderCluster.StreamingMarker'
