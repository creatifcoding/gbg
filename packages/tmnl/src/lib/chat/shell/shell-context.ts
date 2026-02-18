import { createContext, useContext } from 'react'

export type ChatShellBand = 'header' | 'command' | 'thread' | 'composer'

export interface ChatShellContextValue {
  readonly expansionLevel: 'l2' | 'l3'
}

export const ChatShellContext = createContext<ChatShellContextValue | null>(null)

export function useChatShellContext() {
  return useContext(ChatShellContext)
}
