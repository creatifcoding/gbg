/**
 * useAdapterState — Adapter Atom Subscription Hook
 *
 * Reads directly from adapter atoms. No intermediary family layer.
 * The adapter IS the state owner.
 *
 * @module morphchat/hooks/useAdapterState
 */

import { useAtomValue } from '@effect-atom/atom-react'
import { useMorphChatContext } from '../components/surface-context'

/**
 * Subscribe to all adapter state in one call.
 *
 * ```tsx
 * const { messages, connection, isStreaming } = useAdapterState()
 * ```
 */
export function useAdapterState() {
  const { adapter } = useMorphChatContext()

  const messages = useAtomValue(adapter.messages$)
  const connection = useAtomValue(adapter.connection$)
  const streaming = useAtomValue(adapter.streaming$)
  const agents = useAtomValue(adapter.agents$)

  return {
    messages,
    connection,
    streaming,
    agents,
    latestMessage: messages.length > 0 ? messages[messages.length - 1] : null,
    messageCount: messages.length,
    isConnected: connection.phase === 'connected',
    isStreaming: streaming.isStreaming,
  }
}
