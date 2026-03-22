import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatHeaderBandContext } from './header-band-context'

export type ChatHeaderSessionClusterProps = ComponentPropsWithoutRef<'div'>

export const ChatHeaderSessionCluster = forwardRef<HTMLDivElement, ChatHeaderSessionClusterProps>(
  ({ className, ...props }, ref) => {
    useChatHeaderBandContext('ChatShell.Header.SessionCluster')

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-shell-header-session-cluster"
        data-semantic-compound="session-cluster"
        className={cn('flex items-center gap-1.5', className)}
        {...props}
      />
    )
  },
)

ChatHeaderSessionCluster.displayName = 'ChatShell.Header.SessionCluster'
