/**
 * useMorphChat — Primary Consumer Hook
 *
 * Convenience hook for accessing MorphChat surface state from
 * any component inside a <MorphChat.Surface> provider.
 *
 * Reads directly from adapter atoms — adapter IS the state owner.
 *
 * @module morphchat/hooks/useMorphChat
 */

import { useAtomValue } from '@effect-atom/atom-react'
import { useMorphChatContext } from '../components/surface-context'
import {
  composerFocusedFamily,
  focusedMessageFamily,
  activeAgentFamily,
} from '../atoms/surface-atoms'

/**
 * Primary consumer hook — everything you need to build on MorphChat.
 *
 * ```tsx
 * function MyWidget() {
 *   const { spec, messages, isStreaming, send } = useMorphChat()
 *   // ...
 * }
 * ```
 */
export function useMorphChat() {
  const ctx = useMorphChatContext()
  const { adapter, surfaceId, spec } = ctx

  // Read directly from adapter atoms — adapter owns the data
  const messages = useAtomValue(adapter.messages$)
  const connection = useAtomValue(adapter.connection$)
  const streaming = useAtomValue(adapter.streaming$)
  const agents = useAtomValue(adapter.agents$)

  // Derived
  const isStreaming = streaming.isStreaming
  const isConnected = connection.phase === 'connected'
  const messageCount = messages.length

  // UI atoms (per-surface)
  const composerFocused = useAtomValue(composerFocusedFamily(surfaceId))
  const focusedMessage = useAtomValue(focusedMessageFamily(surfaceId))
  const activeAgent = useAtomValue(activeAgentFamily(surfaceId))

  return {
    // Context pass-through
    surfaceId,
    spec,
    adapter,
    isMorphing: ctx.isMorphing,
    previousSpec: ctx.previousSpec,
    requestMorph: ctx.requestMorph,

    // Data state (from adapter atoms)
    messages,
    connection,
    streaming,
    agents,
    isStreaming,
    isConnected,
    messageCount,

    // UI state (per-surface)
    composerFocused,
    focusedMessage,
    activeAgent,

    // Operations (proxy to adapter)
    send: adapter.send,
    cancel: adapter.cancel,
    reconnect: adapter.reconnect,
    clear: adapter.clear,
  }
}
