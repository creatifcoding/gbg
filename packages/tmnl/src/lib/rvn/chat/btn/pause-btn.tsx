import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { RvnChatTransportBtn } from './transport-btn'

export type RvnChatPauseBtnProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'>

export const RvnChatPauseBtn = forwardRef<HTMLButtonElement, RvnChatPauseBtnProps>(
  (props, ref) => <RvnChatTransportBtn ref={ref} variant="pause" {...props} />,
)

RvnChatPauseBtn.displayName = 'RvnChatPauseBtn'
