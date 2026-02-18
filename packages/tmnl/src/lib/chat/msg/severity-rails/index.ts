import type { ReactElement } from 'react'
import { ChatMessageSeverityRailsRoot, type ChatMessageSeverityRailsRootProps } from './severity-rails-root'
import { ChatMessageRoleRail, type ChatMessageRoleRailProps } from '../msg-role-rail'
import { ChatMessageRoleIconRail, type ChatMessageRoleIconRailProps } from './role-icon-rail'

interface ChatMessageSeverityRailsComponent {
  (props: ChatMessageSeverityRailsRootProps): ReactElement
  displayName?: string
  Root: typeof ChatMessageSeverityRailsRoot
  RoleRail: typeof ChatMessageRoleRail
  RoleIconRail: typeof ChatMessageRoleIconRail
}

const SeverityRails = ChatMessageSeverityRailsRoot as unknown as ChatMessageSeverityRailsComponent
SeverityRails.Root = ChatMessageSeverityRailsRoot
SeverityRails.RoleRail = ChatMessageRoleRail
SeverityRails.RoleIconRail = ChatMessageRoleIconRail

export { SeverityRails as ChatMessageSeverityRails }
export type {
  ChatMessageSeverityRailsRootProps,
  ChatMessageRoleRailProps,
  ChatMessageRoleIconRailProps,
}
