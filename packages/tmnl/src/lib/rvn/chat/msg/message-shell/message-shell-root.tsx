import { forwardRef, useMemo, type ReactNode } from 'react'
import {
  RvnChatMessage,
  type RvnChatMessageRootProps,
} from '../../RvnChatMessage'
import { RvnChatMessageShellContext } from './message-shell-context'

export interface RvnChatMessageShellRootProps
  extends Omit<RvnChatMessageRootProps, 'children'> {
  messageAnchorId?: string
  children: ReactNode
}

export const RvnChatMessageShellRoot = forwardRef<
  HTMLElement,
  RvnChatMessageShellRootProps
>(({ role, streaming = false, messageAnchorId, children, ...props }, ref) => {
  const contextValue = useMemo(
    () => ({
      role,
      streaming,
      messageAnchorId,
    }),
    [messageAnchorId, role, streaming],
  )

  return (
    <RvnChatMessageShellContext.Provider value={contextValue}>
      <RvnChatMessage.Root ref={ref} role={role} streaming={streaming} {...props}>
        {children}
      </RvnChatMessage.Root>
    </RvnChatMessageShellContext.Provider>
  )
})

RvnChatMessageShellRoot.displayName = 'RvnChatMessageShell.Root'
