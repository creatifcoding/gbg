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
  HarnessRuntime,
  HarnessRuntimeBrowserWebSocketDefault,
} from '@/lib/harness'
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
  readonly id: string
  readonly label: string
  readonly provider: string
  readonly description?: string
  readonly color?: string
}>>([])
morphChatRegistry.mount(harnessAvailableModels$)

export const harnessSelectedModel$ = Atom.make<string | null>(null)
morphChatRegistry.mount(harnessSelectedModel$)

// Internal: pending model override for next send
const harnessModelOverride$ = Atom.make<{ provider: string; modelId: string } | null>(null)
morphChatRegistry.mount(harnessModelOverride$)

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
      },
      agentName,
    })
  }
  return _processor
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
      const fiber = yield* Stream.runForEach(runtime.events, (event) =>
        Effect.sync(() => processor.processEvent(event)),
      ).pipe(
        Effect.catchAll((err) =>
          Effect.sync(() => {
            morphChatRegistry.set(harnessConnection$, { phase: 'error', error: String(err) } as ConnectionState)
          }),
        ),
        Effect.forkDaemon,
      )
      morphChatRegistry.set(harnessEventFiber$, fiber)

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

      return session.sessionId as string
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error('[harnessOps.connect] error:', error)
          morphChatRegistry.set(harnessConnection$, { phase: 'error', error: String(error) } as ConnectionState)
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
      morphChatRegistry.set(harnessAvailableModels$, models.map((m) => ({
        id: m.id,
        label: m.name,
        provider: m.provider,
        description: `${m.provider} · ${m.contextWindow.toLocaleString()} ctx`,
      })))
    }).pipe(
      Effect.catchAll((err) =>
        Effect.sync(() => {
          console.warn('[harnessOps.fetchModels] failed:', err)
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
    thinkingLevel?: number
  }>()(({ content, thinkingLevel }, _ctx) =>
    Effect.gen(function* () {
      const sessionId = morphChatRegistry.get(harnessSessionId$)
      const runtime = yield* HarnessRuntime
      if (!sessionId) return yield* Effect.fail(new Error('No active session'))

      const clientMessageId = `cmid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as HarnessClientMessageId

      // Optimistic user message
      const userMsg: ChatMessage = {
        id: clientMessageId as string,
        role: 'operator',
        content,
        timestamp: new Date().toISOString(),
        status: 'pending',
        thinkingLevel,
      }
      morphChatRegistry.set(harnessMessages$, [...morphChatRegistry.get(harnessMessages$), userMsg])

      const tl: Option.Option<HarnessThinkingLevel> =
        thinkingLevel == null || thinkingLevel === 0 ? Option.none() :
        thinkingLevel <= 1 ? Option.some('minimal' as HarnessThinkingLevel) :
        thinkingLevel <= 2 ? Option.some('low' as HarnessThinkingLevel) :
        thinkingLevel <= 3 ? Option.some('medium' as HarnessThinkingLevel) :
        Option.some('high' as HarnessThinkingLevel)

      // Consume pending model override (one-shot: applied to this message, then cleared)
      const override = morphChatRegistry.get(harnessModelOverride$)
      if (override) morphChatRegistry.set(harnessModelOverride$, null)

      yield* runtime.send(sessionId, clientMessageId, content, tl, override ?? undefined)
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error('[harnessOps.send] ERROR:', error)
          morphChatRegistry.set(harnessMessages$, morphChatRegistry.get(harnessMessages$).map((msg) =>
            msg.status === 'pending' ? { ...msg, status: 'error' as const } : msg,
          ))
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
      morphChatRegistry.set(harnessStreaming$, STREAMING_IDLE)
    }),
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
      morphChatRegistry.set(harnessStreaming$, STREAMING_IDLE)
      morphChatRegistry.set(harnessConnection$, DISCONNECTED)
    }),
  ),

  /**
   * Clear messages and streaming state.
   */
  clear: harnessRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.sync(() => {
      morphChatRegistry.set(harnessMessages$, [] as ReadonlyArray<ChatMessage>)
      morphChatRegistry.set(harnessStreaming$, STREAMING_IDLE)
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

  // Auto-connect once
  const hasConnected = useRef(false)
  useEffect(() => {
    if (autoConnect && !hasConnected.current) {
      hasConnected.current = true
      doConnect({ nodeId, role, agentName })
    }
  }, [autoConnect, nodeId, role, agentName, doConnect])

  // Fetch models once connected
  const hasFetchedModels = useRef(false)
  useEffect(() => {
    if (status === 'connected' && !hasFetchedModels.current) {
      hasFetchedModels.current = true
      doFetchModels(undefined as void)
    }
  }, [status, doFetchModels])

  // Build adapter — stable identity, all state reads go through morphChatRegistry
  const adapter = useRef<MorphChatAdapter>(null!)
  if (!adapter.current) {
    adapter.current = {
      adapterId: `harness-${nodeId}`,
      label: `Harness (${nodeId})`,
      messages$: harnessMessages$,
      connection$: harnessConnection$,
      streaming$: harnessStreaming$,
      agents$: harnessAgents$,
      availableModels$: harnessAvailableModels$,
      selectedModel$: harnessSelectedModel$,
      selectModel: (modelId: string) => {
        // Find provider from available models
        const models = morphChatRegistry.get(harnessAvailableModels$)
        const target = models.find((m) => m.id === modelId)
        if (target) {
          morphChatRegistry.set(harnessSelectedModel$, modelId)
          morphChatRegistry.set(harnessModelOverride$, { provider: target.provider, modelId })
        }
      },
      send: (params: SendParams) =>
        Effect.sync(() => doSend({ content: params.content, thinkingLevel: params.thinkingLevel })),
      cancel: () => Effect.sync(() => doCancel(undefined as void)),
      reconnect: () => Effect.sync(() => doConnect({ nodeId, role, agentName })),
      clear: () => Effect.sync(() => doClear(undefined as void)),
      dispose: () => Effect.sync(() => doDispose(undefined as void)),
    }
  }

  return { adapter: adapter.current, status, error, connect: doConnect }
}
