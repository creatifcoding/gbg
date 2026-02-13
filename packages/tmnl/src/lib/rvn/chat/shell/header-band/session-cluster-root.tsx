import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useRvnChatHeaderBandContext } from './header-band-context'

export type RvnChatHeaderSessionClusterProps = ComponentPropsWithoutRef<'div'>

export const RvnChatHeaderSessionCluster = forwardRef<HTMLDivElement, RvnChatHeaderSessionClusterProps>(
  ({ className, ...props }, ref) => {
    useRvnChatHeaderBandContext('RvnChatShell.Header.SessionCluster')

    return (
      <div
        ref={ref}
        data-slot="rvn-chat-shell-header-session-cluster"
        data-semantic-compound="session-cluster"
        className={cn('rvn-chat__status-cluster', 'rvn-chat-shell__header-session-cluster', className)}
        {...props}
      />
    )
  },
)

RvnChatHeaderSessionCluster.displayName = 'RvnChatShell.Header.SessionCluster'
