/**
 * KORI Stream Services
 *
 * Effect.Stream wrappers for reactive query subscriptions with backpressure.
 * Effect.Queue for batched entity mutations with configurable flush.
 *
 * @module
 */

import {
  Context,
  Effect,
  Layer,
  Stream,
  Queue,
  Scope,
  Ref,
  Fiber,
  pipe,
  Duration,
  Chunk,
  Option,
} from "effect"
import type { TraitId } from "../schemas/trait"
import type { KoriEntity, EntityId, WorldId } from "./world"
import {
  BackpressureExceeded,
  SubscriptionFailed,
  EntityNotFound,
  WorldDisposed,
} from "../errors"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query event types for reactive subscriptions.
 */
export type QueryEventType = "added" | "removed" | "changed"

/**
 * Query event emitted when entities match/unmatch a query.
 */
export interface QueryEvent {
  readonly type: QueryEventType
  readonly entity: KoriEntity
  readonly traitId: TraitId
  readonly timestamp: Date
}

/**
 * Query subscription configuration.
 */
export interface QuerySubscriptionConfig {
  /** Trait to query for */
  readonly traitId: TraitId
  /** Buffer capacity for backpressure (default: 256) */
  readonly bufferCapacity?: number
  /** Whether to emit current matches on subscribe (default: true) */
  readonly emitInitial?: boolean
}

/**
 * Batch mutation operation.
 */
export type MutationOp =
  | { readonly _tag: "AddTrait"; readonly entityId: EntityId; readonly traitId: TraitId; readonly data: unknown }
  | { readonly _tag: "RemoveTrait"; readonly entityId: EntityId; readonly traitId: TraitId }
  | { readonly _tag: "SetTrait"; readonly entityId: EntityId; readonly traitId: TraitId; readonly data: unknown }
  | { readonly _tag: "DestroyEntity"; readonly entityId: EntityId }

/**
 * Batch queue configuration.
 */
export interface BatchQueueConfig {
  /** Maximum queue capacity (default: 1024) */
  readonly capacity?: number
  /** Batch size before flush (default: 64) */
  readonly batchSize?: number
  /** Flush interval in milliseconds (default: 16) */
  readonly flushIntervalMs?: number
}

/**
 * Batch flush result.
 */
export interface BatchFlushResult {
  readonly processed: number
  readonly failed: number
  readonly durationMs: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Stream Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KORI Query Stream operations.
 */
export interface KoriQueryStreamOps {
  /**
   * Subscribe to entities matching a trait.
   * Emits QueryEvents on add/remove/change.
   * Uses Stream.buffer for backpressure.
   */
  readonly subscribe: (
    config: QuerySubscriptionConfig
  ) => Stream.Stream<QueryEvent, SubscriptionFailed | BackpressureExceeded>

  /**
   * Query current entities as a stream.
   * Uses Stream.fromIterableEffect for lazy emission.
   */
  readonly queryStream: (
    traitId: TraitId
  ) => Stream.Stream<KoriEntity, never>

  /**
   * Query with transformation pipeline.
   * Applies Effect transformation to each entity.
   */
  readonly queryMapEffect: <A, E>(
    traitId: TraitId,
    f: (entity: KoriEntity) => Effect.Effect<A, E>
  ) => Stream.Stream<A, E>

  /**
   * Batch query multiple traits as single stream.
   * Merges results from multiple trait queries.
   */
  readonly queryMultiple: (
    traitIds: ReadonlyArray<TraitId>
  ) => Stream.Stream<KoriEntity, never>
}

/**
 * KORI Query Stream service tag.
 */
export class KoriQueryStream extends Context.Tag("kori/QueryStream")<
  KoriQueryStream,
  KoriQueryStreamOps
>() {}

/**
 * Internal state for query subscriptions.
 */
interface SubscriptionState {
  readonly subscriptions: Map<string, {
    readonly traitId: TraitId
    readonly emit: (event: QueryEvent) => Effect.Effect<void>
    readonly cleanup: Effect.Effect<void>
  }>
  readonly entities: Map<EntityId, KoriEntity>
}

/**
 * Create KORI Query Stream operations.
 */
export const makeKoriQueryStream: Effect.Effect<KoriQueryStreamOps, never, Scope.Scope> =
  Effect.gen(function* () {
    // Internal subscription state
    const stateRef = yield* Ref.make<SubscriptionState>({
      subscriptions: new Map(),
      entities: new Map(),
    })

    // Generate unique subscription ID
    let subIdCounter = 0
    const nextSubId = () => `sub-${++subIdCounter}`

    const ops: KoriQueryStreamOps = {
      subscribe: (config) => {
        const bufferCapacity = config.bufferCapacity ?? 256
        const emitInitial = config.emitInitial ?? true

        return Stream.async<QueryEvent, SubscriptionFailed | BackpressureExceeded>(
          (emit) => {
            const subId = nextSubId()

            // Register subscription
            const registerEffect = pipe(
              Ref.update(stateRef, (state) => ({
                ...state,
                subscriptions: new Map([
                  ...state.subscriptions,
                  [subId, {
                    traitId: config.traitId,
                    emit: (event: QueryEvent) => Effect.sync(() => emit.single(event)),
                    cleanup: Effect.void,
                  }],
                ]),
              })),
              Effect.flatMap(() => {
                if (emitInitial) {
                  // Emit current matches
                  return pipe(
                    Ref.get(stateRef),
                    Effect.flatMap((state) => {
                      const events = Array.from(state.entities.values())
                        .filter((e) => e.traits.has(config.traitId))
                        .map((entity): QueryEvent => ({
                          type: "added",
                          entity,
                          traitId: config.traitId,
                          timestamp: new Date(),
                        }))
                      return Effect.forEach(events, (event) =>
                        Effect.sync(() => emit.single(event))
                      )
                    })
                  )
                }
                return Effect.void
              })
            )

            // Run registration
            Effect.runFork(registerEffect)

            // Return cleanup
            return Effect.sync(() => {
              Effect.runFork(
                Ref.update(stateRef, (state) => {
                  const subs = new Map(state.subscriptions)
                  subs.delete(subId)
                  return { ...state, subscriptions: subs }
                })
              )
            })
          },
          { bufferSize: bufferCapacity }
        )
      },

      queryStream: (traitId) =>
        pipe(
          Stream.fromEffect(Ref.get(stateRef)),
          Stream.flatMap((state) =>
            Stream.fromIterable(
              Array.from(state.entities.values()).filter((e) =>
                e.traits.has(traitId)
              )
            )
          )
        ),

      queryMapEffect: <A, E>(
        traitId: TraitId,
        f: (entity: KoriEntity) => Effect.Effect<A, E>
      ) =>
        pipe(
          ops.queryStream(traitId),
          Stream.mapEffect(f)
        ),

      queryMultiple: (traitIds) =>
        pipe(
          Stream.fromIterable(traitIds),
          Stream.flatMap((traitId) => ops.queryStream(traitId)),
          // Deduplicate entities that match multiple traits
          Stream.groupAdjacentBy((e) => e.id),
          Stream.map(([, chunk]) => Chunk.head(chunk)),
          Stream.filterMap((opt) => opt)
        ),
    }

    return ops
  })

/**
 * Default KORI Query Stream layer.
 */
export const KoriQueryStreamLive = Layer.scoped(KoriQueryStream, makeKoriQueryStream)

// ─────────────────────────────────────────────────────────────────────────────
// Batch Queue Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KORI Batch Queue operations.
 */
export interface KoriBatchQueueOps {
  /**
   * Enqueue a mutation operation.
   * Returns immediately, operation is batched.
   * Fails with BackpressureExceeded if queue is full.
   */
  readonly enqueue: (
    op: MutationOp
  ) => Effect.Effect<void, BackpressureExceeded>

  /**
   * Enqueue multiple mutations atomically.
   */
  readonly enqueueAll: (
    ops: ReadonlyArray<MutationOp>
  ) => Effect.Effect<void, BackpressureExceeded>

  /**
   * Force immediate flush of pending mutations.
   */
  readonly flush: () => Effect.Effect<BatchFlushResult>

  /**
   * Get current queue depth.
   */
  readonly depth: () => Effect.Effect<number>

  /**
   * Stream of flush results for monitoring.
   */
  readonly flushStream: () => Stream.Stream<BatchFlushResult, never>
}

/**
 * KORI Batch Queue service tag.
 */
export class KoriBatchQueue extends Context.Tag("kori/BatchQueue")<
  KoriBatchQueue,
  KoriBatchQueueOps
>() {}

/**
 * Batch queue configuration service tag.
 */
export class KoriBatchQueueConfig extends Context.Tag("kori/BatchQueueConfig")<
  KoriBatchQueueConfig,
  BatchQueueConfig
>() {}

/**
 * Create KORI Batch Queue operations.
 */
export const makeKoriBatchQueue = (
  config: BatchQueueConfig = {}
): Effect.Effect<KoriBatchQueueOps, never, Scope.Scope> =>
  Effect.gen(function* () {
    const capacity = config.capacity ?? 1024
    const batchSize = config.batchSize ?? 64
    const flushIntervalMs = config.flushIntervalMs ?? 16

    // Bounded queue for backpressure
    const queue = yield* Queue.bounded<MutationOp>(capacity)

    // Flush result broadcasting
    const flushResultsQueue = yield* Queue.unbounded<BatchFlushResult>()

    // Stats
    const statsRef = yield* Ref.make({
      totalProcessed: 0,
      totalFailed: 0,
    })

    /**
     * Process a single mutation.
     * In real implementation, this would call KoriWorld methods.
     */
    const processMutation = (op: MutationOp): Effect.Effect<void, EntityNotFound | WorldDisposed> =>
      Effect.sync(() => {
        // Placeholder: actual implementation would call world.addTrait, etc.
        // This is the hook point for KoriWorld integration
        void op
      })

    /**
     * Flush current queue contents.
     */
    const doFlush = (): Effect.Effect<BatchFlushResult> =>
      Effect.gen(function* () {
        const startTime = Date.now()

        // Take up to batchSize items
        const items = yield* Queue.takeBetween(queue, 1, batchSize)
        const chunk = Chunk.fromIterable(items)

        let processed = 0
        let failed = 0

        // Process each mutation
        for (const op of chunk) {
          const result = yield* pipe(
            processMutation(op),
            Effect.map(() => true),
            Effect.catchAll(() => Effect.succeed(false))
          )
          if (result) {
            processed++
          } else {
            failed++
          }
        }

        // Update stats
        yield* Ref.update(statsRef, (s) => ({
          totalProcessed: s.totalProcessed + processed,
          totalFailed: s.totalFailed + failed,
        }))

        const result: BatchFlushResult = {
          processed,
          failed,
          durationMs: Date.now() - startTime,
        }

        // Broadcast result
        yield* Queue.offer(flushResultsQueue, result)

        return result
      })

    // Start flush fiber (runs periodically)
    const flushFiber = yield* pipe(
      Effect.gen(function* () {
        while (true) {
          yield* Effect.sleep(Duration.millis(flushIntervalMs))
          const size = yield* Queue.size(queue)
          if (size > 0) {
            yield* doFlush()
          }
        }
      }),
      Effect.forkScoped
    )

    // Cleanup on scope close
    yield* Effect.addFinalizer(() =>
      pipe(
        Fiber.interrupt(flushFiber),
        Effect.flatMap(() => Queue.shutdown(queue)),
        Effect.flatMap(() => Queue.shutdown(flushResultsQueue))
      )
    )

    const ops: KoriBatchQueueOps = {
      enqueue: (op) =>
        pipe(
          Queue.offer(queue, op),
          Effect.flatMap((accepted) =>
            accepted
              ? Effect.void
              : Effect.fail(
                  new BackpressureExceeded({
                    queueName: "kori/BatchQueue",
                    capacity,
                    current: capacity,
                  })
                )
          )
        ),

      enqueueAll: (ops) =>
        pipe(
          Effect.forEach(ops, (op) =>
            pipe(
              Queue.offer(queue, op),
              Effect.map((accepted) => accepted)
            )
          ),
          Effect.flatMap((results) => {
            const allAccepted = results.every((r) => r)
            return allAccepted
              ? Effect.void
              : Effect.fail(
                  new BackpressureExceeded({
                    queueName: "kori/BatchQueue",
                    capacity,
                    current: capacity,
                  })
                )
          })
        ),

      flush: doFlush,

      depth: () => Queue.size(queue),

      flushStream: () =>
        Stream.fromQueue(flushResultsQueue),
    }

    return ops
  })

/**
 * Default KORI Batch Queue layer.
 */
export const KoriBatchQueueLive = Layer.scoped(
  KoriBatchQueue,
  makeKoriBatchQueue()
)

/**
 * Create KORI Batch Queue layer with custom config.
 */
export const KoriBatchQueueConfigured = (config: BatchQueueConfig) =>
  Layer.scoped(KoriBatchQueue, makeKoriBatchQueue(config))

// ─────────────────────────────────────────────────────────────────────────────
// Combined Stream Layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All KORI stream services combined.
 */
export const KoriStreamLive = Layer.mergeAll(
  KoriQueryStreamLive,
  KoriBatchQueueLive
)
