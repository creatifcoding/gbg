/**
 * ChatToolBlock Context — shared state for compound sub-components.
 *
 * @module chat/msg/tool-block
 */

import { createContext, useContext } from 'react'
import type { ToolInvocationState } from '@/lib/morphchat/schemas/message-types'

export interface ChatToolBlockContextValue {
  /** Unique tool call ID */
  readonly toolCallId: string
  /** Tool name */
  readonly toolName: string
  /** Current lifecycle state */
  readonly state: ToolInvocationState
  /** Input parameters */
  readonly input?: unknown
  /** Output result */
  readonly output?: unknown
  /** Error text */
  readonly errorText?: string
  /** Whether details panel is expanded */
  readonly isOpen: boolean
  /** Toggle expand/collapse */
  readonly setIsOpen: (open: boolean) => void
  /** Whether this tool has expandable details */
  readonly hasDetails: boolean
}

export const ChatToolBlockContext = createContext<ChatToolBlockContextValue | null>(null)

export function useChatToolBlock(): ChatToolBlockContextValue {
  const ctx = useContext(ChatToolBlockContext)
  if (!ctx) {
    throw new Error('ChatToolBlock sub-components must be used within ChatToolBlock.Root')
  }
  return ctx
}
