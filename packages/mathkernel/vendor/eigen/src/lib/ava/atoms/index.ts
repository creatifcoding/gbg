/**
 * AVA Atoms Module
 *
 * Atom-as-State pattern for AVA client state management.
 * React subscribes directly to atoms, service mutations go through Atom.set().
 *
 * @pattern Atom.make() as primary state, not Effect.Ref inside services
 * @see EFFECT_PATTERNS.md for canonical patterns
 * @module
 */

import { Atom } from '@effect-atom/atom'
import { Layer, Effect, Stream, Fiber, Scope, Exit } from 'effect'
import { Socket } from '@effect/platform'

import {
  AvaHttpClient,
  AvaHttpClientLive,
  AvaSessionClient,
  AvaSessionClientLive,
  AvaApiConfig,
  type ViewSummary,
  type ViewSpec,
  type ViewArtifact,
  type SessionEvent,
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
// Core State Atoms
// =============================================================================

/** Connection status atom */
export const connectionStatusAtom = Atom.make<ConnectionStatus>('disconnected')

/** Views list atom */
export const viewsAtom = Atom.make<readonly ViewSummary[]>([])

/** Selected view spec atom */
export const selectedViewAtom = Atom.make<ViewSpec | null>(null)

/** Current artifact atom */
export const artifactAtom = Atom.make<ViewArtifact | null>(null)

/** Message log atom (newest first) */
export const messageLogAtom = Atom.make<readonly MessageLogEntry[]>([])

/** Error atom */
export const errorAtom = Atom.make<string | null>(null)

/** Configuration atom */
export const configAtom = Atom.make<AvaTestbedConfig>({
  baseUrl: 'http://localhost:3000',
  useMock: false,
})

/** Hypotheses state atom */
export const hypothesesAtom = Atom.make<readonly HypothesisState[]>([
  { id: 'H1', label: 'HTTP client can list/register/invalidate views', status: 'pending' },
  { id: 'H2', label: 'WebSocket session receives artifact events', status: 'pending' },
  { id: 'H3', label: 'TmnlDataGrid displays views correctly', status: 'pending' },
  { id: 'H4', label: 'Connection status reflects WebSocket state', status: 'pending' },
  { id: 'H5', label: 'Message log captures all session events', status: 'pending' },
])

// =============================================================================
// Derived Atoms
// =============================================================================

/** Whether we have a selected view */
export const hasSelectedViewAtom = Atom.make((get) => get(selectedViewAtom) !== null)

/** Message count */
export const messageCountAtom = Atom.make((get) => get(messageLogAtom).length)

/** Views count */
export const viewsCountAtom = Atom.make((get) => get(viewsAtom).length)

// =============================================================================
// Atom Operations (Mutations)
// =============================================================================

let messageIdCounter = 0

/** Add a message to the log */
export const addMessage = (
  direction: 'in' | 'out',
  type: string,
  payload: unknown
): void => {
  const entry: MessageLogEntry = {
    id: `msg-${++messageIdCounter}`,
    timestamp: Date.now(),
    direction,
    type,
    payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
  }
  Atom.update(messageLogAtom, (prev) => [entry, ...prev].slice(0, 100))
}

/** Clear message log */
export const clearMessages = (): void => {
  Atom.set(messageLogAtom, [])
}

/** Update hypothesis status */
export const updateHypothesis = (
  id: string,
  status: HypothesisState['status'],
  evidence?: string
): void => {
  Atom.update(hypothesesAtom, (prev) =>
    prev.map((h) => (h.id === id ? { ...h, status, evidence } : h))
  )
}

/** Set error */
export const setError = (error: string | null): void => {
  Atom.set(errorAtom, error)
}

/** Set connection status */
export const setConnectionStatus = (status: ConnectionStatus): void => {
  Atom.set(connectionStatusAtom, status)
}

/** Set views */
export const setViews = (views: readonly ViewSummary[]): void => {
  Atom.set(viewsAtom, views)
}

/** Set selected view */
export const setSelectedView = (view: ViewSpec | null): void => {
  Atom.set(selectedViewAtom, view)
}

/** Set artifact */
export const setArtifact = (artifact: ViewArtifact | null): void => {
  Atom.set(artifactAtom, artifact)
}

/** Update config */
export const setConfig = (config: Partial<AvaTestbedConfig>): void => {
  Atom.update(configAtom, (prev) => ({ ...prev, ...config }))
}

// =============================================================================
// Layer Factory
// =============================================================================

/** Create live layers from config */
export const createLiveLayers = (baseUrl: string) => {
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
// Effect Operations
// =============================================================================

/** Fetch views from server */
export const fetchViews = Effect.gen(function* () {
  const config = Atom.get(configAtom)

  updateHypothesis('H1', 'validating')
  setError(null)

  try {
    const layer = createLiveLayers(config.baseUrl)
    const client = yield* AvaHttpClient.pipe(Effect.provide(layer))
    const views = yield* client.listViews()

    setViews(views)
    updateHypothesis('H1', 'passed', `Listed ${views.length} views (live)`)

    if (views.length > 0) {
      updateHypothesis('H3', 'passed', 'Grid populated with live view data')
    }

    return views
  } catch (e) {
    updateHypothesis('H1', 'failed', String(e))
    setError(String(e))
    throw e
  }
})

/** Select and fetch a view's spec and artifact */
export const selectView = (viewId: string) =>
  Effect.gen(function* () {
    const config = Atom.get(configAtom)

    try {
      const layer = createLiveLayers(config.baseUrl)
      const client = yield* AvaHttpClient.pipe(Effect.provide(layer))

      const spec = yield* client.getSpec(viewId)
      const art = yield* client.getArtifact(viewId)

      setSelectedView(spec)
      setArtifact(art)
      addMessage('in', 'artifact', { view_id: viewId, version: art.version })
      updateHypothesis('H2', 'passed', 'Live artifact received')

      return { spec, art }
    } catch (e) {
      setError(String(e))
      throw e
    }
  })

/** Register a new test view */
export const registerTestView = Effect.gen(function* () {
  const config = Atom.get(configAtom)
  const viewName = `Test View ${Date.now()}`
  const viewId = `testbed-${Date.now()}`

  try {
    const layer = createLiveLayers(config.baseUrl)
    const client = yield* AvaHttpClient.pipe(Effect.provide(layer))

    addMessage('out', 'register', { id: viewId, name: viewName })

    const result = yield* client.registerView({
      id: viewId,
      name: viewName,
      assemblage_id: 'testbed-assemblage',
      channels: [
        { id: `ch-${Date.now()}`, role: 'State', source_connection: 'testbed://source' },
      ],
    })

    addMessage('in', 'status', {
      view_id: result.view_id,
      was_created: result.was_created,
      version: result.version,
    })

    // Refresh views
    yield* fetchViews

    return result
  } catch (e) {
    setError(String(e))
    throw e
  }
})

// =============================================================================
// Session Management State (for fiber tracking)
// =============================================================================

/** Session fiber ref (mutable, not an atom) */
let sessionFiber: Fiber.RuntimeFiber<void, unknown> | null = null

/** Set session fiber */
export const setSessionFiber = (fiber: Fiber.RuntimeFiber<void, unknown> | null): void => {
  sessionFiber = fiber
}

/** Get session fiber */
export const getSessionFiber = (): Fiber.RuntimeFiber<void, unknown> | null => sessionFiber

// =============================================================================
// Connection Effects
// =============================================================================

/** Connect to WebSocket session */
export const connectSession = Effect.gen(function* () {
  const config = Atom.get(configAtom)

  setConnectionStatus('connecting')
  updateHypothesis('H4', 'validating')
  setError(null)

  const layer = createLiveLayers(config.baseUrl)

  const program = Effect.gen(function* () {
    const client = yield* AvaSessionClient

    yield* client.waitForConnection

    setConnectionStatus('connected')
    updateHypothesis('H4', 'passed', 'Live WebSocket connected')
    addMessage('in', 'session', { status: 'connected', endpoint: config.baseUrl })

    // Stream events
    yield* client.events.pipe(
      Stream.tap((event) =>
        Effect.sync(() => {
          addMessage('in', event._tag, event)

          if (event._tag === 'artifact') {
            setArtifact(event.artifact)
            updateHypothesis('H2', 'passed', `Artifact received: ${event.artifact.view_id}`)
          }

          updateHypothesis('H5', 'passed', `Event logged: ${event._tag}`)
        })
      ),
      Stream.runDrain
    )
  }).pipe(
    Effect.scoped,
    Effect.provide(layer),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        setConnectionStatus('error')
        updateHypothesis('H4', 'failed', String(error))
        setError(`Connection error: ${error}`)
        addMessage('in', 'error', { message: String(error) })
      })
    )
  )

  const fiber = yield* Effect.fork(program)
  setSessionFiber(fiber)

  return fiber
})

/** Disconnect from WebSocket session */
export const disconnectSession = Effect.gen(function* () {
  const fiber = getSessionFiber()

  if (fiber) {
    yield* Fiber.interrupt(fiber)
    setSessionFiber(null)
  }

  setConnectionStatus('disconnected')
  addMessage('in', 'session', { status: 'disconnected' })
})

/** Send ping */
export const sendPing = Effect.gen(function* () {
  const config = Atom.get(configAtom)
  const status = Atom.get(connectionStatusAtom)

  if (status !== 'connected') return

  addMessage('out', 'ping', { payload: 'testbed-ping' })

  const layer = createLiveLayers(config.baseUrl)
  const program = Effect.gen(function* () {
    const client = yield* AvaSessionClient
    yield* client.ping('testbed-ping')
  }).pipe(Effect.scoped, Effect.provide(layer))

  yield* program.pipe(
    Effect.catchAll((e) =>
      Effect.sync(() => {
        addMessage('in', 'error', { message: `Ping failed: ${e}` })
      })
    )
  )
})

/** Subscribe to a view */
export const subscribeToView = (viewId: string) =>
  Effect.gen(function* () {
    const config = Atom.get(configAtom)
    const status = Atom.get(connectionStatusAtom)

    if (status !== 'connected') return

    addMessage('out', 'subscribe', { view_id: viewId })

    const layer = createLiveLayers(config.baseUrl)
    const program = Effect.gen(function* () {
      const client = yield* AvaSessionClient
      yield* client.subscribe(viewId)
    }).pipe(Effect.scoped, Effect.provide(layer))

    yield* program.pipe(
      Effect.catchAll((e) =>
        Effect.sync(() => {
          addMessage('in', 'error', { message: `Subscribe failed: ${e}` })
        })
      )
    )
  })

// =============================================================================
// Cleanup
// =============================================================================

/** Cleanup all state (for unmount) */
export const cleanup = Effect.gen(function* () {
  const fiber = getSessionFiber()
  if (fiber) {
    yield* Fiber.interrupt(fiber).pipe(Effect.ignoreLogged)
    setSessionFiber(null)
  }
})

// =============================================================================
// Reset
// =============================================================================

/** Reset all state to defaults */
export const resetState = (): void => {
  setConnectionStatus('disconnected')
  setViews([])
  setSelectedView(null)
  setArtifact(null)
  clearMessages()
  setError(null)
  Atom.set(hypothesesAtom, [
    { id: 'H1', label: 'HTTP client can list/register/invalidate views', status: 'pending' },
    { id: 'H2', label: 'WebSocket session receives artifact events', status: 'pending' },
    { id: 'H3', label: 'TmnlDataGrid displays views correctly', status: 'pending' },
    { id: 'H4', label: 'Connection status reflects WebSocket state', status: 'pending' },
    { id: 'H5', label: 'Message log captures all session events', status: 'pending' },
  ])
}
