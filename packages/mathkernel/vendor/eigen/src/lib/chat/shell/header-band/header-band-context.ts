import { createContext, useContext } from 'react'

export interface ChatHeaderBandContextValue {
  readonly semanticOwner: 'tmnl-chat-shell-header-band'
}

export const ChatHeaderBandContext = createContext<ChatHeaderBandContextValue | null>(null)

export function useChatHeaderBandContext(componentName: string) {
  const context = useContext(ChatHeaderBandContext)

  if (!context) {
    throw new Error(`${componentName} must be used within ChatShell.HeaderBand`)
  }

  return context
}
