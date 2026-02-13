import type { ReactElement } from 'react'
import {
  RvnChatMessageHeaderClusterRoot,
  type RvnChatMessageHeaderClusterRootProps,
} from './header-cluster-root'
import {
  RvnChatMessageHeaderRole,
  type RvnChatMessageHeaderRoleProps,
} from './header-role'
import {
  RvnChatMessageHeaderTimestamp,
  type RvnChatMessageHeaderTimestampProps,
} from './header-timestamp'
import {
  RvnChatMessageHeaderStreamingMarker,
  type RvnChatMessageHeaderStreamingMarkerProps,
} from './header-streaming-marker'
import {
  RvnChatMessageHeaderRoleBadge,
  type RvnChatMessageHeaderRoleBadgeProps,
} from './header-role-badge'
import {
  RvnChatMessageHeaderStreamingBadge,
  type RvnChatMessageHeaderStreamingBadgeProps,
} from './header-streaming-badge'

interface RvnChatMessageHeaderClusterComponent {
  (props: RvnChatMessageHeaderClusterRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatMessageHeaderClusterRoot
  Role: typeof RvnChatMessageHeaderRole
  Timestamp: typeof RvnChatMessageHeaderTimestamp
  StreamingMarker: typeof RvnChatMessageHeaderStreamingMarker
  RoleBadge: typeof RvnChatMessageHeaderRoleBadge
  StreamingBadge: typeof RvnChatMessageHeaderStreamingBadge
}

const HeaderCluster = RvnChatMessageHeaderClusterRoot as RvnChatMessageHeaderClusterComponent
HeaderCluster.Root = RvnChatMessageHeaderClusterRoot
HeaderCluster.Role = RvnChatMessageHeaderRole
HeaderCluster.Timestamp = RvnChatMessageHeaderTimestamp
HeaderCluster.StreamingMarker = RvnChatMessageHeaderStreamingMarker
HeaderCluster.RoleBadge = RvnChatMessageHeaderRoleBadge
HeaderCluster.StreamingBadge = RvnChatMessageHeaderStreamingBadge

export { HeaderCluster as RvnChatMessageHeaderCluster }
export type {
  RvnChatMessageHeaderClusterRootProps,
  RvnChatMessageHeaderRoleProps,
  RvnChatMessageHeaderTimestampProps,
  RvnChatMessageHeaderStreamingMarkerProps,
  RvnChatMessageHeaderRoleBadgeProps,
  RvnChatMessageHeaderStreamingBadgeProps,
}
