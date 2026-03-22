import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { RvnChatTransportBtn } from './transport-btn'

export type RvnChatSendBtnProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'>

export const RvnChatSendBtn = forwardRef<HTMLButtonElement, RvnChatSendBtnProps>(
  (props, ref) => <RvnChatTransportBtn ref={ref} variant="send" {...props} />,
)

RvnChatSendBtn.displayName = 'RvnChatSendBtn'
