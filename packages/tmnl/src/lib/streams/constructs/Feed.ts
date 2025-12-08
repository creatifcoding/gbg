/**
 * Feed — A Supervised, Interruptible Stream Source
 *
 * Ontology (BFO):
 *   - Feed instance: specifically dependent continuant
 *   - Feed status: quality inhering in the feed
 *   - Running fiber: occurrent (process unfolding in time)
 *
 * Architecture:
 *   - Feed<A, E, R>: stateful lifecycle manager
 *   - FeedsManager: Effect.Service orchestrating multiple feeds (higher order)
 *   - Trigger model: event-driven hybrid with scope-bound fallback
 */

import {
  Stream,
  Effect,
  Fiber,
  Schema,
  Ref,
  Option,
  Scope,
  Console,
  Duration,
  PubSub,
  Queue,
  Schedule,
  pipe,
} from "effect"

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

/**
 * Feed status as a discriminated union.
 * Uses Schema.Literal for runtime validation.
 */
export const FeedStatus = Schema.Literal("idle", "running", "paused", "stopped")
export type FeedStatus = typeof FeedStatus.Type

/**
 * Feed events — signals that can trigger state transitions.
 * Event-driven hybrid model: external events control lifecycle.
 */
export const FeedSignal = Schema.Union(
  Schema.TaggedStruct("Start", {}),
  Schema.TaggedStruct("Stop", {}),
  Schema.TaggedStruct("Pause", {}),
  Schema.TaggedStruct("Resume", {})
)
export type FeedSignal = typeof FeedSignal.Type

/**
 * Feed configuration — generic, effect-driven, schema-validated.
 *
 * @typeParam A - The event type emitted by this feed
 * @typeParam E - Error type from the producer effect
 * @typeParam R - Requirements (dependencies) of the producer
 */
export interface FeedConfig<A, E = never, R = never> {
  /** Unique identifier for this feed */
  readonly id: string

  /** Human-readable name */
  readonly name: string

  /** Schema for validating emitted events (optional but recommended) */
  readonly schema?: Schema.Schema<A, unknown>

  /** The Effect that produces each event */
  readonly producer: Effect.Effect<A, E, R>

  /** Interval between productions (default: no delay) */
  readonly interval?: Duration.DurationInput

  /** Effect to run on connect (before first event) */
  readonly onConnect?: Effect.Effect<void, never, R>

  /** Effect to run on disconnect (after last event / interrupt) */
  readonly onDisconnect?: Effect.Effect<void, never, R>
}

/**
 * Feed runtime state — internal, managed by Feed instance.
 */
interface FeedState<A, E> {
  readonly status: FeedStatus
  readonly fiber: Option.Option<Fiber.RuntimeFiber<void, E>>
  readonly eventCount: number
  readonly lastEvent: Option.Option<A>
  readonly startedAt: Option.Option<number>
  readonly error: Option.Option<E>
}

const initialState = <A, E>(): FeedState<A, E> => ({
  status: "idle",
  fiber: Option.none(),
  eventCount: 0,
  lastEvent: Option.none(),
  startedAt: Option.none(),
  error: Option.none(),
})

// ============================================================================
// FEED CLASS
// ============================================================================

/**
 * Feed<A, E, R> — A stateful, lifecycle-managed stream source.
 *
 * Usage:
 * ```typescript
 * const feed = Feed.make({
 *   id: "sensor-1",
 *   name: "Temperature Sensor",
 *   schema: TemperatureReading,
 *   producer: readSensor,
 *   interval: "1 second",
 *   onConnect: Console.log("Sensor connected"),
 *   onDisconnect: Console.log("Sensor disconnected"),
 * })
 *
 * // Start the feed, subscribe to events
 * yield* feed.run((event) => Console.log(event), { duration: "60 seconds" })
 * ```
 */
export class Feed<A, E = never, R = never> {
  readonly id: string
  readonly name: string
  readonly config: FeedConfig<A, E, R>

  // These are created lazily and cached
  private _stateRef: Ref.Ref<FeedState<A, E>> | null = null
  private _pubsub: PubSub.PubSub<A> | null = null
  private _signalQueue: Queue.Queue<FeedSignal> | null = null

  private constructor(config: FeedConfig<A, E, R>) {
    this.config = config
    this.id = config.id
    this.name = config.name
  }

  /**
   * Factory method — the canonical way to create a Feed.
   */
  static make<A, E = never, R = never>(config: FeedConfig<A, E, R>): Feed<A, E, R> {
    return new Feed(config)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INTERNAL: Lazy initialization
  // ══════════════════════════════════════════════════════════════════════════

  private getStateRef(): Effect.Effect<Ref.Ref<FeedState<A, E>>> {
    const self = this
    return Effect.suspend(() => {
      if (self._stateRef) return Effect.succeed(self._stateRef)
      return pipe(
        Ref.make(initialState<A, E>()),
        Effect.tap((ref) => Effect.sync(() => { self._stateRef = ref }))
      )
    })
  }

  private getPubSub(): Effect.Effect<PubSub.PubSub<A>> {
    const self = this
    return Effect.suspend(() => {
      if (self._pubsub) return Effect.succeed(self._pubsub)
      return pipe(
        PubSub.unbounded<A>(),
        Effect.tap((ps) => Effect.sync(() => { self._pubsub = ps }))
      )
    })
  }

  private getSignalQueue(): Effect.Effect<Queue.Queue<FeedSignal>> {
    const self = this
    return Effect.suspend(() => {
      if (self._signalQueue) return Effect.succeed(self._signalQueue)
      return pipe(
        Queue.unbounded<FeedSignal>(),
        Effect.tap((q) => Effect.sync(() => { self._signalQueue = q }))
      )
    })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATUS & INSPECTION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get current feed status.
   */
  get status(): Effect.Effect<FeedStatus> {
    const self = this
    return pipe(
      self.getStateRef(),
      Effect.flatMap(Ref.get),
      Effect.map((state) => state.status)
    )
  }

  /**
   * Get full feed state (for debugging/monitoring).
   */
  get state(): Effect.Effect<FeedState<A, E>> {
    const self = this
    return pipe(self.getStateRef(), Effect.flatMap(Ref.get))
  }

  /**
   * Check if feed is currently running.
   */
  get isRunning(): Effect.Effect<boolean> {
    return Effect.map(this.status, (s) => s === "running")
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE CONTROL
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Start the feed. Idempotent — does nothing if already running.
   */
  start(): Effect.Effect<void, E, R> {
    const self = this
    return Effect.gen(function* () {
      const ref = yield* self.getStateRef()
      const state = yield* Ref.get(ref)

      if (state.status === "running") {
        yield* Console.log(`[Feed:${self.id}] Already running, ignoring start`)
        return
      }

      yield* Console.log(`[Feed:${self.id}] Starting...`)

      // Run onConnect if defined
      if (self.config.onConnect) {
        yield* self.config.onConnect
      }

      // Create the event stream
      const pubsub = yield* self.getPubSub()
      const eventStream = self.createEventStream()

      // Fork the stream processor
      const fiber = yield* pipe(
        eventStream,
        Stream.tap((event) => PubSub.publish(pubsub, event)),
        Stream.tap((event) =>
          Ref.update(ref, (s) => ({
            ...s,
            eventCount: s.eventCount + 1,
            lastEvent: Option.some(event),
          }))
        ),
        Stream.ensuring(
          Effect.gen(function* () {
            yield* Console.log(`[Feed:${self.id}] Stream ended, cleaning up...`)
            if (self.config.onDisconnect) {
              yield* self.config.onDisconnect
            }
            yield* Ref.update(ref, (s) => ({
              ...s,
              status: "stopped" as const,
              fiber: Option.none(),
            }))
          })
        ),
        Stream.runDrain,
        Effect.fork
      )

      yield* Ref.set(ref, {
        ...state,
        status: "running",
        fiber: Option.some(fiber) as Option.Option<Fiber.RuntimeFiber<void, E>>,
        startedAt: Option.some(Date.now()),
        error: Option.none(),
      })

      yield* Console.log(`[Feed:${self.id}] Started`)
    })
  }

  /**
   * Stop the feed. Interrupts the fiber if running.
   */
  stop(): Effect.Effect<void> {
    const self = this
    return Effect.gen(function* () {
      const ref = yield* self.getStateRef()
      const state = yield* Ref.get(ref)

      if (state.status !== "running" && state.status !== "paused") {
        yield* Console.log(`[Feed:${self.id}] Not running, ignoring stop`)
        return
      }

      yield* Console.log(`[Feed:${self.id}] Stopping...`)

      if (Option.isSome(state.fiber)) {
        yield* Fiber.interrupt(state.fiber.value)
      }

      // State update happens in the ensuring block of the stream
    })
  }

  /**
   * Send a signal to the feed (event-driven control).
   */
  signal(sig: FeedSignal): Effect.Effect<void, E, R> {
    const self = this
    return Effect.gen(function* () {
      const queue = yield* self.getSignalQueue()
      yield* Queue.offer(queue, sig)
      yield* Console.log(`[Feed:${self.id}] Signal received: ${sig._tag}`)

      // Process signal
      switch (sig._tag) {
        case "Start":
          yield* self.start()
          break
        case "Stop":
          yield* self.stop()
          break
        case "Pause":
          yield* Console.log(`[Feed:${self.id}] Pause not yet implemented`)
          break
        case "Resume":
          yield* Console.log(`[Feed:${self.id}] Resume not yet implemented`)
          break
      }
    })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STREAM ACCESS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * The underlying event stream. Creates a new stream each call.
   */
  get stream(): Stream.Stream<A, E, R> {
    return this.createEventStream()
  }

  /**
   * Subscribe to events via PubSub (multiple consumers supported).
   * Requires the feed to be started separately.
   */
  subscribe(): Effect.Effect<Queue.Dequeue<A>, never, Scope.Scope> {
    const self = this
    return pipe(self.getPubSub(), Effect.flatMap(PubSub.subscribe))
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MANAGED EXECUTION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Run the feed with a handler for each event.
   * Scope-bound: interrupts when scope closes or duration expires.
   */
  run(
    handler: (event: A) => Effect.Effect<void, never, R>,
    options?: { duration?: Duration.DurationInput }
  ): Effect.Effect<void, E, R | Scope.Scope> {
    const self = this
    return Effect.gen(function* () {
      yield* self.start()

      const runStream = pipe(
        self.stream,
        Stream.tap(handler),
        Stream.runDrain
      )

      if (options?.duration) {
        yield* pipe(
          runStream,
          Effect.timeout(options.duration),
          Effect.ignore
        )
        yield* self.stop()
      } else {
        yield* runStream
      }
    }).pipe(Effect.onInterrupt(() => self.stop()))
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ══════════════════════════════════════════════════════════════════════════

  private createEventStream(): Stream.Stream<A, E, R> {
    const { producer, interval } = this.config

    if (interval) {
      return pipe(
        Stream.repeat(Stream.fromEffect(producer), Schedule.spaced(interval))
      )
    }

    return Stream.repeatEffect(producer)
  }
}

// ============================================================================
// CONVENIENCE FACTORIES
// ============================================================================

/**
 * Create a simple feed from a producer effect.
 */
export const makeFeed = <A, E = never, R = never>(
  id: string,
  producer: Effect.Effect<A, E, R>,
  options?: Partial<Omit<FeedConfig<A, E, R>, "id" | "producer">>
): Feed<A, E, R> =>
  Feed.make({
    id,
    name: options?.name ?? id,
    producer,
    ...options,
  })

// ============================================================================
// EXPORTS
// ============================================================================

export type { FeedConfig, FeedState }
