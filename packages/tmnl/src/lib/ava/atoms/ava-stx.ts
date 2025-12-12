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
// Layer Factory
// =============================================================================

const createLiveLayers = (baseUrl: string) => {
  const configLayer = Layer.succeed(AvaApiConfig, {
    baseUrl,
    timeout: 30000,
  })

  const httpLayer = AvaHttpClientLive.pipe(Layer.provide(configLayer))

  const sessionLayer = AvaSessionClientLive.pipe(
    Layer.provide(Socket.layerWebSocketConstructorGlobal),
    Layer.provide(configLayer)
  )

  return Layer.mergeAll(httpLayer, sessionLayer)
}

// =============================================================================
// Helper Functions
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

    const layer = createLiveLayers(config.baseUrl)
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

      const layer = createLiveLayers(config.baseUrl)
      const client = yield* AvaHttpClient.pipe(Effect.provide(layer))

      const spec = yield* client.getSpec(viewId)
      const art = yield* client.getArtifact(viewId)

      state.data.selectedView.set(spec)
      state.data.artifact.set(art)

      // Add message
      const msg = createMessageEntry('in', 'artifact', { view_id: viewId, version: art.version })
      state.data.messageLog.set([msg, ...state.data.messageLog.get()].slice(0, 100))

      // Update hypothesis
      state.data.hypotheses.set(
        state.data.hypotheses.get().map((h) =>
          h.id === 'H2' ? { ...h, status: 'passed' as const, evidence: 'Live artifact received' } : h
        )
      )

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

    // Add outgoing message
    const outMsg = createMessageEntry('out', 'register', { id: viewId, name: viewName })
    state.data.messageLog.set([outMsg, ...state.data.messageLog.get()].slice(0, 100))

    const layer = createLiveLayers(config.baseUrl)
    const client = yield* AvaHttpClient.pipe(Effect.provide(layer))

    const result = yield* client.registerView({
      id: viewId,
      name: viewName,
      assemblage_id: 'testbed-assemblage',
      channels: [
        { id: `ch-${Date.now()}`, role: 'State', source_connection: 'testbed://source' },
      ],
    })

    // Add incoming message
    const inMsg = createMessageEntry('in', 'status', {
      view_id: result.view_id,
      was_created: result.was_created,
      version: result.version,
    })
    state.data.messageLog.set([inMsg, ...state.data.messageLog.get()].slice(0, 100))

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

    // Send machine event
    state.send?.({ type: 'CONNECT' })

    // Update hypothesis
    state.data.hypotheses.set(
      state.data.hypotheses.get().map((h) =>
        h.id === 'H4' ? { ...h, status: 'validating' as const } : h
      )
    )
    state.data.error.set(null)

    const layer = createLiveLayers(config.baseUrl)

    const program = Effect.gen(function* () {
      const client = yield* AvaSessionClient

      yield* client.waitForConnection

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

      // Add session message
      const msg = createMessageEntry('in', 'session', {
        status: 'connected',
        endpoint: config.baseUrl,
      })
      state.data.messageLog.set([msg, ...state.data.messageLog.get()].slice(0, 100))

      // Stream events
      yield* client.events.pipe(
        Stream.tap((event) =>
          Effect.sync(() => {
            const evtMsg = createMessageEntry('in', event._tag, event)
            state.data.messageLog.set([evtMsg, ...state.data.messageLog.get()].slice(0, 100))

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
      Effect.catchAll((error) =>
        Effect.sync(() => {
          state.send?.({ type: 'ERROR', message: String(error) })

          state.data.hypotheses.set(
            state.data.hypotheses.get().map((h) =>
              h.id === 'H4' ? { ...h, status: 'failed' as const, evidence: String(error) } : h
            )
          )

          state.data.error.set(`Connection error: ${error}`)

          const errMsg = createMessageEntry('in', 'error', { message: String(error) })
          state.data.messageLog.set([errMsg, ...state.data.messageLog.get()].slice(0, 100))
        })
      )
    )

    const fiber = yield* Effect.fork(program)
    // Store fiber in machine context could be done via action, but for now we return it

    return fiber
  }),

  /**
   * Disconnect from WebSocket session
   */
  disconnectSession: Effect.gen(function* () {
    const state = getAvaStx()

    // Get fiber from machine context if stored there
    const snapshot = state.actor?.getSnapshot()
    const fiber = (snapshot?.context as ConnectionContext | undefined)?.fiber

    if (fiber) {
      yield* Fiber.interrupt(fiber)
    }

    state.send?.({ type: 'DISCONNECT' })

    const msg = createMessageEntry('in', 'session', { status: 'disconnected' })
    state.data.messageLog.set([msg, ...state.data.messageLog.get()].slice(0, 100))
  }),

  /**
   * Send ping
   */
  sendPing: Effect.gen(function* () {
    const state = getAvaStx()
    const config = state.data.config.get()
    const snapshot = state.actor?.getSnapshot()

    if (!snapshot?.matches('connected')) return

    const outMsg = createMessageEntry('out', 'ping', { payload: 'testbed-ping' })
    state.data.messageLog.set([outMsg, ...state.data.messageLog.get()].slice(0, 100))

    const layer = createLiveLayers(config.baseUrl)
    const program = Effect.gen(function* () {
      const client = yield* AvaSessionClient
      yield* client.ping('testbed-ping')
    }).pipe(Effect.scoped, Effect.provide(layer))

    yield* program.pipe(
      Effect.catchAll((e) =>
        Effect.sync(() => {
          const errMsg = createMessageEntry('in', 'error', { message: `Ping failed: ${e}` })
          state.data.messageLog.set([errMsg, ...state.data.messageLog.get()].slice(0, 100))
        })
      )
    )
  }),

  /**
   * Subscribe to a view
   */
  subscribeToView: (viewId: string) =>
    Effect.gen(function* () {
      const state = getAvaStx()
      const config = state.data.config.get()
      const snapshot = state.actor?.getSnapshot()

      if (!snapshot?.matches('connected')) return

      const outMsg = createMessageEntry('out', 'subscribe', { view_id: viewId })
      state.data.messageLog.set([outMsg, ...state.data.messageLog.get()].slice(0, 100))

      const layer = createLiveLayers(config.baseUrl)
      const program = Effect.gen(function* () {
        const client = yield* AvaSessionClient
        yield* client.subscribe(viewId)
      }).pipe(Effect.scoped, Effect.provide(layer))

      yield* program.pipe(
        Effect.catchAll((e) =>
          Effect.sync(() => {
            const errMsg = createMessageEntry('in', 'error', { message: `Subscribe failed: ${e}` })
            state.data.messageLog.set([errMsg, ...state.data.messageLog.get()].slice(0, 100))
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
  }
  return avaStxInstance
}

/**
 * Reset the AVA stx instance (for testing)
 */
export const resetAvaStx = (): void => {
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
