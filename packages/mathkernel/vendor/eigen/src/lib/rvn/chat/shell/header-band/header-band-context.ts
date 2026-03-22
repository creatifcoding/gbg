import { createContext, useContext } from 'react'

export interface RvnChatHeaderBandContextValue {
  readonly semanticOwner: 'rvn-chat-shell-header-band'
}

export const RvnChatHeaderBandContext = createContext<RvnChatHeaderBandContextValue | null>(null)

export function useRvnChatHeaderBandContext(componentName: string) {
  const context = useContext(RvnChatHeaderBandContext)

  if (!context) {
    throw new Error(`${componentName} must be used within RvnChatShell.HeaderBand`)
  }

  return context
}
