import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { RvnChatTransportBtn } from './transport-btn'

export type RvnChatReconnectBtnProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'>

export const RvnChatReconnectBtn = forwardRef<HTMLButtonElement, RvnChatReconnectBtnProps>(
  (props, ref) => <RvnChatTransportBtn ref={ref} variant="reconnect" {...props} />,
)

RvnChatReconnectBtn.displayName = 'RvnChatReconnectBtn'
