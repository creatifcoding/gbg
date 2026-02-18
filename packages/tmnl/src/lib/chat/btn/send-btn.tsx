import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { ChatTransportBtn } from './transport-btn'

export type ChatSendBtnProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'>

export const ChatSendBtn = forwardRef<HTMLButtonElement, ChatSendBtnProps>(
  (props, ref) => <ChatTransportBtn ref={ref} variant="send" {...props} />,
)

ChatSendBtn.displayName = 'ChatSendBtn'
