import { createContext, useContext } from 'react'

interface RvnChatAgentSelectorContextValue {
  readonly open: boolean
}

export const RvnChatAgentSelectorContext = createContext<RvnChatAgentSelectorContextValue | null>(null)

export function useRvnChatAgentSelectorContext() {
  return useContext(RvnChatAgentSelectorContext)
}
