import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { ChatTransportBtn } from './transport-btn'

export type ChatReconnectBtnProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'>

export const ChatReconnectBtn = forwardRef<HTMLButtonElement, ChatReconnectBtnProps>(
  (props, ref) => <ChatTransportBtn ref={ref} variant="reconnect" {...props} />,
)

ChatReconnectBtn.displayName = 'ChatReconnectBtn'
