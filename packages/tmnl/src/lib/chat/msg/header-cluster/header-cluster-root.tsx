import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type HeaderClusterAlign = 'start' | 'end'

export interface ChatMessageHeaderClusterRootProps extends ComponentPropsWithoutRef<'header'> {
  /** Horizontal alignment of header children. Default: 'start' */
  align?: HeaderClusterAlign
}

const ALIGN_CLASS: Record<HeaderClusterAlign, string> = {
  start: 'justify-start',
  end: 'justify-end',
}

export const ChatMessageHeaderClusterRoot = forwardRef<HTMLElement, ChatMessageHeaderClusterRootProps>(
  ({ align = 'start', className, ...props }, ref) => (
    <header
      ref={ref}
      data-slot="tmnl-chat-message-header-cluster"
      data-align={align}
      className={cn('flex items-center gap-2 mb-1', ALIGN_CLASS[align], className)}
      {...props}
    />
  ),
)

ChatMessageHeaderClusterRoot.displayName = 'ChatMessage.HeaderCluster.Root'
