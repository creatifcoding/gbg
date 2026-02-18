import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface ChatMessageHeaderStreamingMarkerProps extends ComponentPropsWithoutRef<'span'> {
  streaming?: boolean
}

export const ChatMessageHeaderStreamingMarker = forwardRef<
  HTMLSpanElement,
  ChatMessageHeaderStreamingMarkerProps
>(({ streaming = false, className, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="tmnl-chat-message-header-streaming-marker"
    data-streaming={streaming || undefined}
    className={cn(
      'w-1.5 h-1.5 rounded-full transition-colors duration-300',
      streaming ? 'bg-cyan-400 animate-pulse' : 'bg-neutral-700',
      className,
    )}
    {...props}
  />
))

ChatMessageHeaderStreamingMarker.displayName = 'ChatMessage.HeaderCluster.StreamingMarker'
