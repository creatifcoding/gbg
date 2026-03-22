import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { ChatTransportBtn } from './transport-btn'

export type ChatPauseBtnProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'>

export const ChatPauseBtn = forwardRef<HTMLButtonElement, ChatPauseBtnProps>(
  (props, ref) => <ChatTransportBtn ref={ref} variant="pause" {...props} />,
)

ChatPauseBtn.displayName = 'ChatPauseBtn'
