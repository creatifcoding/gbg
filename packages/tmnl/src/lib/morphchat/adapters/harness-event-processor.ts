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
  UITreePart,
  ConnectionState,
  StreamingState,
  AgentInfo,
} from '../schemas/message-types'
import { STREAMING_IDLE, isStreamingActive, flattenPartsToText } from '../schemas/message-types'
import type { StreamPhase } from '../schemas/message-types'
import { morphChatRegistry } from '../atoms/registry'
import type { HarnessEvent } from '@/lib/harness/schemas'
import type { MetricEntry, ProviderMarker } from '../schemas/metric-types'
import { splitPartsCodeFences } from './markdown-code-splitter'
import { streamingLatencyProbe } from '@/lib/harness/perf/StreamingLatencyProbe'
import { startWatchdog, type WatchdogHandle } from './stream-watchdog'
import { UIElement, UITree } from '@/lib/genifer/core/schemas'
import { appendToSessionV2, chatMessageToSessionMessage } from '@/lib/harness/session/v2/facade'

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
  /** Context usage from chat:v2/context events */
  readonly contextUsage$?: Atom.Atom<{
    readonly contextTokens: number
    readonly contextWindow: number
    readonly contextPercent: number
    readonly totalInput: number
    readonly totalOutput: number
    readonly totalCacheRead: number
    readonly totalCacheWrite: number
    readonly totalCost: number
    readonly compactionMode: 'auto' | 'manual' | 'disabled'
    readonly compactionStatus: 'idle' | 'compacting' | 'completed'
    readonly compactionCount: number
  } | null>
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

/**
 * Update message parts in messages$ only.
 * Sync bridge propagates to per-message atoms automatically.
 */
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

      // ── ```ui fence intercept: attempt UITree parse on close ──
      if (codePart.language === 'ui') {
        const uiTreePart = tryParseUITreePart(codeContent)
        if (uiTreePart) {
          arr[lastIdx] = uiTreePart
        } else {
          // Parse failed — keep as normal code block (graceful fallback)
          arr[lastIdx] = { ...codePart, code: codeContent, isStreaming: false }
        }
      } else {
        arr[lastIdx] = { ...codePart, code: codeContent, isStreaming: false }
      }

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

/**
 * Attempt to parse a ```ui fence body (NDJSON) as a UITree.
 * Returns a UITreePart on success, null on any failure.
 * Failures are silent — the caller falls back to a normal CodePart.
 *
 * NDJSON format: each line is a JSON object.
 *   {"root":"key"}                                    — sets root
 *   {"key":"x","type":"y","props":{...},"children":[]} — adds element
 */
function tryParseUITreePart(source: string): UITreePart | null {
  try {
    const lines = source.split('\n')
    let root = ''
    const elements: Record<string, InstanceType<typeof UIElement>> = {}

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('{')) continue
      const obj = JSON.parse(trimmed)

      // Root declaration
      if (typeof obj.root === 'string' && !obj.type) {
        root = obj.root
        continue
      }

      // Element addition
      if (typeof obj.type === 'string') {
        const key = typeof obj.key === 'string' ? obj.key : ''
        if (!key) continue
        elements[key] = new UIElement({
          type: obj.type,
          key,
          props: (obj.props && typeof obj.props === 'object' ? obj.props : {}) as Record<string, unknown>,
          children: Array.isArray(obj.children) ? obj.children.filter((c: unknown) => typeof c === 'string') : [],
          parentKey: typeof obj.parentKey === 'string' ? obj.parentKey : undefined,
          className: typeof obj.className === 'string' ? obj.className : undefined,
        })
      }
    }

    if (!root || Object.keys(elements).length === 0) return null

    const tree = UITree.fromRecord(root, elements)
    return { _tag: 'ui-tree' as const, tree, source: source.trim() }
  } catch {
    return null
  }
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
const TERMINAL_TOOL_STATES = new Set(['completed', 'error', 'denied', 'cancelled'])

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
  /** Per-message atom IDs — only updated on add/remove */
  readonly messageIds$?: Atom.WritableAtom<ReadonlyArray<string>>
  /** Get per-message atom for isolated writes */
  readonly getMessageAtom?: (messageId: string) => Atom.WritableAtom<ChatMessage | null>
  /** Called when a tool_manifest event is received. Wired by the adapter to sync the extension bridge. */
  readonly onToolManifest?: (tools: ReadonlyArray<{ name: string; description?: string; parameters?: unknown }>) => void
  /** Morphchat instance ID — used for session v2 shadow writes */
  readonly instanceId?: string
}



export function createEventProcessor(config: HarnessEventProcessorConfig) {
  const { atoms, agentName, nodeId } = config
  let thinkingStartTime: number | null = null
  let watchdog: WatchdogHandle | null = null

  // ── Watchdog status row helper ──────────────────────────────────────
  const pushWatchdogStatusRow = (row: {
    id: string
    tone: 'info' | 'warn' | 'error'
    text: string
    source: 'harness' | 'mock' | 'surface'
  }) => {
    if (atoms.statusRows$) {
      registryUpdate(atoms.statusRows$, (prev) => [row, ...prev].slice(0, 8))
    }
  }

  // ── rAF-coalesced delta flush (S4 strategy from coalescing research) ──
  // Accumulate deltas, flush once per animation frame (~16ms at 60fps).
  // Prevents main-thread starvation while keeping latency minimal.
  const pendingDeltaByMessage = new Map<string, string>()
  const pendingTokenCountByMessage = new Map<string, number>()
  let pendingSeqsByMessage: Map<string, number[]> | null = null
  let rafHandle: number | null = null

  const flushPendingDeltas = () => {
    rafHandle = null
    if (pendingDeltaByMessage.size === 0 && pendingTokenCountByMessage.size === 0) return

    const deltas = new Map(pendingDeltaByMessage)
    const tokenCounts = new Map(pendingTokenCountByMessage)
    const flushSeqs = pendingSeqsByMessage
    pendingDeltaByMessage.clear()
    pendingTokenCountByMessage.clear()
    pendingSeqsByMessage = null

    registryUpdate(atoms.streaming$, (prev) => {
      const msgId = prev.messageId ?? ''
      const delta = deltas.get(msgId) ?? ''
      const tokenCount = tokenCounts.get(msgId) ?? 0
      if (delta.length === 0 && tokenCount === 0) return prev
      return {
        ...prev,
        buffer: prev.buffer + delta,
        tokensReceived: (prev.tokensReceived ?? 0) + tokenCount,
      }
    })

    for (const [msgId, delta] of deltas) {
      if (config.getMessageAtom) {
        // Per-message atom path — isolated, only this message's subscribers re-render
        const msgAtom = config.getMessageAtom(msgId)
        morphChatRegistry.update(msgAtom, (prev) => {
          if (!prev) return prev
          const nextParts = appendTextDelta(prev.parts ?? [], delta)
          const nextContent = flattenPartsToText(nextParts)
          return { ...prev, parts: nextParts, content: nextContent || prev.content }
        })
      } else {
        // Legacy array path — updates entire messages$ array
        registryUpdate(atoms.messages$, (prev) =>
          prev.map((msg) => {
            if (msg.id !== msgId) return msg
            const nextParts = appendTextDelta(msg.parts ?? [], delta)
            const nextContent = flattenPartsToText(nextParts)
            return { ...msg, parts: nextParts, content: nextContent || msg.content }
          }),
        )
      }
    }

    // Latency probe: stamp all seq values in this rAF batch
    if (flushSeqs) {
      for (const seqs of flushSeqs.values()) {
        for (const seq of seqs) {
          streamingLatencyProbe.stamp(seq, 'atom_flush')
        }
      }
    }
  }

  const scheduleRafFlush = () => {
    if (rafHandle != null) return
    rafHandle = typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame(flushPendingDeltas)
      : (setTimeout(flushPendingDeltas, 16) as unknown as number) // SSR fallback
  }

  /**
   * Update a message in messages$ only. The sync bridge in useHarnessAdapter
   * handles propagation to per-message atoms and messageIds$.
   *
   * Do NOT write to per-message atoms here — that races with the sync bridge
   * and causes double notifications (duplicate renders).
   */
  const updateMessageInArray = (
    messageId: string,
    updater: (message: ChatMessage) => ChatMessage,
  ): ChatMessage | null => {
    let updated: ChatMessage | null = null

    registryUpdate(atoms.messages$, (prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg
        const next = updater(msg)
        updated = next
        return next
      }),
    )

    return updated
  }

  function processEvent(event: HarnessEvent): void {
    // ── Phase guard: 'cancelling' blocks stale events ──────────────────
    // During user-initiated cancellation, only terminal events are allowed.
    // Delta/thinking/tool events arriving after local cancel are dropped.
    const currentPhase = morphChatRegistry.get(atoms.streaming$).phase
    if (currentPhase === 'cancelling') {
      const TERMINAL_EVENTS = new Set([
        'chat:v2/response_done',
        'chat:v2/error',
        'chat:v2/usage',
        'chat:v2/heartbeat',
        'chat:v2/session_opened',
      ])
      if (!TERMINAL_EVENTS.has(event._tag)) return

      // Special: 'aborted' error during 'cancelling' = expected confirmation.
      // Skip error UI — just finalize to idle.
      if (event._tag === 'chat:v2/error' && (event as any).code === 'aborted') {
        if (watchdog) { watchdog.stop(); watchdog = null }
        morphChatRegistry.set(atoms.streaming$, STREAMING_IDLE)
        return
      }
    }

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
        // Write to messages$ only — sync bridge handles messageIds$ + per-message atoms.
        // Direct writes here would race with the sync bridge and cause duplicates.
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
        // for the intermediate tool-calling turn).
        // Write to messages$ only — sync bridge handles messageIds$ + per-message atoms.
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
        // Dedup guard: don't append if a message with this ID already exists
        // (seenSeqs should prevent this, but defensive against edge cases)
        registryUpdate(atoms.messages$, (prev) =>
          prev.some((m) => m.id === streamMsg.id) ? prev : [...prev, streamMsg],
        )
        // Sync bridge fires on messages$ change → updates messageIds$ and per-message atoms.
        // Do NOT write to messageIds$/getMessageAtom here — that races with the sync bridge.
        const now = Date.now()
        const currentSessionId = atoms.sessionId$
          ? morphChatRegistry.get(atoms.sessionId$) ?? undefined
          : undefined
        morphChatRegistry.set(atoms.streaming$, {
          phase: 'waiting' as StreamPhase,
          buffer: '',
          messageId: event.messageId as string,
          tokensReceived: 0,
          sessionId: currentSessionId,
          startedAt: now,
          lastEventAt: now,
        })
        thinkingStartTime = null

        // ── Fork streaming watchdog fiber ──────────────────────────────
        if (watchdog) watchdog.stop() // Stop any stale watchdog from previous stream
        watchdog = startWatchdog(atoms.streaming$, atoms.messages$, pushWatchdogStatusRow)

        break
      }

      case 'chat:v2/assistant_delta': {
        if (typeof event.seq === 'number') {
          streamingLatencyProbe.stamp(event.seq, 'processor')
        }
        const msgId = event.messageId as string
        const delta = event.delta as string

        // Phase transition: waiting → receiving on first delta + touch watchdog
        if (watchdog) watchdog.touch()
        {
          const cur = morphChatRegistry.get(atoms.streaming$)
          if (cur.phase === 'waiting' || cur.phase === 'receiving') {
            morphChatRegistry.set(atoms.streaming$, {
              ...cur,
              phase: 'receiving' as StreamPhase,
              lastEventAt: Date.now(),
              tokensReceived: (cur.tokensReceived ?? 0) + 1,
            })
          }
        }

        // Accumulate delta text — rAF flush writes to atoms once per paint frame
        pendingDeltaByMessage.set(msgId, (pendingDeltaByMessage.get(msgId) ?? '') + delta)
        pendingTokenCountByMessage.set(msgId, (pendingTokenCountByMessage.get(msgId) ?? 0) + 1)
        // Track seq values for latency probe
        if (!pendingSeqsByMessage) pendingSeqsByMessage = new Map()
        const seqs = pendingSeqsByMessage.get(msgId) ?? []
        if (typeof event.seq === 'number') seqs.push(event.seq)
        pendingSeqsByMessage.set(msgId, seqs)

        scheduleRafFlush()
        break
      }

      case 'chat:v2/assistant_thinking_delta': {
        const msgId = event.messageId as string
        if (thinkingStartTime === null) {
          thinkingStartTime = Date.now()
        }
        // Touch watchdog — thinking deltas keep the stream alive
        if (watchdog) watchdog.touch()
        {
          const cur = morphChatRegistry.get(atoms.streaming$)
          if (cur.phase === 'waiting' || cur.phase === 'receiving') {
            morphChatRegistry.set(atoms.streaming$, {
              ...cur,
              phase: 'receiving' as StreamPhase,
              lastEventAt: Date.now(),
            })
          }
        }
        updateMessageParts(atoms, msgId, (parts) => appendThinkingDelta(parts, event.delta))
        break
      }

      case 'chat:v2/assistant_final': {
        // Phase transition: receiving → finalizing (awaiting response_done)
        {
          const cur = morphChatRegistry.get(atoms.streaming$)
          if (cur.phase === 'waiting' || cur.phase === 'receiving') {
            morphChatRegistry.set(atoms.streaming$, {
              ...cur,
              phase: 'finalizing' as StreamPhase,
              lastEventAt: Date.now(),
            })
          }
        }

        // Flush any pending rAF-coalesced deltas before finalizing
        if (rafHandle != null) {
          cancelAnimationFrame(rafHandle)
          rafHandle = null
        }
        flushPendingDeltas()

        const msgId = event.messageId as string
        const thinkingDuration = thinkingStartTime != null
          ? Date.now() - thinkingStartTime
          : undefined
        thinkingStartTime = null

        const finalizeMessage = (msg: ChatMessage): ChatMessage => {
          let finalParts = finalizeThinking(msg.parts ?? [], thinkingDuration)
          // Finalize any streaming code parts in-place
          finalParts = finalParts.map((p) =>
            p._tag === 'code' && (p as CodePart).isStreaming
              ? { ...p, isStreaming: false } as CodePart
              : p,
          )
          // Split any remaining text parts that contain code fences
          finalParts = splitPartsCodeFences(finalParts)
          // content = canonical server text (for serialization/search/copy).
          // parts = what was actually streamed, finalized.
          return {
            ...msg,
            content: event.text,
            status: 'complete' as const,
            parts: finalParts,
          }
        }

        let finalizedMsg: ChatMessage | null = null
        if (config.getMessageAtom) {
          // Per-message atom path: finalize from the per-message atom (canonical during streaming),
          // then sync back to messages$ for serialization.
          const msgAtom = config.getMessageAtom(msgId)
          const current = morphChatRegistry.get(msgAtom)
          if (current) {
            finalizedMsg = finalizeMessage(current)
            morphChatRegistry.set(msgAtom, finalizedMsg)
          }
          // Sync finalized state back to messages$ (one write, not updateMessageInArray)
          if (finalizedMsg) {
            const nextFinalized = finalizedMsg
            registryUpdate(atoms.messages$, (prev) =>
              prev.map((msg) => (msg.id === msgId ? nextFinalized : msg)),
            )
          }
        } else {
          // Legacy path: finalize via messages$ array
          finalizedMsg = updateMessageInArray(msgId, finalizeMessage)
        }

        // ── Session V2: shadow-write finalized assistant message ──────
        if (config.instanceId && finalizedMsg) {
          appendToSessionV2(config.instanceId, chatMessageToSessionMessage(finalizedMsg))
        }

        // ── Stop watchdog fiber — stream completed normally ──────────
        if (watchdog) { watchdog.stop(); watchdog = null }
        morphChatRegistry.set(atoms.streaming$, STREAMING_IDLE)
        break
      }

      case 'chat:v2/usage': {
        const usageId = event.messageId as string
        updateMessageInArray(usageId, (msg) => ({
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
        }))
        break
      }

      case 'chat:v2/context': {
        if (!atoms.contextUsage$) break

        morphChatRegistry.set(atoms.contextUsage$, {
          contextTokens: event.contextTokens,
          contextWindow: event.contextWindow,
          contextPercent: event.contextPercent,
          totalInput: event.totalInput,
          totalOutput: event.totalOutput,
          totalCacheRead: event.totalCacheRead,
          totalCacheWrite: event.totalCacheWrite,
          totalCost: event.totalCost,
          compactionMode: event.compactionMode,
          compactionStatus: event.compactionStatus,
          compactionCount: event.compactionCount,
        })
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
        const targetMsgId = (msgWithTool ?? currentMessages.findLast((m) => m.role === 'agent' || m.role === 'assistant'))?.id

        const existingToolPart = targetMsgId
          ? currentMessages
              .find((m) => m.id === targetMsgId)
              ?.parts?.find((p) => p._tag === 'tool-invocation' && (p as ToolInvocationPart).toolCallId === event.toolCallId) as ToolInvocationPart | undefined
          : undefined

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
          // Two kinds of update events:
          // 1. Tool argument deltas (payload.delta) — LLM streaming partial args
          // 2. Tool execution details (payload.details) — progressive output (e.g., genifer partial tree)
          //
          // Old behavior only patched existing parts and bypassed terminal-state guards.
          // This caused dropped streams when start raced, and stale updates could clobber
          // completed outputs. We now route update writes through upsertToolPart.
          if (!targetMsgId) break

          const deltaChunk = payload?.delta != null ? String(payload.delta) : null
          const detailsChunk = payload?.details != null ? payload.details : null

          if (deltaChunk == null && detailsChunk == null) break

          const updateParts = (parts: ReadonlyArray<ChatMessagePart>) => {
            const existing = parts.find(
              (p) => p._tag === 'tool-invocation' && (p as ToolInvocationPart).toolCallId === event.toolCallId,
            ) as ToolInvocationPart | undefined

            const nextState: ToolInvocationPart['state'] =
              existing && !TERMINAL_TOOL_STATES.has(existing.state)
                ? existing.state
                : 'running'

            let nextOutput: unknown = undefined
            if (detailsChunk != null) {
              const prevOutput = (existing?.output ?? null) as Record<string, unknown> | null
              const prevDetails = prevOutput && typeof prevOutput === 'object'
                ? ('details' in prevOutput
                    ? (prevOutput.details as Record<string, unknown> | undefined)
                    : prevOutput)
                : undefined

              const mergedDetails = detailsChunk && typeof detailsChunk === 'object'
                ? { ...(prevDetails ?? {}), ...(detailsChunk as Record<string, unknown>) }
                : prevDetails

              if (mergedDetails) {
                nextOutput = { ...(prevOutput ?? {}), details: mergedDetails }
              }
            }

            const baseUpdated = upsertToolPart(parts, event.toolCallId, {
              toolName: event.toolName,
              state: nextState,
              output: nextOutput,
            })

            if (deltaChunk == null) {
              return baseUpdated
            }

            const arr = [...baseUpdated]
            const idx = arr.findIndex(
              (p) => p._tag === 'tool-invocation' && (p as ToolInvocationPart).toolCallId === event.toolCallId,
            )

            if (idx < 0) return baseUpdated

            const upserted = arr[idx] as ToolInvocationPart
            const prevDelta = ((upserted as any).inputDelta as string | undefined) ?? ''
            arr[idx] = { ...upserted, inputDelta: prevDelta + deltaChunk } as any
            return arr
          }

          if (config.getMessageAtom) {
            const msgAtom = config.getMessageAtom(targetMsgId)
            morphChatRegistry.update(msgAtom, (prev) => {
              if (!prev) return prev
              const nextParts = updateParts(prev.parts ?? [])
              const nextContent = flattenPartsToText(nextParts)
              return { ...prev, parts: nextParts, content: nextContent || prev.content }
            })
          } else {
            updateMessageParts(atoms, targetMsgId, updateParts)
          }

          break // Don't fall through to upsertToolPart below

        } else if (event.phase === 'end') {
          // phase:'end' = tool EXECUTION completed (result available).
          // NOT "LLM finished generating tool block" (that's phase:'start' with arguments now).
          toolState = (payload?.isError ? 'error' : 'completed') as ToolInvocationPart['state']
          // End payload: { result: [{ type: 'text', text: '...' }], details: {...}, isError, executionMs }
          if (payload?.result) {
            const prevOutput = (existingToolPart?.output ?? null) as Record<string, unknown> | null
            const prevDetails = prevOutput && typeof prevOutput === 'object'
              ? ('details' in prevOutput
                  ? (prevOutput.details as Record<string, unknown> | undefined)
                  : prevOutput)
              : undefined

            const nextDetails = payload.details && typeof payload.details === 'object'
              ? { ...(prevDetails ?? {}), ...(payload.details as Record<string, unknown>) }
              : prevDetails

            // Preserve prior treeSnapshot/details if end payload omits them.
            toolOutput = nextDetails
              ? { result: payload.result, details: nextDetails }
              : payload.result
          } else {
            toolOutput = payload
          }
        }

        if (targetMsgId) {
          updateMessageParts(
            atoms,
            targetMsgId,
            (parts) =>
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
        const markerTag = (event.marker as { _tag?: unknown } | undefined)?._tag
        const isHighFrequencyMarker = markerTag === 'provider:marker/text_delta'

        // text_delta markers are extremely hot-path; skip all state work for them.
        if (isHighFrequencyMarker) {
          break
        }

        // Provider metadata is effectively stable for a run; update only on change.
        if (atoms.provider$) {
          const currentProvider = morphChatRegistry.get(atoms.provider$)
          if (
            !currentProvider ||
            currentProvider.provider !== event.provider ||
            currentProvider.model !== (event.model ?? undefined)
          ) {
            morphChatRegistry.set(atoms.provider$, {
              provider: event.provider,
              model: event.model ?? undefined,
              at: event.at,
            } as ProviderMarker)
          }
        }

        // Patch provider onto active streaming message only when it changes.
        const msgs = morphChatRegistry.get(atoms.messages$)
        const streamingMsg = msgs.find((m) => m.status === 'streaming')
        if (streamingMsg && streamingMsg.provider !== event.provider) {
          updateMessageInArray(streamingMsg.id, (msg) => ({
            ...msg,
            provider: event.provider,
          }))
        }
        break
      }

      case 'chat:v2/error': {
        // Mark any streaming message as error.
        // Write to messages$ only — sync bridge handles per-message atoms.
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

        // ── Stop watchdog fiber — error received ──────────────────────
        if (watchdog) { watchdog.stop(); watchdog = null }
        morphChatRegistry.set(atoms.streaming$, STREAMING_IDLE)
        break
      }

      case 'chat:v2/heartbeat': {
        // Touch watchdog — heartbeats keep the stream alive during thinking pauses
        if (watchdog) watchdog.touch()
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

  /** Stop the watchdog fiber (called from adapter.cancel()) */
  const stopWatchdog = () => {
    if (watchdog) { watchdog.stop(); watchdog = null }
  }

  return { processEvent, stopWatchdog }
}
