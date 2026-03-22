import { createContext, useContext } from 'react'

export type RvnChatShellBand = 'header' | 'command' | 'thread' | 'composer'

export interface RvnChatShellContextValue {
  readonly expansionLevel: 'l2' | 'l3'
}

export const RvnChatShellContext = createContext<RvnChatShellContextValue | null>(null)

export function useRvnChatShellContext() {
  return useContext(RvnChatShellContext)
}
