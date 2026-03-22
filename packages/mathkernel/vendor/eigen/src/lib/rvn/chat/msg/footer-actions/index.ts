import type { ReactElement } from 'react'
import {
  RvnChatMessageFooterActionsRoot,
  type RvnChatMessageFooterActionsRootProps,
} from './footer-actions-root'
import {
  RvnChatMessageActionsGroup,
  type RvnChatMessageActionsGroupProps,
} from './actions-group'

interface RvnChatMessageFooterActionsComponent {
  (props: RvnChatMessageFooterActionsRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatMessageFooterActionsRoot
  Group: typeof RvnChatMessageActionsGroup
}

const FooterActions = RvnChatMessageFooterActionsRoot as RvnChatMessageFooterActionsComponent
FooterActions.Root = RvnChatMessageFooterActionsRoot
FooterActions.Group = RvnChatMessageActionsGroup

export { FooterActions as RvnChatMessageFooterActions }
export type {
  RvnChatMessageFooterActionsRootProps,
  RvnChatMessageActionsGroupProps,
}
