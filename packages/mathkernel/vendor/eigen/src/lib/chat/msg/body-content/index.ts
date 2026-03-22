import type { ReactElement } from 'react'
import { ChatMessageBodyContentRoot, type ChatMessageBodyContentRootProps } from './body-content-root'
import { ChatMessageStreamCursor, type ChatMessageStreamCursorProps } from './stream-cursor'

interface ChatMessageBodyContentComponent {
  (props: ChatMessageBodyContentRootProps): ReactElement
  displayName?: string
  Root: typeof ChatMessageBodyContentRoot
  StreamCursor: typeof ChatMessageStreamCursor
}

const BodyContent = ChatMessageBodyContentRoot as unknown as ChatMessageBodyContentComponent
BodyContent.Root = ChatMessageBodyContentRoot
BodyContent.StreamCursor = ChatMessageStreamCursor

export { BodyContent as ChatMessageBodyContent }
export type {
  ChatMessageBodyContentRootProps,
  ChatMessageStreamCursorProps,
}
