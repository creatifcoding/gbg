/**
 * AVA State with stx
 *
 * Unified state management for AVA Testbed using stx (XState + Legend-State + effect-atom).
 *
 * @pattern stx tri-library composition
 * @see src/lib/stx for implementation
 * @module
 */

import { Effect, Layer, Fiber, Stream } from 'effect'
import { Socket } from '@effect/platform'
import { setup, assign, fromPromise } from 'xstate'

import { stx, type StxInstance } from '@/lib/stx'
import {
  AvaHttpClient,
  AvaHttpClientLive,
  AvaSessionClient,
  AvaSessionClientLive,
  AvaApiConfig,
  type ViewSummary,
  type ViewSpec,
  type ViewArtifact,
} from '../index'

// =============================================================================
// Types
// =============================================================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface MessageLogEntry {
  readonly id: string
  readonly timestamp: number
  readonly direction: 'in' | 'out'
  readonly type: string
  readonly payload: string
}

export interface HypothesisState {
  readonly id: string
  readonly label: string
  readonly status: 'pending' | 'validating' | 'passed' | 'failed'
  readonly evidence?: string
}

export interface AvaTestbedConfig {
  readonly baseUrl: string
  readonly useMock: boolean
}

// =============================================================================
// Machine Definition
// =============================================================================

type ConnectionContext = {
  fiber: Fiber.RuntimeFiber<void, unknown> | null
  errorMessage: string | null
}

type ConnectionEvents =
  | { type: 'CONNECT' }
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECT' }
  | { type: 'ERROR'; message: string }

const connectionMachine = setup({
  types: {
    context: {} as ConnectionContext,
    events: {} as ConnectionEvents,
  },
  actions: {
    clearError: assign({ errorMessage: null }),
    setError: assign({
      errorMessage: (_, params: { message: string }) => params.message,
    }),
    clearFiber: assign({ fiber: null }),
  },
}).createMachine({
  id: 'avaConnection',
  initial: 'disconnected',
  context: {
    fiber: null,
    errorMessage: null,
  },
  states: {
    disconnected: {
      entry: 'clearError',
      on: {
        CONNECT: 'connecting',
      },
    },
    connecting: {
      on: {
        CONNECTED: 'connected',
        ERROR: {
          target: 'error',
          actions: {
            type: 'setError',
            params: ({ event }) => ({ message: event.message }),
          },
        },
        DISCONNECT: 'disconnected',
      },
    },
    connected: {
      on: {
        DISCONNECT: {
          target: 'disconnected',
          actions: 'clearFiber',
        },
        ERROR: {
          target: 'error',
          actions: {
            type: 'setError',
            params: ({ event }) => ({ message: event.message }),
          },
        },
      },
    },
    error: {
      on: {
        CONNECT: 'connecting',
        DISCONNECT: 'disconnected',
      },
    },
  },
})

// =============================================================================
// Data Shape
// =============================================================================

interface AvaData {
  views: readonly ViewSummary[]
  selectedView: ViewSpec | null
  artifact: ViewArtifact | null
  messageLog: readonly MessageLogEntry[]
  config: AvaTestbedConfig
  hypotheses: readonly HypothesisState[]
  error: string | null
}

const initialData: AvaData = {
  views: [],
  selectedView: null,
  artifact: null,
  messageLog: [],
  config: {
    baseUrl: 'http://localhost:3000',
    useMock: false,
  },
  hypotheses: [
    { id: 'H1', label: 'HTTP client can list/register/invalidate views', status: 'pending' },
    { id: 'H2', label: 'WebSocket session receives artifact events', status: 'pending' },
    { id: 'H3', label: 'TmnlDataGrid displays views correctly', status: 'pending' },
    { id: 'H4', label: 'Connection status reflects WebSocket state', status: 'pending' },
    { id: 'H5', label: 'Message log captures all session events', status: 'pending' },
  ],
  error: null,
}

// =============================================================================
// Layer Factories
// =============================================================================

/**
 * Create HTTP-only layer for REST API operations (list views, get spec, etc.)
 * Does NOT create a WebSocket connection.
 */
const createHttpLayer = (baseUrl: string) => {
  const configLayer = Layer.succeed(AvaApiConfig, {
    baseUrl,
    timeout: 30000,
  })
  return AvaHttpClientLive.pipe(Layer.provide(configLayer))
}

/**
 * Create Session layer for WebSocket operations.
 * Only use this when you need a persistent WebSocket connection.
 */
const createSessionLayer = (baseUrl: string) => {
  const configLayer = Layer.succeed(AvaApiConfig, {
    baseUrl,
    timeout: 30000,
  })
  return AvaSessionClientLive.pipe(
    Layer.provide(Socket.layerWebSocketConstructorGlobal),
    Layer.provide(configLayer)
  )
}

// =============================================================================
// Active Session Storage
// =============================================================================

/**
 * Module-level storage for the active session client.
 * This allows sendPing/subscribeToView to reuse the connection established
 * by connectSession, rather than creating new WebSocket connections.
 *
 * CRITICAL: AvaSessionClient is Layer.scoped, so each Effect.scoped + Layer.provide
 * creates a NEW WebSocket connection. We need to store the client reference from
 * connectSession and reuse it for subsequent operations.
 */
interface ActiveSession {
  client: AvaSessionClient
  fiber: Fiber.RuntimeFiber<void, unknown>
}

let activeSession: ActiveSession | null = null

const setActiveSession = (session: ActiveSession | null): void => {
  activeSession = session
}

const getActiveSession = (): ActiveSession | null => {
  return activeSession
}

// =============================================================================
// Message Log Helpers
// =============================================================================

let messageIdCounter = 0

const createMessageEntry = (
  direction: 'in' | 'out',
  type: string,
  payload: unknown
): MessageLogEntry => ({
  id: `msg-${++messageIdCounter}`,
  timestamp: Date.now(),
  direction,
  type,
  payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
})

/**
 * Append a message to the log (internal helper).
 * Used by the machine subscription and WebSocket stream handlers.
 */
const appendToLog = (state: AvaStx, entry: MessageLogEntry): void => {
  state.data.messageLog.set([entry, ...state.data.messageLog.get()].slice(0, 100))
}

// =============================================================================
// stx Instance
// =============================================================================

export type AvaStx = StxInstance<
  AvaData,
  typeof connectionMachine,
  typeof avaEffects,
  typeof avaComputed
>

const avaEffects = {
  /**
   * Fetch views from server
   */
  fetchViews: Effect.gen(function* () {
    const state = getAvaStx()
    const config = state.data.config.get()

    // Update hypothesis
    state.data.hypotheses.set(
      state.data.hypotheses.get().map((h) =>
        h.id === 'H1' ? { ...h, status: 'validating' as const } : h
      )
    )
    state.data.error.set(null)

    const layer = createHttpLayer(config.baseUrl)
    const client = yield* AvaHttpClient.pipe(Effect.provide(layer))
    const views = yield* client.listViews()

    state.data.views.set(views)
    state.data.hypotheses.set(
      state.data.hypotheses.get().map((h) =>
        h.id === 'H1'
          ? { ...h, status: 'passed' as const, evidence: `Listed ${views.length} views (live)` }
          : h.id === 'H3' && views.length > 0
            ? { ...h, status: 'passed' as const, evidence: 'Grid populated with live view data' }
            : h
      )
    )

    return views
  }),

  /**
   * Select and fetch a view's spec and artifact
   */
  selectView: (viewId: string) =>
    Effect.gen(function* () {
      const state = getAvaStx()
      const config = state.data.config.get()

      const layer = createHttpLayer(config.baseUrl)
      const client = yield* AvaHttpClient.pipe(Effect.provide(layer))

      const spec = yield* client.getSpec(viewId)
      const art = yield* client.getArtifact(viewId)

      state.data.selectedView.set(spec)
      state.data.artifact.set(art)

      // NOTE: No message log entry - this is an HTTP call, not a WebSocket event.
      // Message log is reserved for actual WebSocket session events.

      return { spec, art }
    }),

  /**
   * Register a new test view
   */
  registerTestView: Effect.gen(function* () {
    const state = getAvaStx()
    const config = state.data.config.get()
    const viewName = `Test View ${Date.now()}`
    const viewId = `testbed-${Date.now()}`

    // NOTE: No message log entry for HTTP request - message log is for WebSocket events only.

    const layer = createHttpLayer(config.baseUrl)
    const client = yield* AvaHttpClient.pipe(Effect.provide(layer))

    const result = yield* client.registerView({
      id: viewId,
      name: viewName,
      assemblage_id: 'testbed-assemblage',
      channels: [
        { id: `ch-${Date.now()}`, role: 'State', source_connection: 'testbed://source' },
      ],
    })

    // NOTE: No message log entry for HTTP response - message log is for WebSocket events only.

    // Refresh views - run as separate effect
    yield* avaEffects.fetchViews

    return result
  }),

  /**
   * Connect to WebSocket session
   */
  connectSession: Effect.gen(function* () {
    const state = getAvaStx()
    const config = state.data.config.get()

    console.log('[ava-stx] connectSession started, baseUrl:', config.baseUrl)

    // Clear any existing session
    if (activeSession) {
      console.log('[ava-stx] Clearing existing session, interrupting fiber')
      yield* Fiber.interrupt(activeSession.fiber).pipe(Effect.ignore)
      setActiveSession(null)
    }

    // Send machine event
    state.send?.({ type: 'CONNECT' })

    // Update hypothesis
    state.data.hypotheses.set(
      state.data.hypotheses.get().map((h) =>
        h.id === 'H4' ? { ...h, status: 'validating' as const } : h
      )
    )
    state.data.error.set(null)

    const layer = createSessionLayer(config.baseUrl)
    console.log('[ava-stx] Session layer created, creating program')

    const program = Effect.gen(function* () {
      console.log('[ava-stx] Program started, yielding AvaSessionClient')
      const client = yield* AvaSessionClient
      console.log('[ava-stx] AvaSessionClient obtained, waiting for connection')

      yield* client.waitForConnection
      console.log('[ava-stx] Connection established!')

      // Transition to connected
      state.send?.({ type: 'CONNECTED' })

      // Update hypothesis
      state.data.hypotheses.set(
        state.data.hypotheses.get().map((h) =>
          h.id === 'H4'
            ? { ...h, status: 'passed' as const, evidence: 'Live WebSocket connected' }
            : h
        )
      )

      // CRITICAL: Store the client in activeSession for sendPing/subscribeToView to use.
      // We need a way to pass the fiber reference back. Use a Deferred to signal when stored.
      // For now, store with null fiber - we'll update it after runFork returns.
      console.log('[ava-stx] Storing client in activeSession (fiber pending)')
      setActiveSession({ client, fiber: null as unknown as Fiber.RuntimeFiber<void, unknown> })

      // NOTE: No manual message log entry needed here.
      // The machine subscription in getAvaStx() logs the 'connected' transition.

      // Stream events — WebSocket events are logged as they arrive
      yield* client.events.pipe(
        Stream.tap((event) =>
          Effect.sync(() => {
            // Log incoming WebSocket event
            appendToLog(state, createMessageEntry('in', event._tag, event))

            if (event._tag === 'artifact') {
              state.data.artifact.set(event.artifact)
              state.data.hypotheses.set(
                state.data.hypotheses.get().map((h) =>
                  h.id === 'H2'
                    ? {
                        ...h,
                        status: 'passed' as const,
                        evidence: `Artifact received: ${event.artifact.view_id}`,
                      }
                    : h
                )
              )
            }

            state.data.hypotheses.set(
              state.data.hypotheses.get().map((h) =>
                h.id === 'H5'
                  ? { ...h, status: 'passed' as const, evidence: `Event logged: ${event._tag}` }
                  : h
              )
            )
          })
        ),
        Stream.runDrain
      )
    }).pipe(
      Effect.scoped,
      Effect.provide(layer),
      Effect.ensuring(
        // Cleanup: clear activeSession when program exits (success, error, or interrupt)
        Effect.sync(() => {
          console.log('[ava-stx] Program exiting, clearing activeSession')
          setActiveSession(null)
        })
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.log('[ava-stx] Connection error caught:', error)
          state.send?.({ type: 'ERROR', message: String(error) })

          state.data.hypotheses.set(
            state.data.hypotheses.get().map((h) =>
              h.id === 'H4' ? { ...h, status: 'failed' as const, evidence: String(error) } : h
            )
          )

          state.data.error.set(`Connection error: ${error}`)

          // NOTE: No manual message log entry needed here.
          // The machine subscription logs the 'error' transition with context.errorMessage.
        })
      )
    )

    // CRITICAL: Use Effect.runFork instead of yield* Effect.fork
    // stx uses Effect.runPromiseExit which creates a transient runtime.
    // When the effect returns, the runtime is disposed before forked fibers can run.
    // Effect.runFork creates a fiber on a persistent global runtime that outlives
    // the stx effect call.
    console.log('[ava-stx] Running program with Effect.runFork (persistent runtime)')
    const fiber = Effect.runFork(program)
    console.log('[ava-stx] Program fiber running on global runtime')

    // Update activeSession with the fiber reference (client was stored inside program)
    if (activeSession) {
      activeSession.fiber = fiber
    }

    return fiber
  }),

  /**
   * Disconnect from WebSocket session
   */
  disconnectSession: Effect.gen(function* () {
    const state = getAvaStx()

    // Interrupt the active session fiber
    const session = getActiveSession()
    if (session?.fiber) {
      console.log('[ava-stx] Interrupting active session fiber')
      yield* Fiber.interrupt(session.fiber).pipe(Effect.ignore)
    }

    // Clear active session
    setActiveSession(null)

    // Trigger machine transition — the subscription logs the state change
    state.send?.({ type: 'DISCONNECT' })
  }),

  /**
   * Send ping
   * Only logs to message log if machine is connected AND command succeeds.
   * Uses the active session client (no new WebSocket connection).
   */
  sendPing: Effect.gen(function* () {
    const state = getAvaStx()
    const snapshot = state.actor?.getSnapshot()

    // Guard: Only send if connected (machine state is source of truth)
    if (!snapshot?.matches('connected')) {
      console.log('[ava-stx] sendPing: Not connected (machine state)')
      return
    }

    // Use the active session client
    const session = getActiveSession()
    if (!session?.client) {
      console.log('[ava-stx] sendPing: No active session client')
      appendToLog(state, createMessageEntry('in', 'error', { message: 'No active session' }))
      return
    }

    console.log('[ava-stx] sendPing: Using active session client')
    yield* session.client.ping('testbed-ping').pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          // Log outbound command only after successful send
          appendToLog(state, createMessageEntry('out', 'ping', { payload: 'testbed-ping' }))
        })
      ),
      Effect.catchAll((e) =>
        Effect.sync(() => {
          // Log failure as inbound error
          appendToLog(state, createMessageEntry('in', 'error', { message: `Ping failed: ${e}` }))
        })
      )
    )
  }),

  /**
   * Subscribe to a view
   * Only logs to message log if machine is connected AND command succeeds.
   * Uses the active session client (no new WebSocket connection).
   */
  subscribeToView: (viewId: string) =>
    Effect.gen(function* () {
      const state = getAvaStx()
      const snapshot = state.actor?.getSnapshot()

      // Guard: Only send if connected (machine state is source of truth)
      if (!snapshot?.matches('connected')) {
        console.log('[ava-stx] subscribeToView: Not connected (machine state)')
        return
      }

      // Use the active session client
      const session = getActiveSession()
      if (!session?.client) {
        console.log('[ava-stx] subscribeToView: No active session client')
        appendToLog(state, createMessageEntry('in', 'error', { message: 'No active session' }))
        return
      }

      console.log('[ava-stx] subscribeToView: Using active session client for', viewId)
      yield* session.client.subscribe(viewId).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            // Log outbound command only after successful send
            appendToLog(state, createMessageEntry('out', 'subscribe', { view_id: viewId }))
          })
        ),
        Effect.catchAll((e) =>
          Effect.sync(() => {
            // Log failure as inbound error
            appendToLog(state, createMessageEntry('in', 'error', { message: `Subscribe failed: ${e}` }))
          })
        )
      )
    }),
}

const avaComputed = {
  hasSelectedView: (get: AvaStx) => get.data.selectedView.get() !== null,
  messageCount: (get: AvaStx) => get.data.messageLog.get().length,
  viewsCount: (get: AvaStx) => get.data.views.get().length,
  connectionStatus: (get: AvaStx): ConnectionStatus => {
    const snapshot = get.actor?.getSnapshot()
    return (snapshot?.value as ConnectionStatus) ?? 'disconnected'
  },
}

// =============================================================================
// Singleton Instance
// =============================================================================

let avaStxInstance: AvaStx | null = null
let machineUnsubscribe: (() => void) | null = null

/**
 * Get or create the AVA stx instance
 */
export const getAvaStx = (): AvaStx => {
  if (!avaStxInstance) {
    avaStxInstance = stx({
      machine: connectionMachine,
      data: initialData,
      effects: avaEffects,
      computed: avaComputed,
    }) as AvaStx

    // Subscribe to machine state transitions for message log
    // This is the pull-based event source — the machine defines what conditions update the log
    if (avaStxInstance.actor) {
      let previousState: string | null = null

      machineUnsubscribe = avaStxInstance.actor.subscribe((snapshot) => {
        const currentState = snapshot.value as string
        const config = avaStxInstance!.data.config.get()
        const errorMessage = snapshot.context.errorMessage

        // Only log on actual state transitions
        if (currentState !== previousState) {
          switch (currentState) {
            case 'connected':
              appendToLog(avaStxInstance!, createMessageEntry('in', 'session', {
                status: 'connected',
                endpoint: config.baseUrl,
              }))
              break
            case 'disconnected':
              // Only log disconnect if we were previously connected or in error
              if (previousState === 'connected' || previousState === 'error') {
                appendToLog(avaStxInstance!, createMessageEntry('in', 'session', {
                  status: 'disconnected',
                }))
              }
              break
            case 'error':
              appendToLog(avaStxInstance!, createMessageEntry('in', 'error', {
                message: errorMessage ?? 'Unknown error',
              }))
              break
          }
          previousState = currentState
        }
      }).unsubscribe
    }
  }
  return avaStxInstance
}

/**
 * Reset the AVA stx instance (for testing)
 */
export const resetAvaStx = (): void => {
  if (machineUnsubscribe) {
    machineUnsubscribe()
    machineUnsubscribe = null
  }
  if (avaStxInstance) {
    avaStxInstance.dispose()
    avaStxInstance = null
  }
}

// =============================================================================
// Convenience Exports
// =============================================================================

// Re-export types
export type { ViewSummary, ViewSpec, ViewArtifact }
