/**
 * useHarnessAdapter — Atom.runtime bridge from HarnessRuntime Layer to MorphChatAdapter.
 *
 * Canonical effect-atom pattern:
 *   const rt = Atom.runtime(Layer)
 *   const opAtom = rt.fn<Arg>()((arg, ctx) => Effect.gen(function* () { ... }))
 *   // React: const [result, call] = useAtom(opAtom); call(arg)
 *
 * The runtime keeps the Layer scope alive (WebSocket transport stays open).
 * All harness operations are fn-atoms that yield* HarnessRuntime inside
 * Effect.gen. ctx.set() mutates the materialized view atoms directly.
 *
 * @module morphchat/hooks/useHarnessAdapter
 */

import React, { useEffect, useRef } from 'react'
import { Atom, useAtom, Result } from '@effect-atom/atom-react'
import { Effect, Option, Stream, Fiber } from 'effect'
import {
  toolStreamSink as toolStreamSinkEffect,
  toolStreamFinalize as toolStreamFinalizeEffect,
} from '@/lib/chat/msg/tool-block/renderers/terminal/tool-stream-sink'
import {
  HarnessRuntime,
  HarnessRuntimeBrowserWebSocketDefault,
  HarnessRuntimeError,
} from '@/lib/harness'
import { HarnessBrowserTransport } from '@/lib/harness/HarnessBrowserTransport'
import {
  dispatchShellEvent,
  registerShellCommandSender,
  clearShellCommandSender,
  setShellRegistry,
} from '@/lib/harness/interactive-shell/shell-session-atoms'
import type { ShellEvent } from '@/lib/harness/interactive-shell/schemas'
import type {
  HarnessRole,
  HarnessSessionId,
  HarnessClientMessageId,
  HarnessThinkingLevel,
} from '@/lib/harness/schemas'

/** Valid harness roles — must match HarnessRole schema */
export const HARNESS_ROLES = ['scada-analyst', 'code-assistant', 'navigator', 'inspector', 'general'] as const
import type { MorphChatAdapter } from '../schemas/adapter-types'
import type {
  ChatMessage,
  ConnectionState,
  StreamingState,
  AgentInfo,
  SendParams,
} from '../schemas/message-types'
import { DISCONNECTED, STREAMING_IDLE } from '../schemas/message-types'
import { morphChatRegistry } from '../atoms/registry'

// Wire shell atoms to the morphchat registry
setShellRegistry(morphChatRegistry)

// =============================================================================
// Materialized View Atoms (module-level singletons, mounted to shared registry)
// =============================================================================

export const harnessMessages$ = Atom.make<ReadonlyArray<ChatMessage>>([])
morphChatRegistry.mount(harnessMessages$)

export const harnessConnection$ = Atom.make<ConnectionState>(DISCONNECTED)
morphChatRegistry.mount(harnessConnection$)

export const harnessStreaming$ = Atom.make<StreamingState>(STREAMING_IDLE)
morphChatRegistry.mount(harnessStreaming$)

export const harnessAgents$ = Atom.make<ReadonlyArray<AgentInfo>>([])
morphChatRegistry.mount(harnessAgents$)

// Model selection atoms
export const harnessAvailableModels$ = Atom.make<ReadonlyArray<{
  /** UI selection key (provider-scoped): `${provider}:${modelId}` */
  readonly id: string
  /** Raw model id sent to harness runtime (e.g. gpt-5.3-codex-spark) */
  readonly modelId: string
  readonly label: string
  readonly provider: string
  readonly description?: string
  readonly color?: string
}>>([])
morphChatRegistry.mount(harnessAvailableModels$)

export const harnessSelectedModel$ = Atom.make<string | null>(null)
morphChatRegistry.mount(harnessSelectedModel$)

export interface HarnessStatusRow {
  readonly id: string
  readonly tone: 'info' | 'warn' | 'error'
  readonly text: string
  readonly code?: string
  readonly details?: unknown
  readonly source?: 'harness' | 'surface' | 'mock'
}

export const harnessStatusRows$ = Atom.make<ReadonlyArray<HarnessStatusRow>>([])
morphChatRegistry.mount(harnessStatusRows$)

// Internal: pending model override for next send
const harnessModelOverride$ = Atom.make<{ provider: string; modelId: string } | null>(null)
morphChatRegistry.mount(harnessModelOverride$)

// Metrics from chat:v2/metric events
import type { MetricEntry, ProviderMarker } from '../schemas/metric-types'
export const harnessMetrics$ = Atom.make<ReadonlyArray<MetricEntry>>([])
morphChatRegistry.mount(harnessMetrics$)

// Provider marker from chat:v2/provider_marker events
export const harnessProvider$ = Atom.make<ProviderMarker | null>(null)
morphChatRegistry.mount(harnessProvider$)

// Internal bookkeeping — exported for cross-fn-atom reading via useAtomValue
export const harnessSessionId$ = Atom.make<HarnessSessionId | null>(null)
morphChatRegistry.mount(harnessSessionId$)

const harnessEventFiber$ = Atom.make<Fiber.RuntimeFiber<void, unknown> | null>(null)
morphChatRegistry.mount(harnessEventFiber$)

// =============================================================================
// Runtime Atom — Layer scope stays alive as long as atoms are mounted
// =============================================================================

const harnessRuntimeAtom = Atom.runtime(HarnessRuntimeBrowserWebSocketDefault)

// =============================================================================
// Event Processor (pure function, mutates atoms via ctx.set)
// =============================================================================

// ── Shared event processor with full parts support ────────
import { createEventProcessor } from '../adapters/harness-event-processor'
import { createExtensionToolBridge } from '@/lib/chat/msg/tool-block/renderers/extension-tool-bridge'

// Module-level extension tool bridge — shared across hook instances
const harnessToolBridge = createExtensionToolBridge()

// Module-level processor factory — lazily created per agentName
let _processor: ReturnType<typeof createEventProcessor> | null = null
let _processorAgentName = ''

function getProcessor(agentName: string) {
  if (!_processor || _processorAgentName !== agentName) {
    _processorAgentName = agentName
    _processor = createEventProcessor({
      atoms: {
        messages$: harnessMessages$,
        connection$: harnessConnection$,
        streaming$: harnessStreaming$,
        agents$: harnessAgents$,
        sessionId$: harnessSessionId$,
        metrics$: harnessMetrics$,
        provider$: harnessProvider$,
        statusRows$: harnessStatusRows$,
      },
      agentName,
      onToolManifest: (tools) => {
        const count = harnessToolBridge.syncManifest({ tools })
        if (count > 0) {
          console.info(`[useHarnessAdapter] registered ${count} extension tool renderer(s)`)
        }
      },
    })
  }
  return _processor
}

function pushStatusRow(row: HarnessStatusRow): void {
  morphChatRegistry.update(harnessStatusRows$, (prev) => [row, ...prev].slice(0, 8))
}

function formatUnknownErrorPayload(payload: unknown): { code?: string; message: string; details: unknown } {
  const stringify = (value: unknown) => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  const unwrapOptionLike = (value: unknown): unknown => {
    if (!value || typeof value !== 'object') return value
    const rec = value as Record<string, unknown>
    if (rec._tag === 'Some') return rec.value
    if (rec._tag === 'None') return undefined
    return value
  }

  if (payload instanceof HarnessRuntimeError) {
    const cause = unwrapOptionLike((payload as any).cause)
    const structured = {
      _tag: 'HarnessRuntimeError',
      code: payload.code,
      message: payload.message,
      cause,
    }
    return {
      code: payload.code,
      message: payload.message,
      details: structured,
    }
  }

  if (payload instanceof Error) {
    return {
      code: payload.name,
      message: payload.message,
      details: payload.stack ?? `${payload.name}: ${payload.message}`,
    }
  }

  if (typeof payload === 'string') {
    // Try parsing serialized structured error first.
    try {
      const parsed = JSON.parse(payload) as { code?: string; message?: string }
      if (typeof parsed?.message === 'string') {
        return {
          code: typeof parsed.code === 'string' ? parsed.code : undefined,
          message: parsed.message,
          details: JSON.stringify(parsed, null, 2),
        }
      }
    } catch {
      // plain string fallback
    }
    return { message: payload, details: payload }
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const message = typeof record.message === 'string' ? record.message : stringify(record)
    const code = typeof record.code === 'string' ? record.code : undefined
    return {
      code,
      message,
      details: record,
    }
  }

  return {
    message: String(payload),
    details: String(payload),
  }
}

function runtimeErrorToStatus(op: string, err: HarnessRuntimeError): HarnessStatusRow {
  const parsed = formatUnknownErrorPayload(err)
  const summary = `[${op}] ${parsed.code ? `[${parsed.code}] ` : ''}${parsed.message}`
  return {
    id: `status-${Date.now()}-${op}`,
    tone: 'error',
    text: summary,
    code: parsed.code,
    details: parsed.details,
    source: 'harness',
  }
}

function toNumericThinkingLevel(level?: unknown): number | undefined {
  if (level == null) return undefined
  if (typeof level === 'number') return Number.isNaN(level) ? undefined : level

  if (typeof level === 'string') {
    switch (level) {
      case 'none': return undefined
      case 'low': return 1
      case 'medium': return 2
      case 'high': return 3
      default: return undefined
    }
  }

  return undefined
}

function toHarnessThinkingLevel(level?: unknown): Option.Option<HarnessThinkingLevel> {
  if (typeof level === 'string') {
    switch (level) {
      case 'none': return Option.some('off' as HarnessThinkingLevel)
      case 'low': return Option.some('low' as HarnessThinkingLevel)
      case 'medium': return Option.some('medium' as HarnessThinkingLevel)
      case 'high': return Option.some('high' as HarnessThinkingLevel)
      default: return Option.none()
    }
  }

  const numeric = toNumericThinkingLevel(level)
  if (numeric == null) return Option.none()

  if (numeric <= 0) return Option.some('off' as HarnessThinkingLevel)
  if (numeric <= 1) return Option.some('low' as HarnessThinkingLevel)
  if (numeric <= 2) return Option.some('medium' as HarnessThinkingLevel)
  return Option.some('high' as HarnessThinkingLevel)
}

// =============================================================================
// Operation Atoms — fn<Arg>()((arg, ctx) => Effect.gen(...))
// =============================================================================

export const harnessOps = {
  /**
   * Connect: open session + fork event stream.
   * ctx.set() updates materialized view atoms as events arrive.
   *
   * IMPORTANT: The event stream is subscribed BEFORE openSession so we
   * don't miss the session_opened event. The fiber is forked as a daemon
   * so it survives past this fn-atom's completion — Effect.fork creates
   * a child scope that dies when the parent effect completes, which is
   * the same class of bug we fixed in HarnessBrowserTransport.
   */
  connect: harnessRuntimeAtom.fn<{
    nodeId: string
    role: HarnessRole
    agentName: string
  }>()(({ nodeId, role, agentName }, _ctx) =>
    Effect.gen(function* () {
      const runtime = yield* HarnessRuntime

      // Tear down existing event fiber
      const existingFiber = morphChatRegistry.get(harnessEventFiber$)
      if (existingFiber) {
        yield* Fiber.interrupt(existingFiber)
        morphChatRegistry.set(harnessEventFiber$, null)
      }

      morphChatRegistry.set(harnessConnection$, { phase: 'connecting', endpoint: `harness:${nodeId}` } as ConnectionState)

      // Subscribe to event stream BEFORE openSession so we don't miss
      // the session_opened event (PubSub drops events with no subscribers).
      // forkDaemon detaches the fiber from this fn-atom's scope so it
      // survives past the connect() call returning.
      const processor = getProcessor(agentName)
      const fiber = yield* runtime.events.pipe(
        // Side-channel: intercept phase:'stream' tool events → sidecar registry
        Stream.tap((event) => {
          if (
            event._tag === 'chat:v2/tool_event' &&
            (event as any).phase === 'stream' &&
            (event as any).payload?.chunk != null
          ) {
            return toolStreamSinkEffect({
              toolCallId: (event as any).toolCallId,
              toolName: (event as any).toolName,
              payload: (event as any).payload,
            })
          }
          // Finalize stream on tool end
          if (
            event._tag === 'chat:v2/tool_event' &&
            (event as any).phase === 'end'
          ) {
            return toolStreamFinalizeEffect((event as any).toolCallId)
          }
          return Effect.void
        }),
        Stream.runForEach((event) =>
          Effect.sync(() => processor.processEvent(event)),
        ),
      ).pipe(
        Effect.catchAll((err) =>
          Effect.sync(() => {
            const parsed = formatUnknownErrorPayload(err)
            const summary = `[events] ${parsed.code ? `[${parsed.code}] ` : ''}${parsed.message}`
            morphChatRegistry.set(harnessConnection$, { phase: 'error', error: summary } as ConnectionState)
            pushStatusRow({
              id: `status-${Date.now()}-events`,
              tone: 'error',
              text: summary,
              code: parsed.code,
              details: parsed.details,
              source: 'harness',
            })
          }),
        ),
        Effect.forkDaemon,
      )
      morphChatRegistry.set(harnessEventFiber$, fiber)

      // ── Shell event bridge ─────────────────────────────────────────
      // Fork a second daemon fiber that taps the raw transport events
      // for shell event envelopes and dispatches them to
      // shell-client-atoms listeners (used by InteractiveShellRenderer).
      const transport = yield* HarnessBrowserTransport
      yield* transport.events.pipe(
        Stream.runForEach((rawEvent) =>
          Effect.sync(() => {
            if (
              rawEvent &&
              typeof rawEvent === 'object' &&
              '_tag' in (rawEvent as Record<string, unknown>) &&
              (rawEvent as { _tag: string })._tag === 'remote:shell_event' &&
              'event' in (rawEvent as Record<string, unknown>)
            ) {
              dispatchShellEvent(
                (rawEvent as { event: ShellEvent }).event,
              )
            }
          }),
        ),
      ).pipe(
        Effect.catchAll(() => Effect.void),
        Effect.forkDaemon,
      )

      // Register shell command sender so renderers can send input/resize/kill
      registerShellCommandSender((command) => {
        Effect.runFork(
          transport.request(command as any).pipe(
            Effect.catchAll(() => Effect.void),
          ),
        )
      })

      // Small yield to let the PubSub subscriber register
      yield* Effect.yieldNow()

      // Open session — transport is already connected (eager in Layer)
      const session = yield* runtime.openSession(nodeId, role)
      console.log('[harnessOps.connect] session.sessionId:', session.sessionId)
      morphChatRegistry.set(harnessSessionId$, session.sessionId)

      // Set connected directly — don't rely solely on the session_opened
      // event in case the event stream subscription raced the PubSub publish.
      morphChatRegistry.set(harnessConnection$, {
        phase: 'connected',
        endpoint: `harness:${nodeId}`,
      } as ConnectionState)
      morphChatRegistry.set(harnessAgents$, [{
        id: session.agentId ?? nodeId,
        name: agentName,
        isActive: true,
      }])
      morphChatRegistry.set(harnessStatusRows$, [])

      return session.sessionId as string
    }).pipe(
      Effect.catchTag('HarnessRuntimeError', (error) =>
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            console.error('[harnessOps.connect] runtime error:', error)
            morphChatRegistry.set(harnessConnection$, {
              phase: 'error',
              error: `[${error.code}] ${error.message}`,
            } as ConnectionState)
            pushStatusRow(runtimeErrorToStatus('connect', error))
          })
          return yield* Effect.fail(error)
        }),
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error('[harnessOps.connect] unexpected error:', error)
          const parsed = formatUnknownErrorPayload(error)
          const summary = `[connect] ${parsed.code ? `[${parsed.code}] ` : ''}${parsed.message}`
          morphChatRegistry.set(harnessConnection$, { phase: 'error', error: summary } as ConnectionState)
          pushStatusRow({
            id: `status-${Date.now()}-connect-unexpected`,
            tone: 'error',
            text: summary,
            code: parsed.code,
            details: parsed.details,
            source: 'harness',
          })
        }),
      ),
    ),
  ),

  /**
   * Fetch available models from the server and populate availableModels$.
   */
  fetchModels: harnessRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.gen(function* () {
      const runtime = yield* HarnessRuntime
      const models = yield* runtime.getAvailableModels()

      // Disambiguate duplicate model ids across providers (e.g. openai vs openai-codex)
      const idCounts = new Map<string, number>()
      for (const m of models) {
        idCounts.set(m.id, (idCounts.get(m.id) ?? 0) + 1)
      }

      // Prefer openai-codex entries first when names collide with openai
      const sorted = [...models].sort((a, b) => {
        const pa = a.provider === 'openai-codex' ? -1 : 0
        const pb = b.provider === 'openai-codex' ? -1 : 0
        if (pa !== pb) return pa - pb
        return a.name.localeCompare(b.name)
      })

      morphChatRegistry.set(harnessAvailableModels$, sorted.map((m) => {
        const duplicated = (idCounts.get(m.id) ?? 0) > 1
        return {
          id: `${m.provider}:${m.id}`,
          modelId: m.id,
          label: duplicated ? `${m.name} (${m.provider})` : m.name,
          provider: m.provider,
          description: `${m.provider} · ${m.contextWindow.toLocaleString()} ctx`,
        }
      }))
    }).pipe(
      Effect.catchTag('HarnessRuntimeError', (error) =>
        Effect.sync(() => {
          console.warn('[harnessOps.fetchModels] runtime error:', error)
          pushStatusRow(runtimeErrorToStatus('models', error))
        }),
      ),
      Effect.catchAll((err) =>
        Effect.sync(() => {
          console.warn('[harnessOps.fetchModels] failed:', err)
          const parsed = formatUnknownErrorPayload(err)
          const summary = `[models] ${parsed.code ? `[${parsed.code}] ` : ''}${parsed.message}`
          pushStatusRow({
            id: `status-${Date.now()}-models-unexpected`,
            tone: 'warn',
            text: summary,
            code: parsed.code,
            details: parsed.details,
            source: 'harness',
          })
        }),
      ),
    ),
  ),

  /**
   * Send a message. Optimistic insert as pending, then send to harness.
   * If a model override is pending (from selectModel), attaches it to the send.
   */
  send: harnessRuntimeAtom.fn<{
    content: string
    thinkingLevel?: unknown
  }>()(({ content, thinkingLevel }, _ctx) =>
    Effect.gen(function* () {
      const sessionId = morphChatRegistry.get(harnessSessionId$)
      const runtime = yield* HarnessRuntime
      if (!sessionId) return yield* Effect.fail(new Error('No active session'))

      const clientMessageId = `cmid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as HarnessClientMessageId

      const numericThinkingLevel = toNumericThinkingLevel(thinkingLevel)

      // Optimistic user message
      const userMsg: ChatMessage = {
        id: clientMessageId as string,
        role: 'operator',
        content,
        timestamp: new Date().toISOString(),
        status: 'pending',
        ...(numericThinkingLevel == null ? {} : { thinkingLevel: numericThinkingLevel }),
      }
      morphChatRegistry.set(harnessMessages$, [...morphChatRegistry.get(harnessMessages$), userMsg])

      const tl: Option.Option<HarnessThinkingLevel> = toHarnessThinkingLevel(thinkingLevel)

      // Consume pending model override (one-shot: applied to this message, then cleared)
      const override = morphChatRegistry.get(harnessModelOverride$)
      if (override) morphChatRegistry.set(harnessModelOverride$, null)

      yield* runtime.send(sessionId, clientMessageId, content, tl, override ?? undefined)
    }).pipe(
      Effect.catchTag('HarnessRuntimeError', (error) =>
        Effect.sync(() => {
          console.error('[harnessOps.send] runtime error:', error)
          morphChatRegistry.set(harnessMessages$, morphChatRegistry.get(harnessMessages$).map((msg) =>
            msg.status === 'pending' ? { ...msg, status: 'error' as const } : msg,
          ))
          morphChatRegistry.set(harnessConnection$, {
            phase: 'error',
            error: `[${error.code}] ${error.message}`,
          } as ConnectionState)
          pushStatusRow(runtimeErrorToStatus('send', error))
        }),
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error('[harnessOps.send] unexpected error:', error)
          const parsed = formatUnknownErrorPayload(error)
          const summary = `[send] ${parsed.code ? `[${parsed.code}] ` : ''}${parsed.message}`
          morphChatRegistry.set(harnessMessages$, morphChatRegistry.get(harnessMessages$).map((msg) =>
            msg.status === 'pending' ? { ...msg, status: 'error' as const } : msg,
          ))
          pushStatusRow({
            id: `status-${Date.now()}-send-unexpected`,
            tone: 'error',
            text: summary,
            code: parsed.code,
            details: parsed.details,
            source: 'harness',
          })
        }),
      ),
    ),
  ),

  /**
   * Cancel / abort the active session.
   */
  cancel: harnessRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.gen(function* () {
      const runtime = yield* HarnessRuntime
      const sessionId = morphChatRegistry.get(harnessSessionId$)
      if (sessionId) yield* runtime.abortSession(sessionId)
      // Finalize any streaming message as cancelled
      morphChatRegistry.update(harnessMessages$, (prev) =>
        prev.map((msg) =>
          msg.status === 'streaming' ? { ...msg, status: 'complete' as const } : msg,
        ),
      )
      morphChatRegistry.set(harnessStreaming$, STREAMING_IDLE)
    }).pipe(
      Effect.catchTag('HarnessRuntimeError', (error) =>
        Effect.sync(() => {
          pushStatusRow(runtimeErrorToStatus('cancel', error))
        }),
      ),
    ),
  ),

  /**
   * Full dispose — interrupt event fiber + abort session.
   */
  dispose: harnessRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.gen(function* () {
      const fiber = morphChatRegistry.get(harnessEventFiber$)
      if (fiber) {
        yield* Fiber.interrupt(fiber)
        morphChatRegistry.set(harnessEventFiber$, null)
      }
      const runtime = yield* HarnessRuntime
      const sessionId = morphChatRegistry.get(harnessSessionId$)
      if (sessionId) yield* runtime.abortSession(sessionId)
      // Teardown extension tool bridge (unregisters auto-generated renderers)
      harnessToolBridge.clear()
      // Teardown shell command sender
      clearShellCommandSender()
      morphChatRegistry.set(harnessStreaming$, STREAMING_IDLE)
      morphChatRegistry.set(harnessConnection$, DISCONNECTED)
      morphChatRegistry.set(harnessStatusRows$, [])
    }),
  ),

  /**
   * Clear messages and streaming state.
   */
  clear: harnessRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.sync(() => {
      morphChatRegistry.set(harnessMessages$, [] as ReadonlyArray<ChatMessage>)
      morphChatRegistry.set(harnessStreaming$, STREAMING_IDLE)
      morphChatRegistry.set(harnessStatusRows$, [])
    }),
  ),
}

// =============================================================================
// Hook
// =============================================================================

export interface UseHarnessAdapterConfig {
  readonly nodeId: string
  readonly role: HarnessRole
  readonly agentName?: string
  readonly autoConnect?: boolean
}

export type HarnessAdapterStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface UseHarnessAdapterResult {
  readonly adapter: MorphChatAdapter
  readonly status: HarnessAdapterStatus
  readonly error: string | null
  readonly connect: (args: { nodeId: string; role: HarnessRole; agentName: string }) => void
}

export function useHarnessAdapter(config: UseHarnessAdapterConfig): UseHarnessAdapterResult {
  const { nodeId, role, agentName = 'Agent', autoConnect = true } = config

  // Bind fn-atom setters
  const [connectResult, doConnect] = useAtom(harnessOps.connect)
  const [, doSend] = useAtom(harnessOps.send)
  const [, doCancel] = useAtom(harnessOps.cancel)
  const [, doClear] = useAtom(harnessOps.clear)
  const [, doDispose] = useAtom(harnessOps.dispose)
  const [, doFetchModels] = useAtom(harnessOps.fetchModels)

  // Derive status from connect result — the fn-atom Result tells us
  // whether connect succeeded or failed. For live connection phase,
  // we poll morphChatRegistry directly (works outside provider).
  const connectStatus = Result.isSuccess(connectResult) ? 'connected' as const
    : Result.isFailure(connectResult) ? 'error' as const
    : 'idle' as const

  // Also subscribe to connection atom if we're inside the provider (ThreadView etc.)
  // But for the testbed badge, derive from connectResult which works anywhere.
  const [status, setStatus] = React.useState<HarnessAdapterStatus>('idle')
  const [error, setError] = React.useState<string | null>(null)

  // Poll morphChatRegistry for connection state (works outside provider)
  useEffect(() => {
    const check = () => {
      const conn = morphChatRegistry.get(harnessConnection$) as any
      const phase = conn?.phase ?? 'idle'
      setStatus(
        phase === 'connected' ? 'connected' :
        phase === 'connecting' ? 'connecting' :
        phase === 'error' ? 'error' :
        'idle'
      )
      setError(conn?.error ?? null)
    }
    check()
    // Subscribe to changes on the registry
    const unsub = morphChatRegistry.subscribe(harnessConnection$, check)
    return unsub
  }, [])

  // Auto-connect with retry semantics.
  // Previous "once" behavior could leave live panels stuck after an initial
  // failure (e.g. harness starts late): hasConnected=true prevented re-attempts.
  useEffect(() => {
    if (!autoConnect) return

    if (status === 'connected' || status === 'connecting') return

    // Initial connect + retry-on-error/idle. keep it gentle to avoid tight loops.
    const timer = setTimeout(() => {
      doConnect({ nodeId, role, agentName })
    }, status === 'error' ? 1500 : 0)

    return () => clearTimeout(timer)
  }, [autoConnect, status, nodeId, role, agentName, doConnect])

  // Fetch models once connected
  const hasFetchedModels = useRef(false)
  useEffect(() => {
    if (status === 'connected' && !hasFetchedModels.current) {
      hasFetchedModels.current = true
      doFetchModels(undefined as void)
    }
  }, [status, doFetchModels])

  // Keep latest fn-atom setters in refs so the stable adapter closure always calls current ones
  const sendRef = useRef(doSend)
  sendRef.current = doSend
  const cancelRef = useRef(doCancel)
  cancelRef.current = doCancel
  const connectRef = useRef(doConnect)
  connectRef.current = doConnect
  const clearRef = useRef(doClear)
  clearRef.current = doClear
  const disposeRef = useRef(doDispose)
  disposeRef.current = doDispose

  // Build adapter — stable identity, delegates through refs to always-current setters
  const adapter = useRef<MorphChatAdapter>(null!)
  if (!adapter.current) {
    adapter.current = {
      adapterId: `harness-${nodeId}`,
      label: `Harness (${nodeId})`,
      messages$: harnessMessages$,
      connection$: harnessConnection$,
      streaming$: harnessStreaming$,
      agents$: harnessAgents$,
      metrics$: harnessMetrics$,
      provider$: harnessProvider$,
      statusRows$: harnessStatusRows$,
      availableModels$: harnessAvailableModels$,
      selectedModel$: harnessSelectedModel$,
      selectModel: (modelId: string) => {
        // UI id is provider-scoped (`${provider}:${rawModelId}`)
        const models = morphChatRegistry.get(harnessAvailableModels$)
        const target = models.find((m) => m.id === modelId)
        if (!target) return

        const rawModelId = target.modelId
          ?? (target.id.includes(':') ? target.id.slice(target.id.indexOf(':') + 1) : target.id)

        morphChatRegistry.set(harnessSelectedModel$, modelId)
        morphChatRegistry.set(harnessModelOverride$, {
          provider: target.provider,
          modelId: rawModelId,
        })
      },
      send: (params: SendParams) => {
        sendRef.current({ content: params.content, thinkingLevel: params.thinkingLevel })
        return Effect.void
      },
      cancel: () => { cancelRef.current(undefined as void); return Effect.void },
      reconnect: () => { connectRef.current({ nodeId, role, agentName }); return Effect.void },
      clear: () => { clearRef.current(undefined as void); return Effect.void },
      dispose: () => { disposeRef.current(undefined as void); return Effect.void },
    }
  }

  return { adapter: adapter.current, status, error, connect: doConnect }
}
