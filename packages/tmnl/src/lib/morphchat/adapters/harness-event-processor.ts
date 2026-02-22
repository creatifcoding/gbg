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
  CodePart,
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
  /** Inline status/interruption rows */
  readonly statusRows$?: Atom.Atom<ReadonlyArray<{
    id: string
    tone: 'info' | 'warn' | 'error'
    text: string
    code?: string
    details?: unknown
    source?: 'harness' | 'mock' | 'surface'
  }>>
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

/**
 * Fence-aware text delta appender.
 *
 * Detects ``` fences in the streaming text and splits into TextPart/CodePart
 * in real-time. Each code block becomes its own CodePart the moment the fence
 * opens — with language, isStreaming=true, and growing code content.
 *
 * When the closing ``` arrives, isStreaming flips to false.
 */
export function appendTextDelta(
  parts: ReadonlyArray<ChatMessagePart>,
  delta: string,
): ReadonlyArray<ChatMessagePart> {
  const arr = [...parts]
  const lastIdx = arr.length - 1
  const last = lastIdx >= 0 ? arr[lastIdx] : null

  // Case 1: Currently inside a streaming code block → append to it
  if (last && last._tag === 'code' && (last as CodePart).isStreaming) {
    const codePart = last as CodePart
    const newCode = codePart.code + delta

    // Check if the closing fence arrived in this delta
    // Look for ``` at start of a line in the NEW content
    const closeFenceIdx = findClosingFence(newCode)
    if (closeFenceIdx >= 0) {
      // Split: code before fence → finalize CodePart, text after fence → new TextPart
      const codeContent = newCode.slice(0, closeFenceIdx)
      const afterFence = newCode.slice(closeFenceIdx).replace(/^```\s*\n?/, '')

      arr[lastIdx] = { ...codePart, code: codeContent, isStreaming: false }
      if (afterFence.length > 0) {
        arr.push({ _tag: 'text' as const, content: afterFence })
      }
    } else {
      arr[lastIdx] = { ...codePart, code: newCode }
    }
    return arr
  }

  // Case 2: Currently in a text part (or no parts yet) → check for opening fence
  if (last && last._tag === 'text') {
    const textPart = last as TextPart
    const combined = textPart.content + delta

    // Check for opening fence: ```lang\n
    const openMatch = findOpeningFence(combined)
    if (openMatch) {
      // Split: text before fence → keep as TextPart, start new CodePart
      const textBefore = combined.slice(0, openMatch.index)
      const codeAfter = combined.slice(openMatch.index + openMatch.fullMatch.length)

      if (textBefore.length > 0) {
        arr[lastIdx] = { ...textPart, content: textBefore }
      } else {
        arr.splice(lastIdx, 1)
      }
      arr.push({
        _tag: 'code' as const,
        code: codeAfter,
        language: openMatch.language || undefined,
        isStreaming: true,
      })
    } else {
      arr[lastIdx] = { ...textPart, content: combined }
    }
    return arr
  }

  // Case 3: Last part is something else (thinking, tool, etc.) → new TextPart
  // But check if delta starts with a fence
  const openMatch = findOpeningFence(delta)
  if (openMatch && openMatch.index === 0) {
    const codeAfter = delta.slice(openMatch.fullMatch.length)
    arr.push({
      _tag: 'code' as const,
      code: codeAfter,
      language: openMatch.language || undefined,
      isStreaming: true,
    })
  } else {
    arr.push({ _tag: 'text' as const, content: delta })
  }
  return arr
}

/** Find an opening fence (```lang\n) — returns match info or null */
function findOpeningFence(text: string): { index: number; fullMatch: string; language: string } | null {
  // Match ``` optionally followed by a language identifier, then a newline
  const re = /^```(\w*)\s*\n/m
  const match = re.exec(text)
  if (!match) return null
  return {
    index: match.index,
    fullMatch: match[0],
    language: match[1] ?? '',
  }
}

/** Find a closing fence (``` at start of line) in code content */
function findClosingFence(code: string): number {
  // The closing fence is ``` at the start of a line (after first line)
  // We search from the second line onwards to avoid matching the opening
  const re = /\n```\s*$/m
  const match = re.exec(code)
  if (match) return match.index + 1 // +1 to skip the \n, point at ```
  // Also handle ``` at the very end without trailing newline
  if (code.endsWith('\n```')) return code.length - 3
  return -1
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

/** Terminal states — once reached, cannot be downgraded by stale events */
const TERMINAL_TOOL_STATES = new Set(['completed', 'error', 'denied'])

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
    const existing = arr[idx] as ToolInvocationPart
    // Guard: never downgrade from a terminal state (completed/error/denied)
    if (TERMINAL_TOOL_STATES.has(existing.state) && !TERMINAL_TOOL_STATES.has(update.state)) {
      return parts // no-op, return original reference
    }
    // Merge update into existing — only overwrite defined (non-undefined) fields.
    // This preserves prior input/output when a later event doesn't carry them.
    const merged: Record<string, unknown> = { ...existing }
    for (const [k, v] of Object.entries(update)) {
      if (v !== undefined) merged[k] = v
    }
    arr[idx] = merged as ToolInvocationPart
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
  /** Called when a tool_manifest event is received. Wired by the adapter to sync the extension bridge. */
  readonly onToolManifest?: (tools: ReadonlyArray<{ name: string; description?: string; parameters?: unknown }>) => void
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
        if (atoms.statusRows$) {
          morphChatRegistry.set(atoms.statusRows$, [])
        }
        break
      }

      case 'chat:v2/tool_manifest': {
        if (config.onToolManifest) {
          config.onToolManifest(event.tools)
        }
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
            // ── Finalize any streaming code parts ──
            finalParts = finalParts.map((p) =>
              p._tag === 'code' && (p as CodePart).isStreaming
                ? { ...p, isStreaming: false } as CodePart
                : p,
            )
            // ── Safety net: split any remaining text→code fences ──
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
        // phase:'stream' is handled by Stream.tap sidecar → toolStreamSink
        if (event.phase === 'stream') break

        const currentMessages = morphChatRegistry.get(atoms.messages$)

        // Find target message: prefer streaming msg, but fall back to any msg
        // containing this toolCallId (handles race where assistant_final arrives
        // before tool_event phase:'end', changing status from 'streaming' to 'sent')
        const streamingMsg = currentMessages.find((m) => m.status === 'streaming')
        const msgWithTool = streamingMsg ?? currentMessages.findLast((m) =>
          m.parts?.some((p) => p._tag === 'tool-invocation' && p.toolCallId === event.toolCallId)
        )
        const targetMsgId = (msgWithTool ?? currentMessages.findLast((m) => m.role === 'assistant'))?.id

        // ── Decode payload based on phase ──
        const payload = event.payload as Record<string, unknown> | undefined

        let toolInput: unknown = undefined
        let toolOutput: unknown = undefined
        let toolState: ToolInvocationPart['state'] = 'running'

        if (event.phase === 'start') {
          toolState = 'running'
          // Multiple start events arrive:
          //   1st: { diagnostics: {...} }           — from PiAiAdapterToolStart (LLM starts generating tool block)
          //   2nd: { arguments: { path: "..." } }   — from PiAiAdapterToolEnd (LLM finished generating, has full args)
          // We want the arguments when available
          if (payload?.arguments) {
            toolInput = payload.arguments
          } else if (payload && !payload.diagnostics) {
            // Flat arguments (backwards compat)
            toolInput = payload
          }
          // If only diagnostics, toolInput stays undefined — upsert merges with existing

        } else if (event.phase === 'update') {
          // Tool argument deltas from PiAiAdapterToolDelta — LLM streaming partial args.
          // Accumulate the delta JSON into the tool part's inputDelta for incremental rendering.
          // These fire during LLM generation, NOT during tool execution.
          if (payload?.delta != null && targetMsgId) {
            updateMessageParts(atoms, targetMsgId, (parts) => {
              const arr = [...parts]
              const idx = arr.findIndex(
                (p) => p._tag === 'tool-invocation' && (p as ToolInvocationPart).toolCallId === event.toolCallId,
              )
              if (idx >= 0) {
                const existing = arr[idx] as ToolInvocationPart
                // Accumulate JSON delta string for partial argument parsing
                const prevDelta = ((existing as any).inputDelta as string) ?? ''
                const newDelta = prevDelta + String(payload.delta)
                arr[idx] = { ...existing, inputDelta: newDelta } as any
              }
              return arr
            })
          }
          break // Don't fall through to upsertToolPart below

        } else if (event.phase === 'end') {
          // phase:'end' = tool EXECUTION completed (result available).
          // NOT "LLM finished generating tool block" (that's phase:'start' with arguments now).
          toolState = (payload?.isError ? 'error' : 'completed') as ToolInvocationPart['state']
          // End payload: { result: [{ type: 'text', text: '...' }], isError, executionMs }
          if (payload?.result) {
            toolOutput = payload.result
          } else {
            toolOutput = payload
          }
        }

        if (targetMsgId) {
          updateMessageParts(atoms, targetMsgId, (parts) =>
            upsertToolPart(parts, event.toolCallId, {
              toolName: event.toolName,
              state: toolState,
              input: toolInput,
              output: toolOutput,
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
        // Mark any streaming message as error
        registryUpdate(atoms.messages$, (prev) =>
          prev.map((msg) =>
            msg.status === 'streaming'
              ? { ...msg, status: 'error' as const, content: msg.content || flattenPartsToText(msg.parts ?? []) }
              : msg,
          ),
        )
        const summary = `[${event.code}] ${event.message}`
        morphChatRegistry.set(atoms.connection$, {
          phase: 'error',
          error: summary,
        } as ConnectionState)

        if (atoms.statusRows$) {
          registryUpdate(atoms.statusRows$, (prev) => ([
            {
              id: `status-${Date.now()}-${event.code}`,
              tone: 'error' as const,
              text: summary,
              code: event.code,
              details: event,
              source: 'harness' as const,
            },
            ...prev,
          ].slice(0, 8)))
        }

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
