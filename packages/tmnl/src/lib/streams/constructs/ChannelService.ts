/**
 * ChannelService — Effect Service for Channel Lifecycle Management
 *
 * Orchestrates Channel instances with:
 *   - Registry for channel state management
 *   - PubSub command/event channels for event-driven control
 *   - Feed integration (connecting Feeds to Channel Inlets)
 *   - Stream materialization from topology
 *
 * Ontology (BFO):
 *   - ChannelService: independent continuant (site where processes occur)
 *   - Channel instances: generically dependent continuants (transferable topology)
 *   - Data flow: occurrent (process unfolding through topology)
 */

import {
  Effect,
  Context,
  Layer,
  Ref,
  PubSub,
  Queue,
  HashMap,
  Option,
  Scope,
  Console,
  Stream,
  Fiber,
  pipe,
} from "effect"
import { nanoid } from "nanoid"
import {
  type ChannelId,
  type InletId,
  type OutletId,
  type ChannelStatus,
  type ChannelCommand,
  type ChannelEvent,
  ChannelState,
  ChannelTopology,
  ChannelProtocol,
  ChannelMetrics,
  ChannelOpened,
  ChannelClosed,
  ChannelFaulted,
  InletConnected,
  InletDisconnected,
  OutletSubscribed,
  OutletUnsubscribed,
  Inlet,
  Outlet,
} from "./Channel"
import { ChannelBuilder, ChannelBuilderError } from "./ChannelBuilder"
import { Feed } from "./Feed"

// ============================================================================
// CHANNEL INSTANCE — Runtime representation
// ============================================================================

/**
 * ChannelInstance — Runtime wrapper around ChannelState
 *
 * While ChannelState is the pure data structure (GDC/ICE),
 * ChannelInstance adds runtime machinery:
 *   - Fiber references for active streams
 *   - Subscription management
 *   - Metrics updates
 */
export interface ChannelInstance {
  readonly state: ChannelState
  readonly fibers: HashMap.HashMap<string, Fiber.RuntimeFiber<void, unknown>>
  readonly subscriptions: HashMap.HashMap<string, Queue.Dequeue<unknown>>
}

const makeInstance = (state: ChannelState): ChannelInstance => ({
  state,
  fibers: HashMap.empty(),
  subscriptions: HashMap.empty(),
})

// ============================================================================
// CHANNEL SERVICE INTERFACE
// ============================================================================

export interface ChannelServiceShape {
  // ── Registration ───────────────────────────────────────────────────────────

  /**
   * Register a channel from builder.
   */
  readonly register: (
    builder: ChannelBuilder
  ) => Effect.Effect<ChannelId, ChannelBuilderError>

  /**
   * Register a pre-built ChannelState.
   */
  readonly registerState: (state: ChannelState) => Effect.Effect<ChannelId>

  /**
   * Unregister a channel.
   */
  readonly unregister: (id: ChannelId) => Effect.Effect<void>

  // ── Retrieval ──────────────────────────────────────────────────────────────

  /**
   * Get a channel by ID.
   */
  readonly get: (id: ChannelId) => Effect.Effect<Option.Option<ChannelInstance>>

  /**
   * Get channel state by ID.
   */
  readonly getState: (id: ChannelId) => Effect.Effect<Option.Option<ChannelState>>

  /**
   * List all registered channel IDs.
   */
  readonly listIds: () => Effect.Effect<ReadonlyArray<ChannelId>>

  /**
   * Get status of all channels.
   */
  readonly getStatuses: () => Effect.Effect<HashMap.HashMap<ChannelId, ChannelStatus>>

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Open a channel (transition to "open" state).
   */
  readonly open: (id: ChannelId) => Effect.Effect<void, ChannelServiceError>

  /**
   * Close a channel (transition to "closed" state).
   */
  readonly close: (id: ChannelId, reason?: string) => Effect.Effect<void>

  /**
   * Close all channels.
   */
  readonly closeAll: () => Effect.Effect<void>

  // ── Inlet Operations ───────────────────────────────────────────────────────

  /**
   * Connect a Feed to a Channel Inlet.
   */
  readonly connectFeed: <A, E, R>(
    channelId: ChannelId,
    inletId: InletId,
    feed: Feed<A, E, R>
  ) => Effect.Effect<void, ChannelServiceError>

  /**
   * Connect a Stream to a Channel Inlet.
   */
  readonly connectStream: <A, E, R>(
    channelId: ChannelId,
    inletId: InletId,
    stream: Stream.Stream<A, E, R>,
    sourceId?: string
  ) => Effect.Effect<void, ChannelServiceError, R>

  /**
   * Disconnect an Inlet.
   */
  readonly disconnectInlet: (
    channelId: ChannelId,
    inletId: InletId
  ) => Effect.Effect<void>

  // ── Outlet Operations ──────────────────────────────────────────────────────

  /**
   * Subscribe to an Outlet.
   */
  readonly subscribeOutlet: (
    channelId: ChannelId,
    outletId: OutletId,
    subscriberId?: string
  ) => Effect.Effect<Queue.Dequeue<unknown>, ChannelServiceError, Scope.Scope>

  /**
   * Get the output stream from an Outlet.
   */
  readonly getOutletStream: (
    channelId: ChannelId,
    outletId: OutletId
  ) => Effect.Effect<Stream.Stream<unknown, unknown, unknown>, ChannelServiceError>

  // ── Event Bus ──────────────────────────────────────────────────────────────

  /**
   * Command channel for external control.
   */
  readonly commands: PubSub.PubSub<ChannelCommand>

  /**
   * Event channel for observation.
   */
  readonly events: PubSub.PubSub<ChannelEvent>

  /**
   * Subscribe to events.
   */
  readonly subscribeEvents: () => Effect.Effect<Queue.Dequeue<ChannelEvent>, never, Scope.Scope>

  // ── Metrics ────────────────────────────────────────────────────────────────

  /**
   * Get metrics for a channel.
   */
  readonly getMetrics: (id: ChannelId) => Effect.Effect<Option.Option<ChannelMetrics>>

  /**
   * Update metrics (internal, but exposed for custom integrations).
   */
  readonly updateMetrics: (
    id: ChannelId,
    update: (m: ChannelMetrics) => ChannelMetrics
  ) => Effect.Effect<void>
}

// ============================================================================
// SERVICE TAG
// ============================================================================

export class ChannelService extends Context.Tag("tmnl/streams/ChannelService")<
  ChannelService,
  ChannelServiceShape
>() {}

// ============================================================================
// ERROR TYPE
// ============================================================================

import { Schema } from "effect"

export class ChannelServiceError extends Schema.TaggedError<ChannelServiceError>()(
  "ChannelServiceError",
  {
    message: Schema.String,
    code: Schema.Literal(
      "CHANNEL_NOT_FOUND",
      "INLET_NOT_FOUND",
      "OUTLET_NOT_FOUND",
      "ALREADY_OPEN",
      "NOT_OPEN",
      "ALREADY_CONNECTED",
      "BUILD_FAILED"
    ),
    channelId: Schema.optional(Schema.String),
  }
) {}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

const makeChannelService = Effect.gen(function* () {
  // Internal state
  const registry = yield* Ref.make<HashMap.HashMap<ChannelId, ChannelInstance>>(
    HashMap.empty()
  )
  const commandPubSub = yield* PubSub.unbounded<ChannelCommand>()
  const eventPubSub = yield* PubSub.unbounded<ChannelEvent>()

  // Outlet PubSubs for broadcasting
  const outletPubSubs = yield* Ref.make<
    HashMap.HashMap<string, PubSub.PubSub<unknown>>
  >(HashMap.empty())

  // ── Helpers ────────────────────────────────────────────────────────────────

  const emit = (event: ChannelEvent) => PubSub.publish(eventPubSub, event)

  const getEntry = (id: ChannelId) =>
    pipe(
      Ref.get(registry),
      Effect.map((map) => HashMap.get(map, id))
    )

  const updateEntry = (
    id: ChannelId,
    fn: (instance: ChannelInstance) => ChannelInstance
  ) =>
    Ref.update(registry, (map) => {
      const entry = HashMap.get(map, id)
      if (Option.isSome(entry)) {
        return HashMap.set(map, id, fn(entry.value))
      }
      return map
    })

  const updateState = (id: ChannelId, fn: (state: ChannelState) => ChannelState) =>
    updateEntry(id, (instance) => ({
      ...instance,
      state: fn(instance.state),
    }))

  const getOrCreateOutletPubSub = (outletKey: string) =>
    Effect.gen(function* () {
      const pubsubs = yield* Ref.get(outletPubSubs)
      const existing = HashMap.get(pubsubs, outletKey)
      if (Option.isSome(existing)) {
        return existing.value
      }
      const newPubSub = yield* PubSub.unbounded<unknown>()
      yield* Ref.update(outletPubSubs, (map) => HashMap.set(map, outletKey, newPubSub))
      return newPubSub
    })

  // ── Command Processor ──────────────────────────────────────────────────────

  const commandProcessor = pipe(
    Stream.fromPubSub(commandPubSub),
    Stream.tap((cmd) =>
      Console.log(`[ChannelService] Command received: ${cmd._tag}`)
    ),
    Stream.mapEffect((cmd) => {
      switch (cmd._tag) {
        case "OpenChannel":
          return service.open(cmd.id)
        case "CloseChannel":
          return service.close(cmd.id, cmd.reason)
        case "ConnectInlet":
          // For command-based connection, we'd need the stream/feed reference
          // This is handled via direct method calls
          return Console.log(
            `[ChannelService] ConnectInlet via command requires direct method call`
          )
        case "DisconnectInlet":
          return service.disconnectInlet(cmd.channelId, cmd.inletId)
        case "SubscribeOutlet":
          return Console.log(
            `[ChannelService] SubscribeOutlet via command requires direct method call`
          )
        case "UnsubscribeOutlet":
          return Console.log(
            `[ChannelService] UnsubscribeOutlet via command not yet implemented`
          )
        case "ResetCircuitBreaker":
          return Console.log(
            `[ChannelService] ResetCircuitBreaker not yet implemented`
          )
      }
    }),
    Stream.runDrain,
    Effect.fork
  )

  yield* commandProcessor
  yield* Console.log("[ChannelService] Command processor started")

  // ── Service Implementation ─────────────────────────────────────────────────

  const service: ChannelServiceShape = {
    // Registration
    register: (builder: ChannelBuilder) =>
      Effect.gen(function* () {
        const state = yield* builder.build()
        const instance = makeInstance(state)

        yield* Ref.update(registry, (map) => HashMap.set(map, state.id, instance))
        yield* Console.log(`[ChannelService] Registered channel: ${state.id}`)

        return state.id
      }),

    registerState: (state: ChannelState) =>
      Effect.gen(function* () {
        const instance = makeInstance(state)
        yield* Ref.update(registry, (map) => HashMap.set(map, state.id, instance))
        yield* Console.log(`[ChannelService] Registered channel state: ${state.id}`)
        return state.id
      }),

    unregister: (id: ChannelId) =>
      Effect.gen(function* () {
        const entry = yield* getEntry(id)
        if (Option.isSome(entry)) {
          // Close if open
          if (entry.value.state.status === "open") {
            yield* service.close(id)
          }
          yield* Ref.update(registry, (map) => HashMap.remove(map, id))
          yield* Console.log(`[ChannelService] Unregistered channel: ${id}`)
        }
      }),

    // Retrieval
    get: (id: ChannelId) => getEntry(id),

    getState: (id: ChannelId) =>
      pipe(
        getEntry(id),
        Effect.map((opt) => Option.map(opt, (e) => e.state))
      ),

    listIds: () =>
      pipe(
        Ref.get(registry),
        Effect.map((map) => Array.from(HashMap.keys(map)))
      ),

    getStatuses: () =>
      pipe(
        Ref.get(registry),
        Effect.map((map) =>
          pipe(
            HashMap.map(map, (instance) => instance.state.status),
            (m) => m as HashMap.HashMap<ChannelId, ChannelStatus>
          )
        )
      ),

    // Lifecycle
    open: (id: ChannelId) =>
      Effect.gen(function* () {
        const entry = yield* getEntry(id)
        if (Option.isNone(entry)) {
          yield* Effect.fail(
            new ChannelServiceError({
              message: `Channel not found: ${id}`,
              code: "CHANNEL_NOT_FOUND",
              channelId: id,
            })
          )
          return
        }

        const instance = entry.value
        if (instance.state.status === "open") {
          yield* Console.log(`[ChannelService] Channel already open: ${id}`)
          return
        }

        yield* updateState(id, (state) =>
          new ChannelState({
            id: state.id,
            name: state.name,
            status: "open",
            topology: new ChannelTopology({ ...state.topology }),
            protocol: new ChannelProtocol({ ...state.protocol }),
            metrics: new ChannelMetrics({ ...state.metrics }),
            createdAt: state.createdAt,
            openedAt: Date.now(),
            closedAt: state.closedAt,
          })
        )

        yield* emit(
          new ChannelOpened({
            channelId: id,
            timestamp: Date.now(),
          })
        )
        yield* Console.log(`[ChannelService] Opened channel: ${id}`)
      }),

    close: (id: ChannelId, reason?: string) =>
      Effect.gen(function* () {
        const entry = yield* getEntry(id)
        if (Option.isNone(entry)) return

        const instance = entry.value

        // Interrupt all fibers
        const fibers = Array.from(HashMap.values(instance.fibers))
        yield* Effect.all(
          fibers.map((f) => Fiber.interrupt(f)),
          { concurrency: "unbounded" }
        )

        yield* updateState(id, (state) =>
          new ChannelState({
            id: state.id,
            name: state.name,
            status: "closed",
            topology: new ChannelTopology({ ...state.topology }),
            protocol: new ChannelProtocol({ ...state.protocol }),
            metrics: new ChannelMetrics({ ...state.metrics }),
            createdAt: state.createdAt,
            openedAt: state.openedAt,
            closedAt: Date.now(),
          })
        )

        // Clear fibers
        yield* updateEntry(id, (inst) => ({
          ...inst,
          fibers: HashMap.empty(),
        }))

        yield* emit(
          new ChannelClosed({
            channelId: id,
            reason,
            timestamp: Date.now(),
          })
        )
        yield* Console.log(`[ChannelService] Closed channel: ${id}`)
      }),

    closeAll: () =>
      Effect.gen(function* () {
        const ids = yield* service.listIds()
        yield* Console.log(`[ChannelService] Closing all channels (${ids.length})...`)
        yield* Effect.all(
          ids.map((id) => service.close(id)),
          { concurrency: "unbounded" }
        )
      }),

    // Inlet Operations
    connectFeed: <A, E, R>(
      channelId: ChannelId,
      inletId: InletId,
      feed: Feed<A, E, R>
    ) =>
      service.connectStream(channelId, inletId, feed.stream, feed.id) as Effect.Effect<
        void,
        ChannelServiceError
      >,

    connectStream: <A, E, R>(
      channelId: ChannelId,
      inletId: InletId,
      stream: Stream.Stream<A, E, R>,
      sourceId?: string
    ) =>
      Effect.gen(function* () {
        const entry = yield* getEntry(channelId)
        if (Option.isNone(entry)) {
          yield* Effect.fail(
            new ChannelServiceError({
              message: `Channel not found: ${channelId}`,
              code: "CHANNEL_NOT_FOUND",
              channelId,
            })
          )
          return
        }

        const instance = entry.value
        const inlet = instance.state.topology.inlets.find((i) => i.id === inletId)
        if (!inlet) {
          yield* Effect.fail(
            new ChannelServiceError({
              message: `Inlet not found: ${inletId}`,
              code: "INLET_NOT_FOUND",
              channelId,
            })
          )
          return
        }

        if (inlet.connected) {
          yield* Effect.fail(
            new ChannelServiceError({
              message: `Inlet already connected: ${inletId}`,
              code: "ALREADY_CONNECTED",
              channelId,
            })
          )
          return
        }

        const finalSourceId = sourceId ?? `stream:${nanoid(8)}`

        // Find connected outlets and broadcast to them
        const wires = instance.state.topology.wires.filter(
          (w) => w.from === inletId && w.active
        )

        // For each wire, get the outlet and push to its pubsub
        const fiber = yield* pipe(
          stream,
          Stream.tap((item) =>
            Effect.gen(function* () {
              // Update metrics
              yield* service.updateMetrics(channelId, (m) =>
                new ChannelMetrics({
                  ...m,
                  messagesIn: m.messagesIn + 1,
                })
              )

              // Route to connected outlets
              for (const wire of wires) {
                const outletKey = `${channelId}:${wire.to}`
                const pubsub = yield* getOrCreateOutletPubSub(outletKey)
                yield* PubSub.publish(pubsub, item)
              }
            })
          ),
          Stream.runDrain,
          Effect.fork
        )

        // Update inlet state
        yield* updateState(channelId, (state) => {
          const updatedInlets = state.topology.inlets.map((i) =>
            i.id === inletId
              ? new Inlet({ ...i, connected: true, sourceId: finalSourceId })
              : i
          )
          return new ChannelState({
            ...state,
            topology: new ChannelTopology({
              ...state.topology,
              inlets: updatedInlets,
            }),
          })
        })

        // Store fiber reference
        yield* updateEntry(channelId, (inst) => ({
          ...inst,
          fibers: HashMap.set(inst.fibers, inletId, fiber as Fiber.RuntimeFiber<void, unknown>),
        }))

        yield* emit(
          new InletConnected({
            channelId,
            inletId,
            sourceId: finalSourceId,
            timestamp: Date.now(),
          })
        )

        yield* Console.log(
          `[ChannelService] Connected stream to inlet ${inletId} on channel ${channelId}`
        )
      }) as Effect.Effect<void, ChannelServiceError, R>,

    disconnectInlet: (channelId: ChannelId, inletId: InletId) =>
      Effect.gen(function* () {
        const entry = yield* getEntry(channelId)
        if (Option.isNone(entry)) return

        const instance = entry.value
        const fiber = HashMap.get(instance.fibers, inletId)
        if (Option.isSome(fiber)) {
          yield* Fiber.interrupt(fiber.value)
        }

        // Update inlet state
        yield* updateState(channelId, (state) => {
          const updatedInlets = state.topology.inlets.map((i) =>
            i.id === inletId
              ? new Inlet({ ...i, connected: false, sourceId: undefined })
              : i
          )
          return new ChannelState({
            ...state,
            topology: new ChannelTopology({
              ...state.topology,
              inlets: updatedInlets,
            }),
          })
        })

        // Remove fiber reference
        yield* updateEntry(channelId, (inst) => ({
          ...inst,
          fibers: HashMap.remove(inst.fibers, inletId),
        }))

        yield* emit(
          new InletDisconnected({
            channelId,
            inletId,
            timestamp: Date.now(),
          })
        )

        yield* Console.log(
          `[ChannelService] Disconnected inlet ${inletId} on channel ${channelId}`
        )
      }),

    // Outlet Operations
    subscribeOutlet: (
      channelId: ChannelId,
      outletId: OutletId,
      subscriberId?: string
    ) =>
      Effect.gen(function* () {
        const entry = yield* getEntry(channelId)
        if (Option.isNone(entry)) {
          yield* Effect.fail(
            new ChannelServiceError({
              message: `Channel not found: ${channelId}`,
              code: "CHANNEL_NOT_FOUND",
              channelId,
            })
          )
          // This won't execute, but TypeScript needs it
          return yield* Queue.unbounded<unknown>()
        }

        const instance = entry.value
        const outlet = instance.state.topology.outlets.find((o) => o.id === outletId)
        if (!outlet) {
          yield* Effect.fail(
            new ChannelServiceError({
              message: `Outlet not found: ${outletId}`,
              code: "OUTLET_NOT_FOUND",
              channelId,
            })
          )
          return yield* Queue.unbounded<unknown>()
        }

        const finalSubscriberId = subscriberId ?? `sub:${nanoid(8)}`
        const outletKey = `${channelId}:${outletId}`
        const pubsub = yield* getOrCreateOutletPubSub(outletKey)
        const queue = yield* PubSub.subscribe(pubsub)

        // Update outlet subscriber count
        yield* updateState(channelId, (state) => {
          const updatedOutlets = state.topology.outlets.map((o) =>
            o.id === outletId
              ? new Outlet({ ...o, subscriberCount: o.subscriberCount + 1 })
              : o
          )
          return new ChannelState({
            ...state,
            topology: new ChannelTopology({
              ...state.topology,
              outlets: updatedOutlets,
            }),
          })
        })

        yield* emit(
          new OutletSubscribed({
            channelId,
            outletId,
            subscriberId: finalSubscriberId,
            timestamp: Date.now(),
          })
        )

        yield* Console.log(
          `[ChannelService] Subscribed to outlet ${outletId} on channel ${channelId}`
        )

        return queue
      }),

    getOutletStream: (channelId: ChannelId, outletId: OutletId) =>
      Effect.gen(function* () {
        const entry = yield* getEntry(channelId)
        if (Option.isNone(entry)) {
          yield* Effect.fail(
            new ChannelServiceError({
              message: `Channel not found: ${channelId}`,
              code: "CHANNEL_NOT_FOUND",
              channelId,
            })
          )
          return Stream.empty as Stream.Stream<unknown, unknown, unknown>
        }

        const outlet = entry.value.state.topology.outlets.find(
          (o) => o.id === outletId
        )
        if (!outlet) {
          yield* Effect.fail(
            new ChannelServiceError({
              message: `Outlet not found: ${outletId}`,
              code: "OUTLET_NOT_FOUND",
              channelId,
            })
          )
          return Stream.empty as Stream.Stream<unknown, unknown, unknown>
        }

        const outletKey = `${channelId}:${outletId}`
        const pubsub = yield* getOrCreateOutletPubSub(outletKey)

        return Stream.fromPubSub(pubsub)
      }),

    // Event Bus
    commands: commandPubSub,
    events: eventPubSub,
    subscribeEvents: () => PubSub.subscribe(eventPubSub),

    // Metrics
    getMetrics: (id: ChannelId) =>
      pipe(
        getEntry(id),
        Effect.map((opt) => Option.map(opt, (e) => e.state.metrics))
      ),

    updateMetrics: (
      id: ChannelId,
      update: (m: ChannelMetrics) => Partial<ChannelMetrics>
    ) =>
      updateState(id, (state) =>
        new ChannelState({
          id: state.id,
          name: state.name,
          status: state.status,
          topology: new ChannelTopology({ ...state.topology }),
          protocol: new ChannelProtocol({ ...state.protocol }),
          metrics: new ChannelMetrics({ ...state.metrics, ...update(state.metrics) }),
          createdAt: state.createdAt,
          openedAt: state.openedAt,
          closedAt: state.closedAt,
        })
      ),
  }

  return service
})

// ============================================================================
// LAYERS
// ============================================================================

/**
 * Live layer — creates a ChannelService instance.
 */
export const ChannelServiceLive: Layer.Layer<ChannelService> = Layer.effect(
  ChannelService,
  makeChannelService
)

/**
 * Scoped layer — ChannelService bound to a Scope (cleans up on scope close).
 */
export const ChannelServiceScoped: Layer.Layer<
  ChannelService,
  never,
  Scope.Scope
> = Layer.scoped(
  ChannelService,
  Effect.gen(function* () {
    const service = yield* makeChannelService

    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        yield* Console.log("[ChannelService] Scope closing, closing all channels...")
        yield* service.closeAll()
      })
    )

    return service
  })
)

// ============================================================================
// CONVENIENCE ACCESSORS
// ============================================================================

/**
 * Access ChannelService from context.
 */
export const channelService = ChannelService

/**
 * Register a channel from builder (requires ChannelService in context).
 */
export const registerChannel = (
  builder: ChannelBuilder
): Effect.Effect<ChannelId, ChannelBuilderError, ChannelService> =>
  Effect.flatMap(ChannelService, (s) => s.register(builder))

/**
 * Get a channel by ID (requires ChannelService in context).
 */
export const getChannel = (
  id: ChannelId
): Effect.Effect<Option.Option<ChannelInstance>, never, ChannelService> =>
  Effect.flatMap(ChannelService, (s) => s.get(id))

/**
 * Open a channel (requires ChannelService in context).
 */
export const openChannel = (
  id: ChannelId
): Effect.Effect<void, ChannelServiceError, ChannelService> =>
  Effect.flatMap(ChannelService, (s) => s.open(id))

/**
 * Connect a Feed to a Channel Inlet (requires ChannelService in context).
 */
export const connectFeedToChannel = <A, E, R>(
  channelId: ChannelId,
  inletId: InletId,
  feed: Feed<A, E, R>
): Effect.Effect<void, ChannelServiceError, ChannelService> =>
  Effect.flatMap(ChannelService, (s) => s.connectFeed(channelId, inletId, feed))
