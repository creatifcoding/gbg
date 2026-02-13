import type { ReactElement } from 'react'
import {
  RvnChatMessageBodyContentRoot,
  type RvnChatMessageBodyContentRootProps,
} from './body-content-root'
import {
  RvnChatMessageStreamCursor,
  type RvnChatMessageStreamCursorProps,
} from './stream-cursor'

interface RvnChatMessageBodyContentComponent {
  (props: RvnChatMessageBodyContentRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatMessageBodyContentRoot
  StreamCursor: typeof RvnChatMessageStreamCursor
}

const BodyContent = RvnChatMessageBodyContentRoot as RvnChatMessageBodyContentComponent
BodyContent.Root = RvnChatMessageBodyContentRoot
BodyContent.StreamCursor = RvnChatMessageStreamCursor

export { BodyContent as RvnChatMessageBodyContent }
export type {
  RvnChatMessageBodyContentRootProps,
  RvnChatMessageStreamCursorProps,
}
