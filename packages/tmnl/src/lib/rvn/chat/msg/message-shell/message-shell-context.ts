import { createContext, useContext } from 'react'
import type { RvnChatMessageRole } from '../../RvnChatMessage'

export interface RvnChatMessageShellContextValue {
  readonly role: RvnChatMessageRole
  readonly streaming: boolean
  readonly messageAnchorId?: string
}

export const RvnChatMessageShellContext =
  createContext<RvnChatMessageShellContextValue | null>(null)

export function useRvnChatMessageShellContext(componentName: string) {
  const context = useContext(RvnChatMessageShellContext)
  if (!context) {
    throw new Error(`${componentName} must be used within RvnChatMessageShell.Root`)
  }
  return context
}
