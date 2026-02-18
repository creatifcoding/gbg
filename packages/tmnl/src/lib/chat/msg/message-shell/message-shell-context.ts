import { createContext, useContext } from 'react'
import type { ChatMessageRole } from '../msg-role-rail'

export interface ChatMessageShellContextValue {
  readonly role: ChatMessageRole
  readonly streaming: boolean
  readonly messageAnchorId?: string
}

export const ChatMessageShellContext =
  createContext<ChatMessageShellContextValue | null>(null)

export function useChatMessageShellContext(componentName: string) {
  const context = useContext(ChatMessageShellContext)
  if (!context) {
    throw new Error(`${componentName} must be used within ChatMessageShell.Root`)
  }
  return context
}
