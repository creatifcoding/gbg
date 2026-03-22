import type { ReactElement } from 'react'
import { ChatMessageHeaderClusterRoot, type ChatMessageHeaderClusterRootProps } from './header-cluster-root'
import { ChatMessageHeaderRole, type ChatMessageHeaderRoleProps } from './header-role'
import { ChatMessageHeaderTimestamp, type ChatMessageHeaderTimestampProps } from './header-timestamp'
import { ChatMessageHeaderStreamingMarker, type ChatMessageHeaderStreamingMarkerProps } from './header-streaming-marker'
import { ChatMessageHeaderRoleBadge, type ChatMessageHeaderRoleBadgeProps } from './header-role-badge'
import { ChatMessageHeaderStreamingBadge, type ChatMessageHeaderStreamingBadgeProps } from './header-streaming-badge'

interface ChatMessageHeaderClusterComponent {
  (props: ChatMessageHeaderClusterRootProps): ReactElement
  displayName?: string
  Root: typeof ChatMessageHeaderClusterRoot
  Role: typeof ChatMessageHeaderRole
  Timestamp: typeof ChatMessageHeaderTimestamp
  StreamingMarker: typeof ChatMessageHeaderStreamingMarker
  RoleBadge: typeof ChatMessageHeaderRoleBadge
  StreamingBadge: typeof ChatMessageHeaderStreamingBadge
}

const HeaderCluster = ChatMessageHeaderClusterRoot as unknown as ChatMessageHeaderClusterComponent
HeaderCluster.Root = ChatMessageHeaderClusterRoot
HeaderCluster.Role = ChatMessageHeaderRole
HeaderCluster.Timestamp = ChatMessageHeaderTimestamp
HeaderCluster.StreamingMarker = ChatMessageHeaderStreamingMarker
HeaderCluster.RoleBadge = ChatMessageHeaderRoleBadge
HeaderCluster.StreamingBadge = ChatMessageHeaderStreamingBadge

export { HeaderCluster as ChatMessageHeaderCluster }
export type {
  ChatMessageHeaderClusterRootProps,
  ChatMessageHeaderRoleProps,
  ChatMessageHeaderTimestampProps,
  ChatMessageHeaderStreamingMarkerProps,
  ChatMessageHeaderRoleBadgeProps,
  ChatMessageHeaderStreamingBadgeProps,
}
export type { HeaderClusterAlign } from './header-cluster-root'
