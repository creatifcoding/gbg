import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatMessageHeaderClusterRootProps = ComponentPropsWithoutRef<'header'>

export const RvnChatMessageHeaderClusterRoot = forwardRef<HTMLElement, RvnChatMessageHeaderClusterRootProps>(
  ({ className, ...props }, ref) => (
    <header
      ref={ref}
      data-slot="rvn-chat-message-header-cluster"
      className={cn('rvn-chat__message-meta', 'rvn-chat__message-header-cluster', className)}
      {...props}
    />
  ),
)

RvnChatMessageHeaderClusterRoot.displayName = 'RvnChatMessage.HeaderCluster.Root'
