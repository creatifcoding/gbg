import type { ReactElement } from 'react'
import {
  RvnChatComposerTransportRoot,
  type RvnChatComposerTransportRootProps,
} from './transport-root'
import {
  RvnChatComposerTransportPrimary,
  type RvnChatComposerTransportPrimaryProps,
} from './primary'
import {
  RvnChatComposerTransportReconnect,
  type RvnChatComposerTransportReconnectProps,
} from './reconnect'

interface RvnChatComposerTransportComponent {
  (props: RvnChatComposerTransportRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatComposerTransportRoot
  Primary: typeof RvnChatComposerTransportPrimary
  Reconnect: typeof RvnChatComposerTransportReconnect
}

const Transport = RvnChatComposerTransportRoot as RvnChatComposerTransportComponent
Transport.Root = RvnChatComposerTransportRoot
Transport.Primary = RvnChatComposerTransportPrimary
Transport.Reconnect = RvnChatComposerTransportReconnect

export { Transport as RvnChatComposerTransport }
export type {
  RvnChatComposerTransportRootProps,
  RvnChatComposerTransportPrimaryProps,
  RvnChatComposerTransportReconnectProps,
}
