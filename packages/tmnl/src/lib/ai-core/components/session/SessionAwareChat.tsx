/**
 * SessionAwareChat Component
 *
 * Wraps a chat component (like IsolationChat) with session persistence.
 * Messages are stored in the active session instead of localStorage.
 *
 * @example
 * ```tsx
 * <SessionProvider>
 *   <SessionSwitcher>
 *     <SessionAwareChat
 *       label="My Chat"
 *       componentId="my-chat"
 *       renderChat={({ messages, onSend, isStreaming }) => (
 *         <MyChat messages={messages} onSend={onSend} isStreaming={isStreaming} />
 *       )}
 *     />
 *   </SessionSwitcher>
 * </SessionProvider>
 * ```
 */

import * as React from 'react'
import { useSessionContext } from './SessionProvider'
import type { UIMessage } from 'ai'

// =============================================================================
// Types
// =============================================================================

export interface SessionAwareChatProps {
  /** Component label */
  label: string
  /** Component ID */
  componentId: string
  /** Render the chat UI */
  renderChat: (props: SessionChatRenderProps) => React.ReactNode
  /** System prompt (used when creating new sessions) */
  systemPrompt?: string
}

export interface SessionChatRenderProps {
  /** Current messages from active session */
  messages: UIMessage[]
  /** Send a new message */
  onSend: (text: string) => Promise<void>
  /** Append a message directly (for assistant responses) */
  onAppend: (message: UIMessage) => Promise<void>
  /** Update messages (replace all) */
  onUpdateMessages: (messages: UIMessage[]) => Promise<void>
  /** Is chat streaming */
  isStreaming: boolean
  /** Set streaming state */
  setStreaming: (streaming: boolean) => void
  /** Active session title */
  sessionTitle: string | null
  /** Active session ID */
  sessionId: string | null
}

// =============================================================================
// Component
// =============================================================================

/**
 * Session-aware chat wrapper
 *
 * This component:
 * 1. Reads messages from the active session
 * 2. Writes messages back to the active session
 * 3. Provides callbacks for the child chat component
 */
export function SessionAwareChat({
  label,
  componentId,
  renderChat,
  systemPrompt,
}: SessionAwareChatProps) {
  const { session, sessions } = useSessionContext()
  const [isStreaming, setStreaming] = React.useState(false)

  // Get messages from active session
  const messages = React.useMemo(() => {
    if (!session.session) return []
    return session.session.messages as UIMessage[]
  }, [session.session])

  // Handle sending a new message (user message)
  const onSend = React.useCallback(
    async (text: string) => {
      if (!session.session) {
        // Create a new session first
        await sessions.createNew({
          systemPrompt,
        })
      }

      // Create user message in AI SDK format
      const userMessage: UIMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'user',
        content: text,
        parts: [{ type: 'text', text }],
        createdAt: new Date(),
      }

      await session.appendMessage(userMessage)
    },
    [session, sessions, systemPrompt]
  )

  // Handle appending a message (for assistant responses)
  const onAppend = React.useCallback(
    async (message: UIMessage) => {
      await session.appendMessage(message)
    },
    [session]
  )

  // Handle updating all messages
  const onUpdateMessages = React.useCallback(
    async (newMessages: UIMessage[]) => {
      await session.updateMessages(newMessages)
    },
    [session]
  )

  return (
    <>
      {renderChat({
        messages,
        onSend,
        onAppend,
        onUpdateMessages,
        isStreaming,
        setStreaming,
        sessionTitle: session.session?.title ?? null,
        sessionId: session.session?.id ?? null,
      })}
    </>
  )
}

SessionAwareChat.displayName = 'SessionAwareChat'
