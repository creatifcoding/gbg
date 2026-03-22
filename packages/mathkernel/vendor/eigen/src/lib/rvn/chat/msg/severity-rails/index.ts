import type { ReactElement } from 'react'
import {
  RvnChatMessageSeverityRailsRoot,
  type RvnChatMessageSeverityRailsRootProps,
} from './severity-rails-root'
import {
  RvnChatMessageRoleRail,
  type RvnChatMessageRoleRailProps,
} from '../msg-role-rail'
import {
  RvnChatMessageRoleIconRail,
  type RvnChatMessageRoleIconRailProps,
} from './role-icon-rail'

interface RvnChatMessageSeverityRailsComponent {
  (props: RvnChatMessageSeverityRailsRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatMessageSeverityRailsRoot
  RoleRail: typeof RvnChatMessageRoleRail
  RoleIconRail: typeof RvnChatMessageRoleIconRail
}

const SeverityRails = RvnChatMessageSeverityRailsRoot as RvnChatMessageSeverityRailsComponent
SeverityRails.Root = RvnChatMessageSeverityRailsRoot
SeverityRails.RoleRail = RvnChatMessageRoleRail
SeverityRails.RoleIconRail = RvnChatMessageRoleIconRail

export { SeverityRails as RvnChatMessageSeverityRails }
export type {
  RvnChatMessageSeverityRailsRootProps,
  RvnChatMessageRoleRailProps,
  RvnChatMessageRoleIconRailProps,
}
