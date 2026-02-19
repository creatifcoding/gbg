/**
 * ChatCodeBlock Context — shared state for compound sub-components.
 *
 * @module chat/msg/code-block
 */

import { createContext, useContext } from 'react'

export interface ChatCodeBlockContextValue {
  /** Raw source code */
  readonly code: string
  /** Language identifier for syntax highlighting */
  readonly language: string
  /** Optional filename / title */
  readonly filename?: string
  /** Whether code is still streaming in */
  readonly isStreaming: boolean
}

export const ChatCodeBlockContext = createContext<ChatCodeBlockContextValue | null>(null)

export function useChatCodeBlock(): ChatCodeBlockContextValue {
  const ctx = useContext(ChatCodeBlockContext)
  if (!ctx) {
    throw new Error('ChatCodeBlock sub-components must be used within ChatCodeBlock.Root')
  }
  return ctx
}
