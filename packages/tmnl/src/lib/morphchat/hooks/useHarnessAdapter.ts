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

import { useEffect, useRef, useCallback } from 'react'
import { Atom, useAtomValue, useAtom, Result } from '@effect-atom/atom-react'
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
  HarnessEvent,
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

// =============================================================================
// Materialized View Atoms (module-level singletons)
// =============================================================================

export const harnessMessages$ = Atom.make<ReadonlyArray<ChatMessage>>([])
export const harnessConnection$ = Atom.make<ConnectionState>(DISCONNECTED)
export const harnessStreaming$ = Atom.make<StreamingState>(STREAMING_IDLE)
export const harnessAgents$ = Atom.make<ReadonlyArray<AgentInfo>>([])

// Internal bookkeeping — exported for cross-fn-atom reading via useAtomValue
export const harnessSessionId$ = Atom.make<HarnessSessionId | null>(null)
const harnessEventFiber$ = Atom.make<Fiber.RuntimeFiber<void, unknown> | null>(null)

// =============================================================================
// Runtime Atom — Layer scope stays alive as long as atoms are mounted
// =============================================================================

const harnessRuntimeAtom = Atom.runtime(HarnessRuntimeBrowserWebSocketDefault)

// =============================================================================
// Event Processor (pure function, mutates atoms via ctx.set)
// =============================================================================

function processEvent(
  event: HarnessEvent,
  agentName: string,
  ctx: { set: <A>(atom: Atom.Writable<A, A>, value: A | ((prev: A) => A)) => void },
): void {
  console.log('[processEvent]', event._tag, (event as any).messageId ?? (event as any).sessionId ?? '')
  switch (event._tag) {
    case 'chat:v2/session_opened':
      ctx.set(harnessSessionId$, event.sessionId)
      ctx.set(harnessConnection$, { phase: 'connected', endpoint: `harness:${event.nodeId ?? ''}` } as ConnectionState)
      ctx.set(harnessAgents$, [{ id: event.agentId, name: agentName, isActive: true }])
      break

    case 'chat:v2/send_accepted':
      ctx.set(harnessMessages$, ((prev: ReadonlyArray<ChatMessage>) =>
        prev.map((msg) => msg.status === 'pending' ? { ...msg, status: 'sent' as const } : msg),
      ) as any)
      break

    case 'chat:v2/assistant_start': {
      const streamMsg: ChatMessage = {
        id: event.messageId as string,
        role: 'agent',
        authorName: agentName,
        content: '',
        timestamp: new Date(event.at).toISOString(),
        status: 'streaming',
      }
      ctx.set(harnessMessages$, ((prev: ReadonlyArray<ChatMessage>) => [...prev, streamMsg]) as any)
      ctx.set(harnessStreaming$, { isStreaming: true, buffer: '', messageId: event.messageId as string } as StreamingState)
      break
    }

    case 'chat:v2/assistant_delta':
      ctx.set(harnessStreaming$, ((prev: StreamingState) => ({ ...prev, buffer: prev.buffer + event.delta })) as any)
      ctx.set(harnessMessages$, ((prev: ReadonlyArray<ChatMessage>) =>
        prev.map((msg) =>
          msg.id === (event.messageId as string) && msg.status === 'streaming'
            ? { ...msg, content: msg.content + event.delta }
            : msg,
        ),
      ) as any)
      break

    case 'chat:v2/assistant_final':
      ctx.set(harnessMessages$, ((prev: ReadonlyArray<ChatMessage>) =>
        prev.map((msg) =>
          msg.id === (event.messageId as string)
            ? { ...msg, content: event.text, status: 'complete' as const }
            : msg,
        ),
      ) as any)
      ctx.set(harnessStreaming$, STREAMING_IDLE)
      break

    case 'chat:v2/usage':
      ctx.set(harnessMessages$, ((prev: ReadonlyArray<ChatMessage>) =>
        prev.map((msg) =>
          msg.id === (event.messageId as string)
            ? {
                ...msg,
                model: event.model,
                tokenUsage: {
                  prompt: event.usage.input,
                  completion: event.usage.output,
                  total: event.usage.totalTokens,
                },
              }
            : msg,
        ),
      ) as any)
      break

    case 'chat:v2/error':
      ctx.set(harnessConnection$, { phase: 'error', error: `[${event.code}] ${event.message}` } as ConnectionState)
      ctx.set(harnessStreaming$, STREAMING_IDLE)
      break

    case 'chat:v2/heartbeat': {
      const latencyMs = Date.now() - event.at
      ctx.set(harnessConnection$, ((prev: ConnectionState) => ({
        ...prev,
        latencyMs: latencyMs > 0 ? latencyMs : (prev as any).latencyMs,
      })) as any)
      break
    }

    default:
      break
  }
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
  }>()(({ nodeId, role, agentName }, ctx) =>
    Effect.gen(function* () {
      const runtime = yield* HarnessRuntime

      // Tear down existing event fiber
      const existingFiber = ctx(harnessEventFiber$)
      if (existingFiber) {
        yield* Fiber.interrupt(existingFiber)
        ctx.set(harnessEventFiber$, null)
      }

      ctx.set(harnessConnection$, { phase: 'connecting', endpoint: `harness:${nodeId}` } as ConnectionState)

      // Subscribe to event stream BEFORE openSession so we don't miss
      // the session_opened event (PubSub drops events with no subscribers).
      // forkDaemon detaches the fiber from this fn-atom's scope so it
      // survives past the connect() call returning.
      const fiber = yield* Stream.runForEach(runtime.events, (event) =>
        Effect.sync(() => processEvent(event, agentName, ctx)),
      ).pipe(
        Effect.catchAll((err) =>
          Effect.sync(() => {
            ctx.set(harnessConnection$, { phase: 'error', error: String(err) } as ConnectionState)
          }),
        ),
        Effect.forkDaemon,
      )
      ctx.set(harnessEventFiber$, fiber)

      // Small yield to let the PubSub subscriber register
      yield* Effect.yieldNow()

      // Open session — transport is already connected (eager in Layer)
      const session = yield* runtime.openSession(nodeId, role)
      console.log('[harnessOps.connect] session.sessionId:', session.sessionId)
      ctx.set(harnessSessionId$, session.sessionId)
      const readBack = ctx(harnessSessionId$)
      console.log('[harnessOps.connect] readBack after set:', readBack)

      // Set connected directly — don't rely solely on the session_opened
      // event in case the event stream subscription raced the PubSub publish.
      ctx.set(harnessConnection$, {
        phase: 'connected',
        endpoint: `harness:${nodeId}`,
      } as ConnectionState)
      ctx.set(harnessAgents$, [{
        id: session.agentId ?? nodeId,
        name: agentName,
        isActive: true,
      }])

      return session.sessionId as string
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error('[harnessOps.connect] error:', error)
          ctx.set(harnessConnection$, { phase: 'error', error: String(error) } as ConnectionState)
        }),
      ),
    ),
  ),

  /**
   * Send a message. Optimistic insert as pending, then send to harness.
   */
  send: harnessRuntimeAtom.fn<{
    content: string
    thinkingLevel?: number
    sessionId: HarnessSessionId | null
  }>()(({ content, thinkingLevel, sessionId }, ctx) =>
    Effect.gen(function* () {
      console.log('[harnessOps.send] enter, content:', content?.slice(0, 40), 'sessionId:', sessionId)
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
      ctx.set(harnessMessages$, ((prev: ReadonlyArray<ChatMessage>) => [...prev, userMsg]) as any)
      console.log('[harnessOps.send] optimistic insert done, calling runtime.send...')

      const tl: Option.Option<HarnessThinkingLevel> =
        thinkingLevel == null || thinkingLevel === 0 ? Option.none() :
        thinkingLevel <= 1 ? Option.some('minimal' as HarnessThinkingLevel) :
        thinkingLevel <= 2 ? Option.some('low' as HarnessThinkingLevel) :
        thinkingLevel <= 3 ? Option.some('medium' as HarnessThinkingLevel) :
        Option.some('high' as HarnessThinkingLevel)

      yield* runtime.send(sessionId, clientMessageId, content, tl)
      console.log('[harnessOps.send] ✓ runtime.send completed')
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error('[harnessOps.send] ERROR:', error)
          // Mark pending → error
          ctx.set(harnessMessages$, ((prev: ReadonlyArray<ChatMessage>) =>
            prev.map((msg) => msg.status === 'pending' ? { ...msg, status: 'error' as const } : msg),
          ) as any)
        }),
      ),
    ),
  ),

  /**
   * Cancel / abort the active session.
   */
  cancel: harnessRuntimeAtom.fn<{ sessionId: HarnessSessionId | null }>()(({ sessionId }, ctx) =>
    Effect.gen(function* () {
      const runtime = yield* HarnessRuntime
      if (sessionId) yield* runtime.abortSession(sessionId)
      ctx.set(harnessStreaming$, STREAMING_IDLE)
    }),
  ),

  /**
   * Full dispose — interrupt event fiber + abort session.
   */
  dispose: harnessRuntimeAtom.fn<{ sessionId: HarnessSessionId | null }>()(({ sessionId }, ctx) =>
    Effect.gen(function* () {
      const fiber = ctx(harnessEventFiber$)
      if (fiber) {
        yield* Fiber.interrupt(fiber)
        ctx.set(harnessEventFiber$, null)
      }
      const runtime = yield* HarnessRuntime
      if (sessionId) yield* runtime.abortSession(sessionId)
      ctx.set(harnessStreaming$, STREAMING_IDLE)
      ctx.set(harnessConnection$, DISCONNECTED)
    }),
  ),

  /**
   * Clear messages and streaming state.
   */
  clear: harnessRuntimeAtom.fn<void>()((_arg, ctx) =>
    Effect.sync(() => {
      ctx.set(harnessMessages$, [] as ReadonlyArray<ChatMessage>)
      ctx.set(harnessStreaming$, STREAMING_IDLE)
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

  // Read connection + session state for status derivation and passing to ops
  const connectionState = useAtomValue(harnessConnection$)
  const sessionId = useAtomValue(harnessSessionId$)

  const status: HarnessAdapterStatus =
    (connectionState as any)?.phase === 'connected' ? 'connected' :
    (connectionState as any)?.phase === 'connecting' ? 'connecting' :
    (connectionState as any)?.phase === 'error' ? 'error' :
    'idle'

  const error: string | null = (connectionState as any)?.error ?? null

  // Auto-connect once
  const hasConnected = useRef(false)
  useEffect(() => {
    if (autoConnect && !hasConnected.current) {
      hasConnected.current = true
      console.log('[useHarnessAdapter] auto-connecting:', { nodeId, role, agentName })
      doConnect({ nodeId, role, agentName })
    }
  }, [autoConnect, nodeId, role, agentName, doConnect])

  // Build adapter — recreated when sessionId changes so send/cancel/dispose
  // always capture the current sessionId via closure.
  const adapterRef = useRef<MorphChatAdapter>(null!)
  const adapter = React.useMemo<MorphChatAdapter>(() => {
    const a: MorphChatAdapter = {
      adapterId: `harness-${nodeId}`,
      label: `Harness (${nodeId})`,
      messages$: harnessMessages$,
      connection$: harnessConnection$,
      streaming$: harnessStreaming$,
      agents$: harnessAgents$,
      send: (params: SendParams) =>
        Effect.sync(() => doSend({ content: params.content, thinkingLevel: params.thinkingLevel, sessionId })),
      cancel: () => Effect.sync(() => doCancel({ sessionId })),
      reconnect: () => Effect.sync(() => doConnect({ nodeId, role, agentName })),
      clear: () => Effect.sync(() => doClear(undefined as void)),
      dispose: () => Effect.sync(() => doDispose({ sessionId })),
    }
    adapterRef.current = a
    return a
  }, [nodeId, sessionId, doSend, doCancel, doConnect, doClear, doDispose, role, agentName])

  return { adapter, status, error, connect: doConnect }
}
