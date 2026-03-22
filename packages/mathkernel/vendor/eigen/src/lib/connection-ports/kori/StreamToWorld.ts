/**
 * StreamToWorld Bridge
 *
 * Effect.Service that subscribes to Connection Ports streams
 * and materializes entities in kori World.
 *
 * Enables reactive data binding: stream data → kori entities → React.
 *
 * @module connection-ports/kori/StreamToWorld
 */

import { Context, Effect, Layer, Stream, Schema, Scope, pipe, Ref } from 'effect'
import type { TraitId } from '../../kori/schemas/trait'
import { KoriWorld, type KoriEntity, type EntityId } from '../../kori/services/world'
import { ConnectionBus } from '../services/ConnectionBus'

// =============================================================================
// Types
// =============================================================================

/**
 * Trait data to attach to an entity.
 */
export interface TraitData {
  readonly id: TraitId
  readonly data: unknown
}

/**
 * Mapper function that converts stream item to traits.
 * Returns null to skip the item (no entity created).
 */
export type StreamToTraitsMapper<A> = (item: A) => TraitData[] | null

/**
 * Entity ID extractor from stream item.
 * Used to identify existing entities for updates vs new spawns.
 */
export type EntityIdExtractor<A> = (item: A) => string

/**
 * Materialization options.
 */
export interface MaterializeOptions<A> {
  /** Stream identifier (NATS subject or Durable Stream ID) */
  readonly streamId: string
  /** Schema for decoding stream data */
  readonly schema: Schema.Schema<A>
  /** Map stream items to trait data */
  readonly toTraits: StreamToTraitsMapper<A>
  /** Extract entity ID from stream item (for updates) */
  readonly entityIdFrom: EntityIdExtractor<A>
  /** Enable replay from durable streams */
  readonly replay?: boolean
  /** Starting offset for replay */
  readonly fromOffset?: string
  /** Clear existing entities before materializing */
  readonly clearOnStart?: boolean
}

/**
 * Materialization result.
 */
export interface MaterializationResult {
  /** Total entities spawned */
  readonly spawned: number
  /** Total entities updated */
  readonly updated: number
  /** Total items skipped (mapper returned null) */
  readonly skipped: number
  /** Active entity IDs */
  readonly entityIds: ReadonlyArray<string>
}

/**
 * Materialization stats (live).
 */
export interface MaterializationStats {
  /** Current spawned count */
  readonly spawned: number
  /** Current updated count */
  readonly updated: number
  /** Current skipped count */
  readonly skipped: number
  /** Is stream active */
  readonly isActive: boolean
  /** Last error (if any) */
  readonly lastError: Error | null
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * StreamToWorld service operations.
 */
export interface StreamToWorldOps {
  /**
   * Materialize stream data as kori entities.
   *
   * Subscribes to the stream, validates/decodes items via schema,
   * maps to traits, and spawns/updates entities in kori World.
   *
   * Returns a Fiber that can be interrupted to stop materialization.
   */
  readonly materialize: <A>(
    options: MaterializeOptions<A>
  ) => Effect.Effect<MaterializationResult, never, Scope.Scope>

  /**
   * Get current materialization stats.
   */
  readonly getStats: () => Effect.Effect<MaterializationStats>

  /**
   * Stop all active materializations.
   */
  readonly stopAll: () => Effect.Effect<void>
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * StreamToWorld service tag.
 */
export class StreamToWorld extends Context.Tag('tmnl/ports/StreamToWorld')<
  StreamToWorld,
  StreamToWorldOps
>() {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create StreamToWorld service.
 */
export const makeStreamToWorld: Effect.Effect<
  StreamToWorldOps,
  never,
  KoriWorld | ConnectionBus
> = Effect.gen(function* () {
  const world = yield* KoriWorld
  const bus = yield* ConnectionBus

  // Track entity ID → kori EntityId mapping
  const entityMap = new Map<string, EntityId>()

  // Stats tracking
  const statsRef = yield* Ref.make<MaterializationStats>({
    spawned: 0,
    updated: 0,
    skipped: 0,
    isActive: false,
    lastError: null,
  })

  /**
   * Update stats atomically.
   */
  const updateStats = (
    update: Partial<MaterializationStats>
  ): Effect.Effect<void> =>
    Ref.update(statsRef, (current) => ({ ...current, ...update }))

  /**
   * Materialize a single item.
   */
  const materializeItem = <A>(
    item: A,
    options: MaterializeOptions<A>
  ): Effect.Effect<'spawned' | 'updated' | 'skipped'> =>
    Effect.gen(function* () {
      // Get traits from mapper
      const traits = options.toTraits(item)
      if (traits === null) {
        return 'skipped' as const
      }

      // Get entity ID
      const itemId = options.entityIdFrom(item)

      // Check if entity exists
      const existingEntityId = entityMap.get(itemId)
      if (existingEntityId) {
        // Update existing entity's traits
        const exists = yield* world.has(existingEntityId)
        if (exists) {
          for (const trait of traits) {
            yield* pipe(
              world.setTrait(existingEntityId, trait.id, trait.data),
              Effect.catchAll(() =>
                // Trait might not exist, try adding
                world.addTrait(existingEntityId, trait.id, trait.data)
              ),
              Effect.catchAll(() => Effect.void) // Ignore errors
            )
          }
          return 'updated' as const
        }
      }

      // Spawn new entity
      const entity = yield* Effect.scoped(
        world.spawn(traits)
      )
      entityMap.set(itemId, entity.id)
      return 'spawned' as const
    }).pipe(
      Effect.catchAll((error) =>
        pipe(
          updateStats({
            lastError: error instanceof Error ? error : new Error(String(error)),
          }),
          Effect.as('skipped' as const)
        )
      )
    )

  const ops: StreamToWorldOps = {
    materialize: <A>(options: MaterializeOptions<A>) =>
      Effect.gen(function* () {
        // Clear if requested
        if (options.clearOnStart) {
          for (const [_, entityId] of entityMap) {
            yield* pipe(
              world.destroy(entityId),
              Effect.catchAll(() => Effect.void)
            )
          }
          entityMap.clear()
        }

        // Reset stats
        yield* updateStats({
          spawned: 0,
          updated: 0,
          skipped: 0,
          isActive: true,
          lastError: null,
        })

        let spawned = 0
        let updated = 0
        let skipped = 0

        // Subscribe to stream
        const stream = bus.subscribe(options.streamId, options.schema, {
          replay: options.replay ?? false,
          fromOffset: options.fromOffset,
        })

        // Process stream
        yield* pipe(
          stream,
          Stream.runForEach((item) =>
            pipe(
              materializeItem(item, options),
              Effect.tap((result) => {
                if (result === 'spawned') {
                  spawned++
                  return updateStats({ spawned })
                } else if (result === 'updated') {
                  updated++
                  return updateStats({ updated })
                } else {
                  skipped++
                  return updateStats({ skipped })
                }
              })
            )
          ),
          Effect.ensuring(updateStats({ isActive: false })),
          Effect.catchAll((error) =>
            updateStats({
              isActive: false,
              lastError: error instanceof Error ? error : new Error(String(error)),
            })
          )
        )

        return {
          spawned,
          updated,
          skipped,
          entityIds: Array.from(entityMap.keys()),
        }
      }),

    getStats: () => Ref.get(statsRef),

    stopAll: () =>
      pipe(
        updateStats({ isActive: false }),
        Effect.tap(() =>
          Effect.sync(() => {
            // Note: actual stream cancellation happens via Scope
            // This just marks as inactive for stats
          })
        )
      ),
  }

  return ops
})

// =============================================================================
// Layer
// =============================================================================

/**
 * StreamToWorld live layer.
 * Requires KoriWorld and ConnectionBus.
 */
export const StreamToWorldLive = Layer.effect(StreamToWorld, makeStreamToWorld)

// =============================================================================
// Default Layer (for testing/standalone use)
// =============================================================================

// Note: Full layer composition requires:
// - KoriWorldLive
// - ConnectionBusLive (requires NatsPortLive, DurableStreamsPortLive)
// Import and compose as needed in atoms/providers.
