import { createContext, useContext } from 'react'

interface ChatAgentSelectorContextValue {
  readonly open: boolean
}

export const ChatAgentSelectorContext = createContext<ChatAgentSelectorContextValue | null>(null)

export function useChatAgentSelectorContext() {
  return useContext(ChatAgentSelectorContext)
}
