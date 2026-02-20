/**
 * Shared Harness Event Processor — Full Parts Processing
 *
 * Extracted from createHarnessAdapter for reuse by both:
 *   - createHarnessAdapter (factory pattern, Effect-only consumers)
 *   - useHarnessAdapter (hook pattern, React consumers)
 *
 * Pure functions that operate on atom state via morphChatRegistry.
 * Handles all 10 event types with structured parts:
 *   - Text delta coalescing into TextPart
 *   - Thinking delta accumulation into ThinkingPart
 *   - Tool event → ToolInvocationPart upserts
 *   - Final text reconciliation
 *   - Usage/token patching
 *   - Connection/session lifecycle
 *
 * @module morphchat/adapters/harness-event-processor
 */

import { Atom } from '@effect-atom/atom'
import type {
  ChatMessage,
  ChatMessagePart,
  TextPart,
  ThinkingPart,
  ToolInvocationPart,
  ConnectionState,
  StreamingState,
  AgentInfo,
} from '../schemas/message-types'
import { STREAMING_IDLE, flattenPartsToText } from '../schemas/message-types'
import { morphChatRegistry } from '../atoms/registry'
import type { HarnessEvent } from '@/lib/harness/schemas'
import type { MetricEntry, ProviderMarker } from '../schemas/metric-types'
import { splitPartsCodeFences } from './markdown-code-splitter'

// =============================================================================
// Config — which atoms to write to
// =============================================================================

export interface EventProcessorAtoms {
  readonly messages$: Atom.Atom<ReadonlyArray<ChatMessage>>
  readonly connection$: Atom.Atom<ConnectionState>
  readonly streaming$: Atom.Atom<StreamingState>
  readonly agents$: Atom.Atom<ReadonlyArray<AgentInfo>>
  readonly inlineTasks$?: Atom.Atom<ReadonlyArray<unknown>>
  readonly sessionId$?: Atom.Atom<string | null>
  /** Metrics from chat:v2/metric events */
  readonly metrics$?: Atom.Atom<ReadonlyArray<MetricEntry>>
  /** Provider markers from chat:v2/provider_marker events */
  readonly provider$?: Atom.Atom<ProviderMarker | null>
}

// =============================================================================
// Registry Update Helper
// =============================================================================

/**
 * effect-atom Registry.set() does NOT support updater functions —
 * it stores the value literally.
 *
 * Use `morphChatRegistry.update(atom, fn)` for read-modify-write.
 * This alias wraps it for local readability.
 */
function registryUpdate<A>(atom: Atom.Atom<A>, fn: (prev: A) => A): void {
  morphChatRegistry.update(atom, fn)
}

// =============================================================================
// Parts Helpers (pure)
// =============================================================================

function updateMessageParts(
  atoms: EventProcessorAtoms,
  messageId: string,
  mapper: (parts: ReadonlyArray<ChatMessagePart>) => ReadonlyArray<ChatMessagePart>,
): void {
  registryUpdate(atoms.messages$, (prev) =>
    prev.map((msg) => {
      if (msg.id !== messageId) return msg
      const currentParts = msg.parts ?? []
      const newParts = mapper(currentParts)
      const newContent = flattenPartsToText(newParts)
      return { ...msg, parts: newParts, content: newContent || msg.content }
    }),
  )
}

export function appendTextDelta(
  parts: ReadonlyArray<ChatMessagePart>,
  delta: string,
): ReadonlyArray<ChatMessagePart> {
  const arr = [...parts]
  const lastIdx = arr.length - 1
  if (lastIdx >= 0 && arr[lastIdx]._tag === 'text') {
    const textPart = arr[lastIdx] as TextPart
    arr[lastIdx] = { ...textPart, content: textPart.content + delta }
  } else {
    arr.push({ _tag: 'text' as const, content: delta })
  }
  return arr
}

export function appendThinkingDelta(
  parts: ReadonlyArray<ChatMessagePart>,
  delta: string,
): ReadonlyArray<ChatMessagePart> {
  const arr = [...parts]
  const thinkingIdx = arr.findLastIndex(
    (p) => p._tag === 'thinking' && (p as ThinkingPart).isStreaming,
  )
  if (thinkingIdx >= 0) {
    const tp = arr[thinkingIdx] as ThinkingPart
    arr[thinkingIdx] = { ...tp, content: tp.content + delta }
  } else {
    arr.push({
      _tag: 'thinking' as const,
      content: delta,
      isStreaming: true,
    })
  }
  return arr
}

export function finalizeThinking(
  parts: ReadonlyArray<ChatMessagePart>,
  durationMs?: number,
): ReadonlyArray<ChatMessagePart> {
  return parts.map((p) =>
    p._tag === 'thinking' && (p as ThinkingPart).isStreaming
      ? { ...p, isStreaming: false, durationMs } as ThinkingPart
      : p,
  )
}

export function upsertToolPart(
  parts: ReadonlyArray<ChatMessagePart>,
  toolCallId: string,
  update: Partial<ToolInvocationPart> & { toolName: string; state: ToolInvocationPart['state'] },
): ReadonlyArray<ChatMessagePart> {
  const arr = [...parts]
  const idx = arr.findIndex(
    (p) => p._tag === 'tool-invocation' && (p as ToolInvocationPart).toolCallId === toolCallId,
  )
  if (idx >= 0) {
    arr[idx] = { ...(arr[idx] as ToolInvocationPart), ...update }
  } else {
    arr.push({
      _tag: 'tool-invocation' as const,
      toolCallId,
      ...update,
    } as ToolInvocationPart)
  }
  return arr
}

// =============================================================================
// Event Processor Factory — returns processEvent + thinkingStartTime tracker
// =============================================================================

export interface HarnessEventProcessorConfig {
  readonly atoms: EventProcessorAtoms
  readonly agentName: string
  readonly nodeId?: string
}

export function createEventProcessor(config: HarnessEventProcessorConfig) {
  const { atoms, agentName, nodeId } = config
  let thinkingStartTime: number | null = null

  function processEvent(event: HarnessEvent): void {
    switch (event._tag) {
      case 'chat:v2/session_opened': {
        if (atoms.sessionId$) {
          morphChatRegistry.set(atoms.sessionId$, event.sessionId as string)
        }
        morphChatRegistry.set(atoms.connection$, {
          phase: 'connected',
          endpoint: `harness:${event.nodeId ?? nodeId ?? ''}`,
        } as ConnectionState)
        morphChatRegistry.set(atoms.agents$, [{
          id: event.agentId,
          name: agentName,
          isActive: true,
        }])
        break
      }

      case 'chat:v2/send_accepted': {
        registryUpdate(atoms.messages$, (prev) =>
          prev.map((msg) =>
            msg.status === 'pending'
              ? { ...msg, status: 'sent' as const }
              : msg,
          ),
        )
        break
      }

      case 'chat:v2/assistant_start': {
        // Finalize any previously streaming message (multi-turn tool loop:
        // the engine may start a new assistant turn without sending assistant_final
        // for the intermediate tool-calling turn)
        registryUpdate(atoms.messages$, (prev) =>
          prev.map((msg) =>
            msg.status === 'streaming'
              ? { ...msg, status: 'complete' as const, content: flattenPartsToText(msg.parts ?? []) || msg.content }
              : msg,
          ),
        )

        const streamMsg: ChatMessage = {
          id: event.messageId as string,
          role: 'agent',
          authorName: agentName,
          content: '',
          timestamp: new Date(event.at).toISOString(),
          status: 'streaming',
          parts: [],
        }
        registryUpdate(atoms.messages$, (prev) => [...prev, streamMsg])
        morphChatRegistry.set(atoms.streaming$, {
          isStreaming: true,
          buffer: '',
          messageId: event.messageId as string,
          tokensReceived: 0,
        })
        thinkingStartTime = null
        break
      }

      case 'chat:v2/assistant_delta': {
        const msgId = event.messageId as string
        // Update streaming buffer (legacy compat)
        registryUpdate(atoms.streaming$, (prev) => ({
          ...prev,
          buffer: prev.buffer + event.delta,
          tokensReceived: (prev.tokensReceived ?? 0) + 1,
        }))
        // Update structured parts
        updateMessageParts(atoms, msgId, (parts) => appendTextDelta(parts, event.delta))
        break
      }

      case 'chat:v2/assistant_thinking_delta': {
        const msgId = event.messageId as string
        if (thinkingStartTime === null) {
          thinkingStartTime = Date.now()
        }
        updateMessageParts(atoms, msgId, (parts) => appendThinkingDelta(parts, event.delta))
        break
      }

      case 'chat:v2/assistant_final': {
        const msgId = event.messageId as string
        const thinkingDuration = thinkingStartTime != null
          ? Date.now() - thinkingStartTime
          : undefined
        thinkingStartTime = null

        registryUpdate(atoms.messages$, (prev) =>
          prev.map((msg) => {
            if (msg.id !== msgId) return msg
            let finalParts = finalizeThinking(msg.parts ?? [], thinkingDuration)
            const currentText = flattenPartsToText(finalParts)
            if (event.text !== currentText) {
              const nonTextParts = finalParts.filter((p) => p._tag !== 'text')
              finalParts = [
                ...nonTextParts,
                { _tag: 'text' as const, content: event.text },
              ]
            }
            // ── Hybrid code splitting: split text→code on final ──
            finalParts = splitPartsCodeFences(finalParts)
            return {
              ...msg,
              content: event.text,
              status: 'complete' as const,
              parts: finalParts,
            }
          }),
        )
        morphChatRegistry.set(atoms.streaming$, STREAMING_IDLE)
        break
      }

      case 'chat:v2/usage': {
        const usageId = event.messageId as string
        registryUpdate(atoms.messages$, (prev) =>
          prev.map((msg) =>
            msg.id === usageId
              ? {
                  ...msg,
                  model: event.model,
                  provider: event.provider,
                  tokenUsage: {
                    prompt: event.usage.input,
                    completion: event.usage.output,
                    total: event.usage.totalTokens,
                    cacheRead: event.usage.cacheRead,
                    cacheWrite: event.usage.cacheWrite,
                    cost: {
                      input: event.cost.input,
                      output: event.cost.output,
                      cacheRead: event.cost.cacheRead,
                      cacheWrite: event.cost.cacheWrite,
                      total: event.cost.total,
                    },
                  },
                }
              : msg,
          ),
        )
        break
      }

      case 'chat:v2/tool_event': {
        const currentMessages = morphChatRegistry.get(atoms.messages$)
        const streamingMsg = currentMessages.find((m) => m.status === 'streaming')
        const targetMsgId = streamingMsg?.id

        const toolState = event.phase === 'start'
          ? 'pending' as const
          : event.phase === 'end'
            ? 'completed' as const
            : 'running' as const

        if (targetMsgId) {
          updateMessageParts(atoms, targetMsgId, (parts) =>
            upsertToolPart(parts, event.toolCallId, {
              toolName: event.toolName,
              state: toolState,
              input: event.phase === 'start' ? event.payload : undefined,
              output: event.phase === 'end' ? event.payload : undefined,
            }),
          )
        }

        // Legacy inlineTasks$ compat
        if (atoms.inlineTasks$) {
          registryUpdate(atoms.inlineTasks$, (prev) => {
            const existing = prev as ReadonlyArray<Record<string, unknown>>
            const idx = existing.findIndex((t) => t.toolCallId === event.toolCallId)
            if (event.phase === 'start' && idx === -1) {
              return [...existing, { toolCallId: event.toolCallId, toolName: event.toolName, phase: 'start', payload: event.payload }]
            } else if (event.phase === 'update' && idx !== -1) {
              const updated = [...existing]
              updated[idx] = { ...updated[idx], phase: 'update', payload: event.payload }
              return updated
            } else if (event.phase === 'end' && idx !== -1) {
              const updated = [...existing]
              updated[idx] = { ...updated[idx], phase: 'end', payload: event.payload }
              return updated
            }
            return prev
          })
        }
        break
      }

      case 'chat:v2/metric': {
        if (atoms.metrics$) {
          registryUpdate(atoms.metrics$, (prev) => [
            ...prev,
            {
              metric: event.metric,
              value: event.value,
              messageId: event.messageId ?? undefined,
              toolCallId: event.toolCallId ?? undefined,
              at: event.at,
            } as MetricEntry,
          ])
        }
        break
      }

      case 'chat:v2/provider_marker': {
        if (atoms.provider$) {
          morphChatRegistry.set(atoms.provider$, {
            provider: event.provider,
            model: event.model ?? undefined,
            at: event.at,
          } as ProviderMarker)
        }
        // Also patch the provider onto the currently streaming message
        const msgs = morphChatRegistry.get(atoms.messages$)
        const streamingMsg = msgs.find((m) => m.status === 'streaming')
        if (streamingMsg) {
          registryUpdate(atoms.messages$, (prev) =>
            prev.map((msg) =>
              msg.id === streamingMsg.id
                ? { ...msg, provider: event.provider }
                : msg,
            ),
          )
        }
        break
      }

      case 'chat:v2/error': {
        morphChatRegistry.set(atoms.connection$, {
          phase: 'error',
          error: `[${event.code}] ${event.message}`,
        } as ConnectionState)
        morphChatRegistry.set(atoms.streaming$, STREAMING_IDLE)
        break
      }

      case 'chat:v2/heartbeat': {
        const latencyMs = Date.now() - event.at
        registryUpdate(atoms.connection$, (prev) => ({
          ...prev,
          latencyMs: latencyMs > 0 ? latencyMs : (prev as any).latencyMs,
        }) as ConnectionState)
        break
      }

      default:
        break
    }
  }

  return { processEvent }
}
