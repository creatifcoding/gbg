/**
 * Harness Adapter — Bridges HarnessRuntime to MorphChatAdapter
 *
 * Translates HarnessRuntimeShape (WebSocket-backed, Effect streaming)
 * into the Atom-based MorphChatAdapter interface that MorphChat surfaces consume.
 *
 * Event mapping:
 *   assistant_start     → new message entry (status: streaming)
 *   assistant_delta     → append to streaming buffer
 *   assistant_final     → finalize message (status: complete)
 *   assistant_thinking  → update thinking buffer (thinkingLevel indicator)
 *   usage              → patch tokenUsage onto finalized message
 *   tool_event         → create/update/finalize inline task
 *   error              → connection$ phase: error
 *   heartbeat          → connection$ latency probe
 *   session_opened     → connection$ phase: connected
 *   provider_marker    → fine-grained streaming state (text/thinking/tool deltas)
 *
 * Lifecycle:
 *   1. createHarnessAdapter(config) returns a MorphChatAdapter
 *   2. Surface calls adapter.send() → harness.send() + openSession if needed
 *   3. harness.events stream is consumed by a background fiber
 *   4. Events mutate Atom state → Surface re-renders reactively
 *   5. adapter.dispose() tears down the fiber and cleans up atoms
 *
 * @module morphchat/adapters/harness-adapter
 */

import { Atom } from '@effect-atom/atom'
import { Effect, Option, Stream, Fiber, Ref, pipe } from 'effect'
import type {
  MorphChatAdapter,
  TransferSurfaceConfig,
} from '../schemas/adapter-types'
import type {
  ChatMessage,
  ConnectionState,
  StreamingState,
  AgentInfo,
  SendParams,
} from '../schemas/message-types'
import { CONNECTED, DISCONNECTED, STREAMING_IDLE } from '../schemas/message-types'
import { morphChatRegistry } from '../atoms/registry'

import type { HarnessRuntimeShape } from '@/lib/harness/HarnessRuntime'
import type {
  HarnessEvent,
  HarnessSessionId,
  HarnessClientMessageId,
  HarnessThinkingLevel,
  HarnessRole,
} from '@/lib/harness/schemas'

// =============================================================================
// Config
// =============================================================================

export interface HarnessAdapterConfig {
  /** Unique adapter ID — scopes atoms, prevents cross-talk */
  readonly adapterId?: string

  /** Human label for debug/testbed */
  readonly label?: string

  /** Harness runtime instance (from Effect DI or direct construction) */
  readonly runtime: HarnessRuntimeShape

  /** Node ID for session opening */
  readonly nodeId: string

  /** Harness role for session */
  readonly role: HarnessRole

  /** Agent display name */
  readonly agentName?: string

  /** Transfer system config */
  readonly transferConfig?: TransferSurfaceConfig

  /** Auto-reconnect on disconnect */
  readonly autoReconnect?: boolean

  /** Max reconnect attempts */
  readonly maxReconnectAttempts?: number
}

// =============================================================================
// ID Generation
// =============================================================================

let harnessAdapterCounter = 0

function createAdapterId(): string {
  return `harness-adapter-${++harnessAdapterCounter}`
}

function createClientMessageId(): HarnessClientMessageId {
  return `cmid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as HarnessClientMessageId
}

// =============================================================================
// Thinking Level Mapping
// =============================================================================

function toHarnessThinkingLevel(level?: number): Option.Option<HarnessThinkingLevel> {
  if (level == null || level === 0) return Option.none()
  if (level <= 1) return Option.some('minimal' as HarnessThinkingLevel)
  if (level <= 2) return Option.some('low' as HarnessThinkingLevel)
  if (level <= 3) return Option.some('medium' as HarnessThinkingLevel)
  return Option.some('high' as HarnessThinkingLevel)
}

// =============================================================================
// Factory
// =============================================================================

export function createHarnessAdapter(config: HarnessAdapterConfig): MorphChatAdapter & HarnessAdapterExtensions {
  const {
    runtime,
    nodeId,
    role,
    agentName = 'Agent',
    autoReconnect = true,
    maxReconnectAttempts = 5,
  } = config

  const adapterId = config.adapterId ?? createAdapterId()
  const label = config.label ?? `Harness (${nodeId})`

  // ── Atoms ───────────────────────────────────────────────

  const messages$ = Atom.make<ReadonlyArray<ChatMessage>>([])
  morphChatRegistry.mount(messages$)

  const connection$ = Atom.make<ConnectionState>(DISCONNECTED)
  morphChatRegistry.mount(connection$)

  const streaming$ = Atom.make<StreamingState>(STREAMING_IDLE)
  morphChatRegistry.mount(streaming$)

  const agents$ = Atom.make<ReadonlyArray<AgentInfo>>([])
  morphChatRegistry.mount(agents$)

  const inlineTasks$ = Atom.make<ReadonlyArray<unknown>>([])
  morphChatRegistry.mount(inlineTasks$)

  // ── Internal State ──────────────────────────────────────

  let sessionId: HarnessSessionId | null = null
  let eventFiber: Fiber.RuntimeFiber<void, unknown> | null = null
  let reconnectAttempts = 0

  // ── Event Processor ─────────────────────────────────────

  function processEvent(event: HarnessEvent): void {
    switch (event._tag) {
      case 'chat:v2/session_opened': {
        sessionId = event.sessionId
        reconnectAttempts = 0
        morphChatRegistry.set(connection$, {
          phase: 'connected',
          endpoint: `harness:${nodeId}`,
        })
        // Register agent from session
        morphChatRegistry.set(agents$, [{
          id: event.agentId,
          name: agentName,
          isActive: true,
        }])
        break
      }

      case 'chat:v2/send_accepted': {
        // Update pending message to sent
        morphChatRegistry.set(messages$, (prev) =>
          prev.map((msg) =>
            msg.status === 'pending'
              ? { ...msg, status: 'sent' as const }
              : msg,
          ),
        )
        break
      }

      case 'chat:v2/assistant_start': {
        // Create new streaming message
        const streamMsg: ChatMessage = {
          id: event.messageId as string,
          role: 'agent',
          authorName: agentName,
          content: '',
          timestamp: new Date(event.at).toISOString(),
          status: 'streaming',
        }
        morphChatRegistry.set(messages$, (prev) => [...prev, streamMsg])
        morphChatRegistry.set(streaming$, {
          isStreaming: true,
          buffer: '',
          messageId: event.messageId as string,
          tokensReceived: 0,
        })
        break
      }

      case 'chat:v2/assistant_delta': {
        // Append delta to streaming buffer and message content
        morphChatRegistry.set(streaming$, (prev) => ({
          ...prev,
          buffer: prev.buffer + event.delta,
          tokensReceived: (prev.tokensReceived ?? 0) + 1,
        }))
        morphChatRegistry.set(messages$, (prev) =>
          prev.map((msg) =>
            msg.id === (event.messageId as string) && msg.status === 'streaming'
              ? { ...msg, content: msg.content + event.delta }
              : msg,
          ),
        )
        break
      }

      case 'chat:v2/assistant_thinking_delta': {
        // Thinking deltas — could surface in a thinking indicator atom
        // For now, we don't append thinking to message content
        break
      }

      case 'chat:v2/assistant_final': {
        // Finalize the streaming message
        morphChatRegistry.set(messages$, (prev) =>
          prev.map((msg) =>
            msg.id === (event.messageId as string)
              ? { ...msg, content: event.text, status: 'complete' as const }
              : msg,
          ),
        )
        morphChatRegistry.set(streaming$, STREAMING_IDLE)
        break
      }

      case 'chat:v2/usage': {
        // Patch token usage onto the finalized message
        morphChatRegistry.set(messages$, (prev) =>
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
        )
        break
      }

      case 'chat:v2/tool_event': {
        // Map tool events to inline task state
        morphChatRegistry.set(inlineTasks$, (prev) => {
          const existing = prev as ReadonlyArray<Record<string, unknown>>
          const idx = existing.findIndex(
            (t) => t.toolCallId === event.toolCallId,
          )

          if (event.phase === 'start') {
            if (idx === -1) {
              return [
                ...existing,
                {
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  phase: 'start',
                  payload: event.payload,
                },
              ]
            }
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
        break
      }

      case 'chat:v2/error': {
        morphChatRegistry.set(connection$, {
          phase: 'error',
          error: `[${event.code}] ${event.message}`,
        })
        morphChatRegistry.set(streaming$, STREAMING_IDLE)
        break
      }

      case 'chat:v2/heartbeat': {
        // Update latency (at field is server timestamp)
        const latencyMs = Date.now() - event.at
        morphChatRegistry.set(connection$, (prev) => ({
          ...prev,
          latencyMs: latencyMs > 0 ? latencyMs : prev.latencyMs,
        }))
        break
      }

      case 'chat:v2/metric': {
        // Metrics are diagnostic — could surface in debug panel
        break
      }

      case 'chat:v2/provider_marker': {
        // Provider markers give fine-grained streaming info
        // We already handle assistant_delta for content, so this is supplementary
        break
      }

      default:
        break
    }
  }

  // ── Start Event Stream Fiber ────────────────────────────

  function startEventStream(): Effect.Effect<void> {
    return Effect.gen(function* () {
      // Stop existing fiber if any
      if (eventFiber) {
        yield* Fiber.interrupt(eventFiber)
        eventFiber = null
      }

      morphChatRegistry.set(connection$, {
        phase: 'connecting',
        endpoint: `harness:${nodeId}`,
      })

      // Open session
      const session = yield* runtime.openSession(nodeId, role)
      sessionId = session.sessionId

      // Fork event stream consumption
      const fiber = yield* pipe(
        runtime.events,
        Stream.tap((event) => Effect.sync(() => processEvent(event))),
        Stream.runDrain,
        Effect.catchAll((err) =>
          Effect.sync(() => {
            morphChatRegistry.set(connection$, {
              phase: 'error',
              error: String(err),
            })
            // Auto-reconnect
            if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++
              morphChatRegistry.set(connection$, {
                phase: 'reconnecting',
                reconnectAttempt: reconnectAttempts,
              })
              // Reconnect after delay (exponential backoff)
              setTimeout(() => {
                Effect.runPromise(startEventStream()).catch(() => {})
              }, Math.min(1000 * 2 ** reconnectAttempts, 30000))
            }
          }),
        ),
        Effect.fork,
      )

      eventFiber = fiber
    })
  }

  // ── Operations ──────────────────────────────────────────

  const send = (params: SendParams): Effect.Effect<void> =>
    Effect.gen(function* () {
      // Open session if not yet open
      if (!sessionId) {
        yield* startEventStream()
      }

      if (!sessionId) {
        return yield* Effect.fail(new Error('No active session'))
      }

      const clientMessageId = createClientMessageId()

      // Optimistic: add user message immediately
      const userMsg: ChatMessage = {
        id: clientMessageId as string,
        role: 'operator',
        content: params.content,
        timestamp: new Date().toISOString(),
        status: 'pending',
        thinkingLevel: params.thinkingLevel,
      }
      morphChatRegistry.set(messages$, (prev) => [...prev, userMsg])

      // Send to harness
      yield* runtime.send(
        sessionId,
        clientMessageId,
        params.content,
        toHarnessThinkingLevel(params.thinkingLevel),
      )
    }).pipe(
      Effect.catchAll((err) =>
        Effect.sync(() => {
          console.error('[HarnessAdapter] send failed:', err)
          // Mark pending message as error
          morphChatRegistry.set(messages$, (prev) =>
            prev.map((msg) =>
              msg.status === 'pending'
                ? { ...msg, status: 'error' as const }
                : msg,
            ),
          )
        }),
      ),
    )

  const cancel = (): Effect.Effect<void> =>
    Effect.gen(function* () {
      if (!sessionId) return
      yield* runtime.abortSession(sessionId)
      morphChatRegistry.set(streaming$, STREAMING_IDLE)
    }).pipe(Effect.catchAll(() => Effect.void))

  const reconnect = (): Effect.Effect<void> =>
    Effect.gen(function* () {
      reconnectAttempts = 0
      yield* startEventStream()
    })

  const clear = (): Effect.Effect<void> =>
    Effect.sync(() => {
      morphChatRegistry.set(messages$, [])
      morphChatRegistry.set(streaming$, STREAMING_IDLE)
      morphChatRegistry.set(inlineTasks$, [])
    })

  const dispose = (): Effect.Effect<void> =>
    Effect.gen(function* () {
      if (eventFiber) {
        yield* Fiber.interrupt(eventFiber)
        eventFiber = null
      }
      if (sessionId) {
        yield* runtime.abortSession(sessionId).pipe(Effect.catchAll(() => Effect.void))
        sessionId = null
      }
      morphChatRegistry.set(connection$, DISCONNECTED)
      morphChatRegistry.set(streaming$, STREAMING_IDLE)
    })

  // ── Harness-specific extensions ─────────────────────────

  const respondExtensionUI = runtime.respondExtensionUI

  const getSnapshot = (): Effect.Effect<unknown> =>
    sessionId
      ? runtime.getSnapshot(sessionId, Option.none())
      : Effect.succeed(null)

  // ── Return Adapter ──────────────────────────────────────

  return {
    adapterId,
    label,
    messages$,
    connection$,
    streaming$,
    agents$,
    inlineTasks$,
    transferConfig: config.transferConfig,
    send,
    cancel,
    reconnect,
    clear,
    dispose,

    // Harness extensions
    connect: () => startEventStream(),
    respondExtensionUI,
    getSnapshot,
    get sessionId() { return sessionId },
  }
}

// =============================================================================
// Harness Adapter Extensions
// =============================================================================

/** Extra capabilities exposed by the harness adapter beyond MorphChatAdapter */
export interface HarnessAdapterExtensions {
  /** Manually trigger connection (opens session + starts event stream) */
  readonly connect: () => Effect.Effect<void>
  /** Pass-through to HarnessRuntime.respondExtensionUI */
  readonly respondExtensionUI: HarnessRuntimeShape['respondExtensionUI']
  /** Get current session snapshot */
  readonly getSnapshot: () => Effect.Effect<unknown>
  /** Current session ID (null if not connected) */
  readonly sessionId: HarnessSessionId | null
}
