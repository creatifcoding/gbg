/**
 * ChannelService — Effect Service for Channel Lifecycle Management
 *
 * Orchestrates Channel instances with:
 *   - Registry for channel state management
 *   - PubSub command/event channels for event-driven control
 *   - Feed integration (connecting Feeds to Channel Inlets)
 *   - Stream materialization from topology
 *   - Junction-aware routing with stateful semantics (throttle/debounce/buffer/timeout)
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
  Exit,
  Console,
  Stream,
  Fiber,
  Schedule,
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
  type JunctionKind,
  type BackpressureStrategy,
  ChannelState,
  ChannelTopology,
  ChannelProtocol,
  CircuitBreakerConfig,
  ChannelMetrics,
  ChannelOpened,
  ChannelClosed,
  ChannelFaulted,
  CircuitBreakerTripped,
  CircuitBreakerReset,
  TimeoutOccurred,
  BackpressureEngaged,
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
  ) => Effect.Effect<void, ChannelServiceError, R>

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
  readonly subscribeOutlet: <A = unknown>(
    channelId: ChannelId,
    outletId: OutletId,
    subscriberId?: string
  ) => Effect.Effect<Queue.Dequeue<A>, ChannelServiceError, Scope.Scope>

  /**
   * Get the output stream from an Outlet.
   */
  readonly getOutletStream: <A = unknown>(
    channelId: ChannelId,
    outletId: OutletId
  ) => Effect.Effect<Stream.Stream<A, never, Scope.Scope>, ChannelServiceError>

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
    update: (m: ChannelMetrics) => Partial<ChannelMetrics>
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
      "INLET_SCHEMA_VALIDATION_FAILED",
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
  const serviceScope = yield* Scope.make()
  const commandPubSub = yield* PubSub.unbounded<ChannelCommand>()
  const eventPubSub = yield* PubSub.unbounded<ChannelEvent>()
  const commandProcessorFiberRef = yield* Ref.make<
    Option.Option<Fiber.RuntimeFiber<void, unknown>>
  >(Option.none())

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

  const getOrCreateOutletPubSub = <A = unknown>(outletKey: string) =>
    Effect.gen(function* () {
      const pubsubs = yield* Ref.get(outletPubSubs)
      const existing = HashMap.get(pubsubs, outletKey)
      if (Option.isSome(existing)) {
        return existing.value as PubSub.PubSub<A>
      }
      const newPubSub = yield* PubSub.unbounded<A>()
      yield* Ref.update(outletPubSubs, (map) => HashMap.set(map, outletKey, newPubSub))
      return newPubSub
    })

  const estimateBytes = (value: unknown): number => {
    try {
      const encoded = JSON.stringify(value)
      return encoded ? encoded.length : 0
    } catch {
      return 0
    }
  }

  interface JunctionRuntimeState {
    readonly throttleLastEmitAt?: number
    readonly debounceVersion?: number
    readonly debouncePending?: unknown
    readonly bufferQueue?: ReadonlyArray<unknown>
    readonly bufferDraining?: boolean
  }

  const junctionRuntimeRef = yield* Ref.make<
    HashMap.HashMap<string, JunctionRuntimeState>
  >(HashMap.empty())

  const circuitOpenUntilRef = yield* Ref.make<
    HashMap.HashMap<ChannelId, number>
  >(HashMap.empty())

  const getRuntimeConfig = (config: unknown): Record<string, unknown> | undefined =>
    typeof config === "object" && config !== null
      ? (config as Record<string, unknown>)
      : undefined

  const parseDurationMs = (value: unknown, fallbackMs: number): number => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value
    }

    if (typeof value !== "string") {
      return fallbackMs
    }

    const normalized = value.trim().toLowerCase()
    const numericOnly = Number(normalized)
    if (Number.isFinite(numericOnly) && numericOnly > 0) {
      return numericOnly
    }

    const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(ms|msec|millis?|milliseconds?|s|sec|secs|second|seconds|m|min|mins|minute|minutes)$/)
    if (!match) {
      return fallbackMs
    }

    const magnitude = Number(match[1])
    const unit = match[2]
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      return fallbackMs
    }

    switch (unit) {
      case "ms":
      case "msec":
      case "milli":
      case "millis":
      case "millisecond":
      case "milliseconds":
        return magnitude
      case "s":
      case "sec":
      case "secs":
      case "second":
      case "seconds":
        return magnitude * 1000
      case "m":
      case "min":
      case "mins":
      case "minute":
      case "minutes":
        return magnitude * 60_000
      default:
        return fallbackMs
    }
  }

  const readDurationConfig = (
    config: Record<string, unknown> | undefined,
    keys: ReadonlyArray<string>,
    fallbackMs: number
  ): number => {
    for (const key of keys) {
      if (config && key in config) {
        return parseDurationMs(config[key], fallbackMs)
      }
    }
    return fallbackMs
  }

  const readNumberConfig = (
    config: Record<string, unknown> | undefined,
    keys: ReadonlyArray<string>,
    fallback: number
  ): number => {
    for (const key of keys) {
      const candidate = config?.[key]
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return candidate
      }
    }
    return fallback
  }

  const readStringConfig = (
    config: Record<string, unknown> | undefined,
    keys: ReadonlyArray<string>,
    fallback: string
  ): string => {
    for (const key of keys) {
      const candidate = config?.[key]
      if (typeof candidate === "string" && candidate.length > 0) {
        return candidate
      }
    }
    return fallback
  }

  const buildRetryPolicy = (state: ChannelState) => {
    const config = getRuntimeConfig(state.protocol.retry)
    if (!config) {
      return Option.none<{
        readonly times: number
        readonly schedule: Schedule.Schedule<unknown, unknown, never>
      }>()
    }

    const times = Math.max(0, Math.floor(readNumberConfig(config, ["times"], 0)))
    const initialDelayMs = Math.max(
      1,
      readDurationConfig(config, ["initialDelay", "delay", "interval"], 100)
    )
    const backoff = readStringConfig(config, ["backoff"], "fixed")

    let schedule: Schedule.Schedule<unknown, unknown, never>
    switch (backoff) {
      case "exponential":
        schedule = Schedule.exponential(`${initialDelayMs} millis`, 2)
        break
      case "fibonacci":
        schedule = Schedule.fibonacci(`${initialDelayMs} millis`)
        break
      case "fixed":
      default:
        schedule = Schedule.spaced(`${initialDelayMs} millis`)
        break
    }

    if ("maxDelay" in config) {
      const maxDelayMs = parseDurationMs(config.maxDelay, 0)
      if (maxDelayMs > 0) {
        schedule = schedule.pipe(Schedule.upTo(`${maxDelayMs} millis`))
      }
    }

    return Option.some({ times, schedule })
  }

  const recordCircuitFailure = (channelId: ChannelId) =>
    Effect.gen(function* () {
      const entry = yield* getEntry(channelId)
      if (Option.isNone(entry)) {
        return
      }

      const circuit = entry.value.state.protocol.circuitBreaker
      if (!circuit) {
        return
      }

      const thresholdValue = Number(circuit.threshold)
      const threshold =
        Number.isFinite(thresholdValue) && thresholdValue > 0
          ? Math.floor(thresholdValue)
          : 1
      const failureCountValue = Number(circuit.failureCount)
      const currentFailureCount = Number.isFinite(failureCountValue)
        ? failureCountValue
        : 0
      const nextFailureCount = currentFailureCount + 1
      const shouldTrip = circuit.state !== "open" && nextFailureCount >= threshold
      const nextState = shouldTrip ? "open" : circuit.state

      yield* updateState(channelId, (state) => {
        const currentCircuit = state.protocol.circuitBreaker
        if (!currentCircuit) {
          return state
        }

        return new ChannelState({
          ...state,
          protocol: new ChannelProtocol({
            ...state.protocol,
            circuitBreaker: new CircuitBreakerConfig({
              ...currentCircuit,
              failureCount: nextFailureCount,
              state: nextState,
            }),
          }),
        })
      })

      if (shouldTrip) {
        const resetAfterMs = parseDurationMs(circuit.resetAfter, 30_000)
        const openUntil = Date.now() + resetAfterMs
        yield* Ref.update(circuitOpenUntilRef, (map) => HashMap.set(map, channelId, openUntil))

        yield* emit(
          new CircuitBreakerTripped({
            channelId,
            failureCount: nextFailureCount,
            timestamp: Date.now(),
          })
        )
      }
    })

  const recordCircuitSuccess = (channelId: ChannelId) =>
    Effect.gen(function* () {
      const entry = yield* getEntry(channelId)
      if (Option.isNone(entry)) {
        return
      }

      const circuit = entry.value.state.protocol.circuitBreaker
      if (!circuit) {
        return
      }

      const failureCountValue = Number(circuit.failureCount)
      const currentFailureCount = Number.isFinite(failureCountValue)
        ? failureCountValue
        : 0
      const needsReset = circuit.state !== "closed" || currentFailureCount !== 0
      if (!needsReset) {
        return
      }

      yield* updateState(channelId, (state) => {
        const currentCircuit = state.protocol.circuitBreaker
        if (!currentCircuit) {
          return state
        }

        return new ChannelState({
          ...state,
          protocol: new ChannelProtocol({
            ...state.protocol,
            circuitBreaker: new CircuitBreakerConfig({
              ...currentCircuit,
              state: "closed",
              failureCount: 0,
            }),
          }),
        })
      })

      yield* Ref.update(circuitOpenUntilRef, (map) => HashMap.remove(map, channelId))

      if (circuit.state !== "closed") {
        yield* emit(
          new CircuitBreakerReset({
            channelId,
            timestamp: Date.now(),
          })
        )
      }
    })

  const resetCircuitBreakerState = (channelId: ChannelId) =>
    Effect.gen(function* () {
      const entry = yield* getEntry(channelId)
      if (Option.isNone(entry)) {
        return
      }

      const circuit = entry.value.state.protocol.circuitBreaker
      if (!circuit) {
        return
      }

      yield* updateState(channelId, (state) => {
        const currentCircuit = state.protocol.circuitBreaker
        if (!currentCircuit) {
          return state
        }

        return new ChannelState({
          ...state,
          protocol: new ChannelProtocol({
            ...state.protocol,
            circuitBreaker: new CircuitBreakerConfig({
              ...currentCircuit,
              state: "closed",
              failureCount: 0,
            }),
          }),
        })
      })

      yield* Ref.update(circuitOpenUntilRef, (map) => HashMap.remove(map, channelId))
      yield* emit(
        new CircuitBreakerReset({
          channelId,
          timestamp: Date.now(),
        })
      )
    })

  const awaitCircuitReady = (channelId: ChannelId) =>
    Effect.gen(function* () {
      const entry = yield* getEntry(channelId)
      if (Option.isNone(entry)) {
        return
      }

      const circuit = entry.value.state.protocol.circuitBreaker
      if (!circuit || circuit.state !== "open") {
        return
      }

      const resetAfterMs = parseDurationMs(circuit.resetAfter, 30_000)
      const now = Date.now()
      const openUntilMap = yield* Ref.get(circuitOpenUntilRef)
      const configuredOpenUntil = HashMap.get(openUntilMap, channelId)
      const openUntil = Option.isSome(configuredOpenUntil)
        ? configuredOpenUntil.value
        : now + resetAfterMs

      if (openUntil > now) {
        yield* Effect.sleep(`${openUntil - now} millis`)
      }

      yield* updateState(channelId, (state) => {
        const currentCircuit = state.protocol.circuitBreaker
        if (!currentCircuit || currentCircuit.state !== "open") {
          return state
        }

        return new ChannelState({
          ...state,
          protocol: new ChannelProtocol({
            ...state.protocol,
            circuitBreaker: new CircuitBreakerConfig({
              ...currentCircuit,
              state: "half-open",
            }),
          }),
        })
      })

      yield* Ref.update(circuitOpenUntilRef, (map) => HashMap.remove(map, channelId))
    })

  const normalizeBufferStrategy = (
    value: string
  ): BackpressureStrategy => {
    switch (value) {
      case "drop-newest":
      case "drop-oldest":
      case "error":
      case "block":
        return value
      default:
        return "drop-oldest"
    }
  }

  const getJunctionState = (junctionKey: string) =>
    pipe(
      Ref.get(junctionRuntimeRef),
      Effect.map((map) => {
        const existing = HashMap.get(map, junctionKey)
        return Option.isSome(existing) ? existing.value : ({} as JunctionRuntimeState)
      })
    )

  const modifyJunctionState = <A>(
    junctionKey: string,
    fn: (state: JunctionRuntimeState) => readonly [A, JunctionRuntimeState]
  ) =>
    Ref.modify(junctionRuntimeRef, (map) => {
      const existing = HashMap.get(map, junctionKey)
      const current = Option.isSome(existing)
        ? existing.value
        : ({} as JunctionRuntimeState)
      const [result, next] = fn(current)
      return [result, HashMap.set(map, junctionKey, next)] as const
    })

  const clearChannelJunctionState = (channelId: ChannelId) =>
    Ref.update(junctionRuntimeRef, (map) => {
      const prefix = `${channelId}:`
      let next = map
      for (const key of HashMap.keys(map)) {
        if (key.startsWith(prefix)) {
          next = HashMap.remove(next, key)
        }
      }
      return next
    })

  const clearChannelCircuitState = (channelId: ChannelId) =>
    Ref.update(circuitOpenUntilRef, (map) => HashMap.remove(map, channelId))

  const clearChannelOutletPubSubs = (channelId: ChannelId) =>
    Effect.gen(function* () {
      const prefix = `${channelId}:`
      const current = yield* Ref.get(outletPubSubs)
      let next = current

      for (const key of HashMap.keys(current)) {
        const keyString = String(key)
        if (!keyString.startsWith(prefix)) {
          continue
        }

        const candidate = HashMap.get(current, key)
        if (Option.isSome(candidate)) {
          yield* PubSub.shutdown(candidate.value)
        }
        next = HashMap.remove(next, key)
      }

      yield* Ref.set(outletPubSubs, next)
    })

  const spawnTrackedDaemon = (
    channelId: ChannelId,
    label: string,
    effect: Effect.Effect<void>
  ): Effect.Effect<void> =>
    Effect.gen(function* () {
      const live = yield* getEntry(channelId)
      if (Option.isNone(live) || live.value.state.status !== "open") {
        return
      }

      const fiberKey = `aux:${label}:${nanoid(6)}`
      const fiber = yield* pipe(
        effect.pipe(
          Effect.ensuring(
            updateEntry(channelId, (inst) => ({
              ...inst,
              fibers: HashMap.remove(inst.fibers, fiberKey),
            }))
          )
        ),
        Effect.forkIn(serviceScope)
      )

      yield* updateEntry(channelId, (inst) => ({
        ...inst,
        fibers: HashMap.set(inst.fibers, fiberKey, fiber as Fiber.RuntimeFiber<void, unknown>),
      }))
    })

  const getActiveOutgoingWires = (
    topology: ChannelTopology,
    fromId: string
  ) => topology.wires.filter((wire) => wire.active && String(wire.from) === fromId)

  const applyStatelessJunction = (
    kind: JunctionKind,
    config: unknown,
    item: unknown
  ): Effect.Effect<ReadonlyArray<unknown>> =>
    Effect.sync(() => {
      const cfg = getRuntimeConfig(config)

      switch (kind) {
        case "map": {
          const mapper =
            (cfg?.map as ((input: unknown) => unknown) | undefined) ??
            (cfg?.transform as ((input: unknown) => unknown) | undefined)
          return mapper ? [mapper(item)] : [item]
        }

        case "flatMap": {
          const mapper = cfg?.flatMap as
            | ((input: unknown) => unknown | ReadonlyArray<unknown>)
            | undefined
          if (!mapper) return [item]
          const mapped = mapper(item)
          return Array.isArray(mapped) ? mapped : [mapped]
        }

        case "filter": {
          const predicate = cfg?.predicate as
            | ((input: unknown) => boolean)
            | undefined
          return predicate ? (predicate(item) ? [item] : []) : [item]
        }

        case "merge":
        case "broadcast":
          return [item]

        case "partition":
        case "buffer":
        case "throttle":
        case "debounce":
        case "timeout":
          // Stateful / specialized junctions are routed in `routeFromNode`.
          // Returning empty avoids silent semantic fallback if this path is reached.
          return []
      }
    })

  const routeFromNode = (
    channelId: ChannelId,
    topology: ChannelTopology,
    fromNodeId: string,
    item: unknown,
    visited: ReadonlySet<string> = new Set()
  ): Effect.Effect<void> =>
    Effect.gen(function* () {
      const live = yield* getEntry(channelId)
      if (Option.isNone(live) || live.value.state.status !== "open") {
        return
      }

      if (visited.has(fromNodeId)) {
        return
      }

      const nextVisited = new Set(visited)
      nextVisited.add(fromNodeId)

      const outgoing = getActiveOutgoingWires(topology, fromNodeId)
      for (const wire of outgoing) {
        const targetId = String(wire.to)

        const outlet = topology.outlets.find((candidate) => candidate.id === targetId)
        if (outlet) {
          const outletSchema = outlet.schema

          const decodedForOutlet =
            outletSchema === undefined
              ? Effect.succeed(item)
              : !Schema.isSchema(outletSchema)
                ? Effect.fail("invalid-outlet-schema" as const)
                : pipe(
                    Schema.decodeUnknown(outletSchema)(item),
                    Effect.mapError(() => "outlet-schema-validation-failed" as const)
                  )

          const outletPayload = yield* pipe(decodedForOutlet, Effect.either)

          if (outletPayload._tag === "Left") {
            yield* service.updateMetrics(channelId, (m) => ({ errors: m.errors + 1 }))
            yield* emit(
              new ChannelFaulted({
                channelId,
                error:
                  outletPayload.left === "invalid-outlet-schema"
                    ? `Outlet schema is not a valid Effect Schema for outlet ${String(outlet.id)}`
                    : `Outlet schema validation failed for ${String(outlet.id)}`,
                timestamp: Date.now(),
              })
            )
            continue
          }

          const outletKey = `${channelId}:${outlet.id}`
          const pubsub = yield* getOrCreateOutletPubSub(outletKey)
          yield* PubSub.publish(pubsub, outletPayload.right)
          yield* service.updateMetrics(channelId, (m) => ({
            messagesOut: m.messagesOut + 1,
            bytesOut: m.bytesOut + estimateBytes(outletPayload.right),
          }))
          continue
        }

        const junction = topology.junctions.find(
          (candidate) => candidate.id === targetId
        )
        if (!junction) {
          continue
        }

        const junctionKey = `${channelId}:${junction.id}`
        const config = getRuntimeConfig(junction.config)

        if (junction.kind === "partition") {
          const predicate = config?.predicate
          if (typeof predicate !== "function") {
            yield* service.updateMetrics(channelId, (m) => ({ errors: m.errors + 1 }))
            yield* emit(
              new ChannelFaulted({
                channelId,
                error: `Partition junction requires config.predicate function: ${String(junction.id)}`,
                timestamp: Date.now(),
              })
            )
            continue
          }

          const leftLabel = readStringConfig(config, ["leftLabel", "left"], "left")
          const rightLabel = readStringConfig(config, ["rightLabel", "right"], "right")

          const branchResult = yield* Effect.try({
            try: () => (predicate(item) ? leftLabel : rightLabel),
            catch: () => new Error(`Partition predicate threw for ${String(junction.id)}`),
          }).pipe(Effect.either)

          if (branchResult._tag === "Left") {
            yield* service.updateMetrics(channelId, (m) => ({ errors: m.errors + 1 }))
            yield* emit(
              new ChannelFaulted({
                channelId,
                error: branchResult.left.message,
                timestamp: Date.now(),
              })
            )
            continue
          }

          const branch = branchResult.right

          const partitioned = {
            _tag: "Partitioned",
            branch,
            value: item,
            junctionId: String(junction.id),
          }

          yield* routeFromNode(
            channelId,
            topology,
            String(junction.id),
            partitioned,
            nextVisited
          )
          continue
        }

        if (junction.kind === "throttle") {
          const intervalMs = readDurationConfig(
            config,
            ["intervalMs", "interval", "windowMs", "window"],
            100
          )
          const now = Date.now()
          const allow = yield* modifyJunctionState(junctionKey, (state) => {
            const last = state.throttleLastEmitAt ?? 0
            if (now - last >= intervalMs) {
              return [true, { ...state, throttleLastEmitAt: now }] as const
            }
            return [false, state] as const
          })

          if (!allow) {
            continue
          }

          yield* routeFromNode(
            channelId,
            topology,
            String(junction.id),
            item,
            nextVisited
          )
          continue
        }

        if (junction.kind === "debounce") {
          const waitMs = readDurationConfig(
            config,
            ["waitMs", "wait", "debounceMs", "durationMs", "duration"],
            100
          )

          const version = yield* modifyJunctionState(junctionKey, (state) => {
            const nextVersion = (state.debounceVersion ?? 0) + 1
            return [
              nextVersion,
              {
                ...state,
                debounceVersion: nextVersion,
                debouncePending: item,
              },
            ] as const
          })

          yield* spawnTrackedDaemon(
            channelId,
            `debounce:${String(junction.id)}`,
            Effect.gen(function* () {
              yield* Effect.sleep(`${waitMs} millis`)
              const state = yield* getJunctionState(junctionKey)
              if ((state.debounceVersion ?? 0) !== version) {
                return
              }

              const pending = state.debouncePending
              if (pending === undefined) {
                return
              }

              yield* modifyJunctionState(junctionKey, (nextState) => [
                undefined,
                { ...nextState, debouncePending: undefined },
              ])

              yield* routeFromNode(
                channelId,
                topology,
                String(junction.id),
                pending,
                new Set()
              )
            })
          )
          continue
        }

        if (junction.kind === "buffer") {
          const capacity = Math.max(
            1,
            Math.floor(readNumberConfig(config, ["capacity", "maxSize"], 64))
          )
          const strategy = normalizeBufferStrategy(
            readStringConfig(config, ["strategy", "overflow"], "drop-oldest")
          )
          const flushMs = readDurationConfig(
            config,
            ["flushMs", "flushIntervalMs", "intervalMs"],
            0
          )

          const enqueueAttempt = () =>
            modifyJunctionState(junctionKey, (state) => {
              const queue = [...(state.bufferQueue ?? [])]

              if (queue.length >= capacity) {
                switch (strategy) {
                  case "drop-newest":
                    return [
                      { enqueued: false, overflowed: true, bufferSize: queue.length },
                      state,
                    ] as const
                  case "error":
                    return [
                      { enqueued: false, overflowed: true, bufferSize: queue.length },
                      state,
                    ] as const
                  case "block":
                    return [
                      { enqueued: false, overflowed: true, bufferSize: queue.length },
                      state,
                    ] as const
                  case "drop-oldest":
                  default:
                    queue.shift()
                }
              }

              queue.push(item)
              return [
                { enqueued: true, overflowed: false, bufferSize: queue.length },
                { ...state, bufferQueue: queue },
              ] as const
            })

          let enqueued = false
          let overflowHandled = false

          while (!enqueued) {
            const outcome = yield* enqueueAttempt()
            if (outcome.enqueued) {
              enqueued = true
              break
            }

            if (!overflowHandled) {
              overflowHandled = true
              yield* emit(
                new BackpressureEngaged({
                  channelId,
                  strategy,
                  bufferSize: outcome.bufferSize,
                  timestamp: Date.now(),
                })
              )
            }

            if (strategy === "drop-newest") {
              break
            }

            if (strategy === "error") {
              yield* service.updateMetrics(channelId, (m) => ({ errors: m.errors + 1 }))
              yield* emit(
                new ChannelFaulted({
                  channelId,
                  error: `Buffer overflow on ${String(junction.id)} (strategy=error, capacity=${capacity})`,
                  timestamp: Date.now(),
                })
              )
              break
            }

            const liveChannel = yield* getEntry(channelId)
            if (
              Option.isNone(liveChannel) ||
              liveChannel.value.state.status !== "open"
            ) {
              break
            }

            // strategy === "block"
            yield* Effect.sleep("1 millis")
          }

          const shouldStartDrainer = yield* modifyJunctionState(
            junctionKey,
            (state) => {
              const queue = state.bufferQueue ?? []
              if (state.bufferDraining || queue.length === 0) {
                return [false, state] as const
              }
              return [true, { ...state, bufferDraining: true }] as const
            }
          )

          if (shouldStartDrainer) {
            yield* spawnTrackedDaemon(
              channelId,
              `buffer:${String(junction.id)}`,
              Effect.gen(function* () {
                while (true) {
                  if (flushMs > 0) {
                    yield* Effect.sleep(`${flushMs} millis`)
                  } else {
                    // Prevent scheduler starvation on zero-flush configurations.
                    yield* Effect.yieldNow()
                  }

                  const dequeued = yield* modifyJunctionState(
                    junctionKey,
                    (state) => {
                      const queue = [...(state.bufferQueue ?? [])]
                      if (queue.length === 0) {
                        return [
                          Option.none<unknown>(),
                          { ...state, bufferDraining: false, bufferQueue: queue },
                        ] as const
                      }
                      const nextItem = queue.shift() as unknown
                      return [
                        Option.some(nextItem),
                        { ...state, bufferDraining: true, bufferQueue: queue },
                      ] as const
                    }
                  )

                  if (Option.isNone(dequeued)) {
                    return
                  }

                  yield* routeFromNode(
                    channelId,
                    topology,
                    String(junction.id),
                    dequeued.value,
                    new Set()
                  )
                }
              })
            )
          }

          continue
        }

        if (junction.kind === "timeout") {
          const timeoutMs = readDurationConfig(
            config,
            ["timeoutMs", "durationMs", "duration", "windowMs"],
            1000
          )
          const behavior = readStringConfig(config, ["behavior"], "fail")

          const itemTimestamp =
            typeof item === "object" && item !== null && "timestamp" in item
              ? (item as { readonly timestamp?: unknown }).timestamp
              : undefined

          const staleByTimestamp =
            typeof itemTimestamp === "number" && Date.now() - itemTimestamp > timeoutMs

          const downstream = staleByTimestamp
            ? Option.none<void>()
            : yield* pipe(
                routeFromNode(channelId, topology, String(junction.id), item, nextVisited),
                Effect.timeout(`${timeoutMs} millis`),
                Effect.option
              )

          if (Option.isNone(downstream)) {
            yield* emit(
              new TimeoutOccurred({
                channelId,
                inletId: undefined,
                duration: `${timeoutMs} millis`,
                timestamp: Date.now(),
              })
            )

            if (behavior === "warn") {
              yield* Console.warn(
                `[ChannelService] Timeout junction warning on ${String(junction.id)} after ${timeoutMs}ms`
              )
            }

            if (behavior === "fail") {
              yield* service.updateMetrics(channelId, (m) => ({ errors: m.errors + 1 }))
              yield* emit(
                new ChannelFaulted({
                  channelId,
                  error: `Timeout junction exceeded ${timeoutMs}ms: ${String(junction.id)}`,
                  timestamp: Date.now(),
                })
              )
            }
          }

          continue
        }

        const outputs = yield* applyStatelessJunction(junction.kind, junction.config, item)
        for (const outputItem of outputs) {
          yield* routeFromNode(
            channelId,
            topology,
            String(junction.id),
            outputItem,
            nextVisited
          )
        }
      }
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
          return resetCircuitBreakerState(cmd.channelId)
      }
    }),
    Stream.runDrain,
    Effect.forkIn(serviceScope)
  )

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
          yield* clearChannelJunctionState(id)
          yield* clearChannelCircuitState(id)
          yield* clearChannelOutletPubSubs(id)
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

        // Mark closed first so any concurrent routing short-circuits.
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

        // Re-read after status transition to capture latest tracked fibers.
        const latest = yield* getEntry(id)
        if (Option.isNone(latest)) {
          return
        }

        // Interrupt all fibers
        const fibers = Array.from(HashMap.values(latest.value.fibers))
        yield* Effect.all(
          fibers.map((f) => Fiber.interrupt(f)),
          { concurrency: "unbounded" }
        )

        // Clear fibers
        yield* updateEntry(id, (inst) => ({
          ...inst,
          fibers: HashMap.empty(),
        }))

        yield* clearChannelJunctionState(id)
        yield* clearChannelCircuitState(id)
        yield* clearChannelOutletPubSubs(id)

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

        const commandFiber = yield* Ref.get(commandProcessorFiberRef)
        if (Option.isSome(commandFiber)) {
          yield* Fiber.interrupt(commandFiber.value)
          yield* Ref.set(commandProcessorFiberRef, Option.none())
        }

        yield* Scope.close(serviceScope, Exit.succeed(undefined))
        yield* PubSub.shutdown(commandPubSub)
        yield* PubSub.shutdown(eventPubSub)
      }),

    // Inlet Operations
    connectFeed: <A, E, R>(
      channelId: ChannelId,
      inletId: InletId,
      feed: Feed<A, E, R>
    ) => service.connectStream(channelId, inletId, feed.stream, feed.id),

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
        const topology = instance.state.topology
        const inletSchema = inlet.schema
        const timeoutConfig = instance.state.protocol.timeout
        const timeoutDurationMs = timeoutConfig
          ? parseDurationMs(timeoutConfig.duration, 1_000)
          : undefined
        const timeoutBehavior = timeoutConfig?.behavior ?? "fail"
        const retryPolicy = buildRetryPolicy(instance.state)

        const decodeInletPayload = (
          item: A
        ): Effect.Effect<unknown, ChannelServiceError> => {
          if (inletSchema === undefined) {
            return Effect.succeed(item)
          }

          if (!Schema.isSchema(inletSchema)) {
            return Effect.fail(
              new ChannelServiceError({
                message: `Inlet schema is not a valid Effect Schema for inlet ${String(inletId)}`,
                code: "BUILD_FAILED",
                channelId,
              })
            )
          }

          return pipe(
            Schema.decodeUnknown(inletSchema)(item),
            Effect.mapError(
              () =>
                new ChannelServiceError({
                  message: `Inlet schema validation failed for ${String(inletId)}`,
                  code: "INLET_SCHEMA_VALIDATION_FAILED",
                  channelId,
                })
            )
          )
        }

        const routeWithProtocolTimeout = (item: unknown) =>
          Effect.gen(function* () {
            if (timeoutDurationMs === undefined) {
              yield* routeFromNode(channelId, topology, String(inletId), item)
              return
            }

            const itemTimestamp =
              typeof item === "object" && item !== null && "timestamp" in item
                ? (item as { readonly timestamp?: unknown }).timestamp
                : undefined

            const staleByTimestamp =
              typeof itemTimestamp === "number" && Date.now() - itemTimestamp > timeoutDurationMs

            const routed = staleByTimestamp
              ? Option.none<void>()
              : yield* pipe(
                  routeFromNode(channelId, topology, String(inletId), item),
                  Effect.timeout(`${timeoutDurationMs} millis`),
                  Effect.option
                )

            if (Option.isSome(routed)) {
              return
            }

            yield* emit(
              new TimeoutOccurred({
                channelId,
                inletId,
                duration: `${timeoutDurationMs} millis`,
                timestamp: Date.now(),
              })
            )

            if (timeoutBehavior === "warn") {
              yield* Console.warn(
                `[ChannelService] Channel timeout warning on inlet ${String(inletId)} after ${timeoutDurationMs}ms`
              )
              return
            }

            if (timeoutBehavior === "skip") {
              return
            }

            yield* service.updateMetrics(channelId, (m) => ({
              errors: m.errors + 1,
            }))

            yield* Effect.fail(
              new ChannelServiceError({
                message: `Channel timeout exceeded ${timeoutDurationMs}ms on inlet ${String(inletId)}`,
                code: "BUILD_FAILED",
                channelId,
              })
            )
          })

        const runInletOnce = pipe(
          stream,
          Stream.mapError(
            (error) =>
              new ChannelServiceError({
                message: `Inlet stream failed for ${String(inletId)}: ${String(error)}`,
                code: "BUILD_FAILED",
                channelId,
              })
          ),
          Stream.mapEffect((item) =>
            pipe(
              decodeInletPayload(item),
              Effect.tapError((error) =>
                Effect.gen(function* () {
                  yield* service.updateMetrics(channelId, (m) => ({
                    errors: m.errors + 1,
                  }))

                  yield* emit(
                    new ChannelFaulted({
                      channelId,
                      error: error.message,
                      timestamp: Date.now(),
                    })
                  )
                })
              )
            )
          ),
          Stream.tap((item) =>
            Effect.gen(function* () {
              yield* service.updateMetrics(channelId, (m) => ({
                messagesIn: m.messagesIn + 1,
                bytesIn: m.bytesIn + estimateBytes(item),
              }))

              yield* routeWithProtocolTimeout(item)
            })
          ),
          Stream.runDrain
        )

        const runWithProtocolResilience = pipe(
          awaitCircuitReady(channelId),
          Effect.zipRight(runInletOnce),
          Effect.tap(() => recordCircuitSuccess(channelId)),
          Effect.tapError((error) =>
            pipe(
              recordCircuitFailure(channelId),
              Effect.zipRight(
                error.code === "INLET_SCHEMA_VALIDATION_FAILED"
                  ? Effect.void
                  : emit(
                      new ChannelFaulted({
                        channelId,
                        error: error.message,
                        timestamp: Date.now(),
                      })
                    )
              )
            )
          )
        )

        const resilientProgram = Option.isSome(retryPolicy)
          ? runWithProtocolResilience.pipe(
              Effect.retry({
                schedule: retryPolicy.value.schedule,
                times: retryPolicy.value.times,
              })
            )
          : runWithProtocolResilience

        // Route each item through inlet -> (junction graph) -> outlet with protocol resilience.
        const fiber = yield* pipe(resilientProgram, Effect.forkIn(serviceScope))

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
    subscribeOutlet: <A = unknown>(
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
          return yield* Queue.unbounded<A>()
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
          return yield* Queue.unbounded<A>()
        }

        const finalSubscriberId = subscriberId ?? `sub:${nanoid(8)}`
        const outletKey = `${channelId}:${outletId}`
        const pubsub = yield* getOrCreateOutletPubSub<A>(outletKey)
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

        yield* Effect.addFinalizer(() =>
          Effect.gen(function* () {
            yield* updateState(channelId, (state) => {
              const updatedOutlets = state.topology.outlets.map((o) =>
                o.id === outletId
                  ? new Outlet({
                      ...o,
                      subscriberCount: Math.max(0, o.subscriberCount - 1),
                    })
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
              new OutletUnsubscribed({
                channelId,
                outletId,
                subscriberId: finalSubscriberId,
                timestamp: Date.now(),
              })
            )
          })
        )

        return queue
      }),

    getOutletStream: <A = unknown>(channelId: ChannelId, outletId: OutletId) =>
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
          return Stream.empty as Stream.Stream<A, never, Scope.Scope>
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
          return Stream.empty as Stream.Stream<A, never, Scope.Scope>
        }

        const outletKey = `${channelId}:${outletId}`
        const pubsub = yield* getOrCreateOutletPubSub<A>(outletKey)

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

  const commandProcessorFiber = yield* commandProcessor
  yield* Ref.set(commandProcessorFiberRef, Option.some(commandProcessorFiber))
  yield* Console.log("[ChannelService] Command processor started")

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
): Effect.Effect<void, ChannelServiceError, ChannelService | R> =>
  Effect.flatMap(ChannelService, (s) => s.connectFeed(channelId, inletId, feed))

export interface OutletHandle<S extends Schema.Schema.AnyNoContext> {
  readonly channelId: ChannelId
  readonly outletId: OutletId
  readonly schema: S
}

/**
 * Construct a typed outlet handle that can drive inference for subscribe/get stream APIs.
 */
export const outletHandle = <S extends Schema.Schema.AnyNoContext>(
  channelId: ChannelId,
  outletId: OutletId,
  schema: S
): OutletHandle<S> => ({ channelId, outletId, schema })

const assertOutletHandleSchema = <S extends Schema.Schema.AnyNoContext>(
  service: ChannelServiceShape,
  handle: OutletHandle<S>
): Effect.Effect<void, ChannelServiceError> =>
  Effect.gen(function* () {
    const state = yield* service.getState(handle.channelId)
    if (Option.isNone(state)) {
      return yield* Effect.fail(
        new ChannelServiceError({
          message: `Channel not found: ${handle.channelId}`,
          code: "CHANNEL_NOT_FOUND",
          channelId: handle.channelId,
        })
      )
    }

    const outlet = state.value.topology.outlets.find((o) => o.id === handle.outletId)
    if (!outlet) {
      return yield* Effect.fail(
        new ChannelServiceError({
          message: `Outlet not found: ${handle.outletId}`,
          code: "OUTLET_NOT_FOUND",
          channelId: handle.channelId,
        })
      )
    }

    if (outlet.schema !== handle.schema) {
      return yield* Effect.fail(
        new ChannelServiceError({
          message: `Outlet schema mismatch for ${handle.outletId}`,
          code: "BUILD_FAILED",
          channelId: handle.channelId,
        })
      )
    }
  })

/**
 * Subscribe using a typed outlet handle. Type is inferred from `handle.schema`.
 */
export const subscribeOutletHandle = <S extends Schema.Schema.AnyNoContext>(
  handle: OutletHandle<S>,
  subscriberId?: string
): Effect.Effect<Queue.Dequeue<Schema.Schema.Type<S>>, ChannelServiceError, ChannelService | Scope.Scope> =>
  Effect.flatMap(ChannelService, (service) =>
    Effect.gen(function* () {
      yield* assertOutletHandleSchema(service, handle)
      return yield* service.subscribeOutlet<Schema.Schema.Type<S>>(
        handle.channelId,
        handle.outletId,
        subscriberId
      )
    })
  )

/**
 * Get stream using a typed outlet handle. Type is inferred from `handle.schema`.
 */
export const getOutletStreamHandle = <S extends Schema.Schema.AnyNoContext>(
  handle: OutletHandle<S>
): Effect.Effect<Stream.Stream<Schema.Schema.Type<S>, never, Scope.Scope>, ChannelServiceError, ChannelService> =>
  Effect.flatMap(ChannelService, (service) =>
    Effect.gen(function* () {
      yield* assertOutletHandleSchema(service, handle)
      return yield* service.getOutletStream<Schema.Schema.Type<S>>(
        handle.channelId,
        handle.outletId
      )
    })
  )
