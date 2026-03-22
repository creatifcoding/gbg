/**
 * FeedsManager — A Feed Kernel for Orchestrating Heterogeneous Streams
 *
 * Architecture:
 *   - Branded FeedId<A> for type-safe heterogeneous registry
 *   - PubSub command channel for event-driven control
 *   - Both singleton (global) and scoped instance patterns
 *   - Runtime-evolving schemas via Schema registry
 *
 * Ontology:
 *   - FeedsManager: independent continuant (persists, has identity)
 *   - FeedId<A>: specifically dependent continuant (depends on Feed existence)
 *   - Command stream: occurrent (process unfolding in time)
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
  Schema,
  Scope,
  Console,
  Stream,
  Fiber,
  pipe,
} from "effect"
import { Feed, FeedConfig, FeedStatus, FeedSignal } from "./Feed"

// ============================================================================
// BRANDED FEED ID
// ============================================================================

/**
 * Branded FeedId<A> — carries phantom type for compile-time safety.
 *
 * The brand ensures you can't accidentally use a FeedId<Temperature>
 * where a FeedId<Pressure> is expected, even though both are strings at runtime.
 */
export type FeedId<A> = string & { readonly _feedType: A }

/**
 * Create a branded FeedId. The type parameter is phantom — it exists only
 * at compile time to track what type of events the feed produces.
 */
export const FeedId = <A>(id: string): FeedId<A> => id as FeedId<A>

// ============================================================================
// COMMANDS & EVENTS
// ============================================================================

/**
 * Commands that can be sent to the FeedsManager via PubSub.
 * These are the "signals" that trigger feed operations.
 */
export const FeedCommand = Schema.Union(
  Schema.TaggedStruct("RegisterFeed", {
    id: Schema.String,
    // Config stored as unknown — runtime schema handles validation
  }),
  Schema.TaggedStruct("UnregisterFeed", {
    id: Schema.String,
  }),
  Schema.TaggedStruct("StartFeed", {
    id: Schema.String,
  }),
  Schema.TaggedStruct("StopFeed", {
    id: Schema.String,
  }),
  Schema.TaggedStruct("StartAll", {}),
  Schema.TaggedStruct("StopAll", {}),
  Schema.TaggedStruct("SignalFeed", {
    id: Schema.String,
    signal: FeedSignal,
  })
)
export type FeedCommand = typeof FeedCommand.Type

/**
 * Events emitted by the FeedsManager (for observers).
 */
export const FeedManagerEvent = Schema.Union(
  Schema.TaggedStruct("FeedRegistered", {
    id: Schema.String,
    name: Schema.String,
  }),
  Schema.TaggedStruct("FeedUnregistered", {
    id: Schema.String,
  }),
  Schema.TaggedStruct("FeedStarted", {
    id: Schema.String,
  }),
  Schema.TaggedStruct("FeedStopped", {
    id: Schema.String,
  }),
  Schema.TaggedStruct("FeedError", {
    id: Schema.String,
    error: Schema.Unknown,
  })
)
export type FeedManagerEvent = typeof FeedManagerEvent.Type

// ============================================================================
// FEED ENTRY (Internal Registry Type)
// ============================================================================

/**
 * Internal registry entry — stores Feed<unknown> with schema metadata.
 * The schema allows runtime validation and evolution.
 */
interface FeedEntry {
  readonly feed: Feed<unknown, unknown, unknown>
  readonly schema: Schema.Schema<unknown, unknown> | undefined
  readonly tags: ReadonlySet<string>
  readonly registeredAt: number
}

// ============================================================================
// FEEDS MANAGER SERVICE
// ============================================================================

/**
 * FeedsManager service interface.
 */
export interface FeedsManagerService {
  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a feed and get a branded FeedId.
   * The returned FeedId<A> carries the type information.
   */
  readonly register: <A, E, R>(
    feed: Feed<A, E, R>,
    options?: { tags?: readonly string[] }
  ) => Effect.Effect<FeedId<A>>

  /**
   * Unregister a feed by ID.
   */
  readonly unregister: (id: string) => Effect.Effect<void>

  // ── Retrieval ─────────────────────────────────────────────────────────────

  /**
   * Get a feed by branded ID (type-safe).
   */
  readonly get: <A>(id: FeedId<A>) => Effect.Effect<Option.Option<Feed<A, unknown, unknown>>>

  /**
   * Get a feed by string ID (returns unknown type).
   */
  readonly getById: (id: string) => Effect.Effect<Option.Option<Feed<unknown, unknown, unknown>>>

  /**
   * Get all feeds with a specific tag.
   */
  readonly getByTag: (tag: string) => Effect.Effect<ReadonlyArray<Feed<unknown, unknown, unknown>>>

  /**
   * Get all registered feed IDs.
   */
  readonly listIds: () => Effect.Effect<ReadonlyArray<string>>

  /**
   * Get status of all feeds.
   */
  readonly getStatuses: () => Effect.Effect<HashMap.HashMap<string, FeedStatus>>

  // ── Lifecycle Control ─────────────────────────────────────────────────────

  /**
   * Start a specific feed.
   */
  readonly start: (id: string) => Effect.Effect<void, unknown, unknown>

  /**
   * Stop a specific feed.
   */
  readonly stop: (id: string) => Effect.Effect<void>

  /**
   * Start all registered feeds.
   */
  readonly startAll: () => Effect.Effect<void, unknown, unknown>

  /**
   * Stop all registered feeds.
   */
  readonly stopAll: () => Effect.Effect<void>

  /**
   * Send a signal to a specific feed.
   */
  readonly signal: (id: string, sig: FeedSignal) => Effect.Effect<void, unknown, unknown>

  // ── Command Channel ───────────────────────────────────────────────────────

  /**
   * Get the command PubSub for external signal injection.
   */
  readonly commands: PubSub.PubSub<FeedCommand>

  /**
   * Get the event PubSub for observing manager events.
   */
  readonly events: PubSub.PubSub<FeedManagerEvent>

  /**
   * Subscribe to manager events.
   */
  readonly subscribeEvents: () => Effect.Effect<Queue.Dequeue<FeedManagerEvent>, never, Scope.Scope>
}

// ============================================================================
// SERVICE TAG
// ============================================================================

export class FeedsManager extends Context.Tag("tmnl/streams/FeedsManager")<
  FeedsManager,
  FeedsManagerService
>() {}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

const makeFeedsManager = Effect.gen(function* () {
  // Internal state
  const registry = yield* Ref.make<HashMap.HashMap<string, FeedEntry>>(HashMap.empty())
  const commandPubSub = yield* PubSub.unbounded<FeedCommand>()
  const eventPubSub = yield* PubSub.unbounded<FeedManagerEvent>()

  // Helper: emit event
  const emit = (event: FeedManagerEvent) => PubSub.publish(eventPubSub, event)

  // Helper: get entry
  const getEntry = (id: string) =>
    pipe(
      Ref.get(registry),
      Effect.map((map) => HashMap.get(map, id))
    )

  // ── Start command processor ───────────────────────────────────────────────

  const commandProcessor = pipe(
    Stream.fromPubSub(commandPubSub),
    Stream.tap((cmd) => Console.log(`[FeedsManager] Command received: ${cmd._tag}`)),
    Stream.mapEffect((cmd) => {
      switch (cmd._tag) {
        case "StartFeed":
          return service.start(cmd.id)
        case "StopFeed":
          return service.stop(cmd.id)
        case "StartAll":
          return service.startAll()
        case "StopAll":
          return service.stopAll()
        case "SignalFeed":
          return service.signal(cmd.id, cmd.signal)
        case "UnregisterFeed":
          return service.unregister(cmd.id)
        case "RegisterFeed":
          // Registration via command requires feed instance — skip for now
          return Console.log(`[FeedsManager] RegisterFeed via command not supported (use register method)`)
      }
    }),
    Stream.runDrain,
    Effect.fork
  )

  yield* commandProcessor
  yield* Console.log("[FeedsManager] Command processor started")

  // ── Service implementation ────────────────────────────────────────────────

  const service: FeedsManagerService = {
    // Registration
    register: <A, E, R>(feed: Feed<A, E, R>, options?: { tags?: readonly string[] }) =>
      Effect.gen(function* () {
        const entry: FeedEntry = {
          feed: feed as Feed<unknown, unknown, unknown>,
          schema: feed.config.schema as Schema.Schema<unknown, unknown> | undefined,
          tags: new Set(options?.tags ?? []),
          registeredAt: Date.now(),
        }

        yield* Ref.update(registry, (map) => HashMap.set(map, feed.id, entry))
        yield* emit({ _tag: "FeedRegistered", id: feed.id, name: feed.name })
        yield* Console.log(`[FeedsManager] Registered feed: ${feed.id}`)

        return FeedId<A>(feed.id)
      }),

    unregister: (id: string) =>
      Effect.gen(function* () {
        const entry = yield* getEntry(id)
        if (Option.isSome(entry)) {
          // Stop if running
          const status = yield* entry.value.feed.status
          if (status === "running") {
            yield* entry.value.feed.stop()
          }
          yield* Ref.update(registry, (map) => HashMap.remove(map, id))
          yield* emit({ _tag: "FeedUnregistered", id })
          yield* Console.log(`[FeedsManager] Unregistered feed: ${id}`)
        }
      }),

    // Retrieval
    get: <A>(id: FeedId<A>) =>
      pipe(
        getEntry(id),
        Effect.map((opt) => Option.map(opt, (e) => e.feed as Feed<A, unknown, unknown>))
      ),

    getById: (id: string) =>
      pipe(
        getEntry(id),
        Effect.map((opt) => Option.map(opt, (e) => e.feed))
      ),

    getByTag: (tag: string) =>
      pipe(
        Ref.get(registry),
        Effect.map((map) =>
          pipe(
            HashMap.values(map),
            (entries) => Array.from(entries),
            (arr) => arr.filter((e) => e.tags.has(tag)),
            (arr) => arr.map((e) => e.feed)
          )
        )
      ),

    listIds: () =>
      pipe(
        Ref.get(registry),
        Effect.map((map) => Array.from(HashMap.keys(map)))
      ),

    getStatuses: () =>
      Effect.gen(function* () {
        const map = yield* Ref.get(registry)
        const entries = Array.from(HashMap.entries(map))

        const statuses = yield* Effect.all(
          entries.map(([id, entry]) =>
            pipe(
              entry.feed.status,
              Effect.map((status) => [id, status] as const)
            )
          )
        )

        return HashMap.fromIterable(statuses)
      }),

    // Lifecycle
    start: (id: string) =>
      Effect.gen(function* () {
        const entry = yield* getEntry(id)
        if (Option.isSome(entry)) {
          yield* entry.value.feed.start()
          yield* emit({ _tag: "FeedStarted", id })
        } else {
          yield* Console.log(`[FeedsManager] Feed not found: ${id}`)
        }
      }),

    stop: (id: string) =>
      Effect.gen(function* () {
        const entry = yield* getEntry(id)
        if (Option.isSome(entry)) {
          yield* entry.value.feed.stop()
          yield* emit({ _tag: "FeedStopped", id })
        }
      }),

    startAll: () =>
      Effect.gen(function* () {
        const map = yield* Ref.get(registry)
        const entries = Array.from(HashMap.values(map))
        yield* Console.log(`[FeedsManager] Starting all feeds (${entries.length})...`)
        yield* Effect.all(
          entries.map((e) => e.feed.start()),
          { concurrency: "unbounded" }
        )
      }),

    stopAll: () =>
      Effect.gen(function* () {
        const map = yield* Ref.get(registry)
        const entries = Array.from(HashMap.values(map))
        yield* Console.log(`[FeedsManager] Stopping all feeds (${entries.length})...`)
        yield* Effect.all(
          entries.map((e) => e.feed.stop()),
          { concurrency: "unbounded" }
        )
      }),

    signal: (id: string, sig: FeedSignal) =>
      Effect.gen(function* () {
        const entry = yield* getEntry(id)
        if (Option.isSome(entry)) {
          yield* entry.value.feed.signal(sig)
        }
      }),

    // PubSub access
    commands: commandPubSub,
    events: eventPubSub,

    subscribeEvents: () => PubSub.subscribe(eventPubSub),
  }

  return service
})

// ============================================================================
// LAYERS
// ============================================================================

/**
 * Live layer — creates a FeedsManager instance.
 */
export const FeedsManagerLive: Layer.Layer<FeedsManager> = Layer.effect(
  FeedsManager,
  makeFeedsManager
)

/**
 * Scoped layer — FeedsManager bound to a Scope (cleans up on scope close).
 */
export const FeedsManagerScoped: Layer.Layer<FeedsManager, never, Scope.Scope> = Layer.scoped(
  FeedsManager,
  Effect.gen(function* () {
    const manager = yield* makeFeedsManager

    // Cleanup: stop all feeds when scope closes
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        yield* Console.log("[FeedsManager] Scope closing, stopping all feeds...")
        yield* manager.stopAll()
      })
    )

    return manager
  })
)

// ============================================================================
// CONVENIENCE ACCESSORS
// ============================================================================

/**
 * Access FeedsManager from context.
 */
export const feedsManager = FeedsManager

/**
 * Register a feed (requires FeedsManager in context).
 */
export const registerFeed = <A, E, R>(
  feed: Feed<A, E, R>,
  options?: { tags?: readonly string[] }
): Effect.Effect<FeedId<A>, never, FeedsManager> =>
  Effect.flatMap(FeedsManager, (m) => m.register(feed, options))

/**
 * Get a feed by branded ID (requires FeedsManager in context).
 */
export const getFeed = <A>(
  id: FeedId<A>
): Effect.Effect<Option.Option<Feed<A, unknown, unknown>>, never, FeedsManager> =>
  Effect.flatMap(FeedsManager, (m) => m.get(id))

/**
 * Send a command to the manager (requires FeedsManager in context).
 */
export const sendCommand = (
  cmd: FeedCommand
): Effect.Effect<boolean, never, FeedsManager> =>
  Effect.flatMap(FeedsManager, (m) => PubSub.publish(m.commands, cmd))

// ============================================================================
// EXPORTS
// ============================================================================

export type { FeedEntry }
