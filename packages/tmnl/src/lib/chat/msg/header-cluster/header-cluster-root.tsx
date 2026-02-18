import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatMessageHeaderClusterRootProps = ComponentPropsWithoutRef<'header'>

export const ChatMessageHeaderClusterRoot = forwardRef<HTMLElement, ChatMessageHeaderClusterRootProps>(
  ({ className, ...props }, ref) => (
    <header
      ref={ref}
      data-slot="tmnl-chat-message-header-cluster"
      className={cn('flex items-center gap-2 mb-1', className)}
      {...props}
    />
  ),
)

ChatMessageHeaderClusterRoot.displayName = 'ChatMessage.HeaderCluster.Root'
