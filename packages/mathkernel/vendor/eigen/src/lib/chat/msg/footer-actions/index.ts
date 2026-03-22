import type { ReactElement } from 'react'
import { ChatMessageFooterActionsRoot, type ChatMessageFooterActionsRootProps } from './footer-actions-root'
import { ChatMessageActionsGroup, type ChatMessageActionsGroupProps } from './actions-group'

interface ChatMessageFooterActionsComponent {
  (props: ChatMessageFooterActionsRootProps): ReactElement
  displayName?: string
  Root: typeof ChatMessageFooterActionsRoot
  Group: typeof ChatMessageActionsGroup
}

const FooterActions = ChatMessageFooterActionsRoot as unknown as ChatMessageFooterActionsComponent
FooterActions.Root = ChatMessageFooterActionsRoot
FooterActions.Group = ChatMessageActionsGroup

export { FooterActions as ChatMessageFooterActions }
export type {
  ChatMessageFooterActionsRootProps,
  ChatMessageActionsGroupProps,
}
