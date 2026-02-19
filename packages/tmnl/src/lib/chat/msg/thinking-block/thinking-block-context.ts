/**
 * ChatThinkingBlock Context — shared state for compound sub-components.
 *
 * @module chat/msg/thinking-block
 */

import { createContext, useContext } from 'react'

export interface ChatThinkingBlockContextValue {
  /** Whether thinking content is still streaming */
  readonly isStreaming: boolean
  /** Whether the content panel is expanded */
  readonly isOpen: boolean
  /** Toggle expand/collapse */
  readonly setIsOpen: (open: boolean) => void
  /** Thinking duration in seconds (undefined while streaming) */
  readonly durationSec: number | undefined
}

export const ChatThinkingBlockContext = createContext<ChatThinkingBlockContextValue | null>(null)

export function useChatThinkingBlock(): ChatThinkingBlockContextValue {
  const ctx = useContext(ChatThinkingBlockContext)
  if (!ctx) {
    throw new Error('ChatThinkingBlock sub-components must be used within ChatThinkingBlock.Root')
  }
  return ctx
}
