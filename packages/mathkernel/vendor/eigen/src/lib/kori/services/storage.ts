/**
 * Kori Storage Service
 *
 * Opaque wrapper around NATS KV that provides a clean, Kori-specific API.
 * All NATS machinery is hidden — consumers work with EntitySpecs and streams.
 *
 * Pattern: Facade over NatsKVService with domain-specific operations.
 *
 * @module kori/services/storage
 */

import { Effect, Context, Layer, Stream, Schema, Data } from 'effect'
import type { ParseResult } from 'effect'

import { NatsKVService, NatsKVError } from '@/lib/nats'
import {
  EntitySpec,
  type EntityTypeId,
  ENTITY_SPEC_BUCKET,
  SPEC_WATCH_PATTERN,
  specKey,
} from '../schemas/entity-spec'

// =============================================================================
// Kori-Specific Errors
// =============================================================================

/**
 * Base error for Kori storage operations.
 */
export class KoriStorageError extends Data.TaggedError('KoriStorageError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Entity spec not found.
 */
export class KoriSpecNotFoundError extends Data.TaggedError('KoriSpecNotFoundError')<{
  readonly entityTypeId: string
}> {}

/**
 * Storage connection error.
 */
export class KoriConnectionError extends Data.TaggedError('KoriConnectionError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Union of all Kori storage errors.
 */
export type KoriError = KoriStorageError | KoriSpecNotFoundError | KoriConnectionError

// =============================================================================
// Change Events
// =============================================================================

/**
 * Spec change event from watch stream.
 */
export interface SpecChangeEvent {
  readonly type: 'put' | 'delete'
  readonly entityTypeId: EntityTypeId
  readonly spec: EntitySpec | null
  readonly revision: number
}

// =============================================================================
// Service Shape
// =============================================================================

/**
 * KoriStorageService shape — clean API for entity spec persistence.
 */
export interface KoriStorageServiceShape {
  /**
   * Get an EntitySpec by type ID.
   * Returns null if not found (no error thrown).
   */
  readonly getSpec: (
    entityTypeId: EntityTypeId
  ) => Effect.Effect<EntitySpec | null, KoriStorageError>

  /**
   * Get an EntitySpec, failing if not found.
   */
  readonly requireSpec: (
    entityTypeId: EntityTypeId
  ) => Effect.Effect<EntitySpec, KoriStorageError | KoriSpecNotFoundError>

  /**
   * Save an EntitySpec (create or update).
   */
  readonly saveSpec: (
    spec: EntitySpec
  ) => Effect.Effect<void, KoriStorageError>

  /**
   * Delete an EntitySpec.
   */
  readonly deleteSpec: (
    entityTypeId: EntityTypeId
  ) => Effect.Effect<void, KoriStorageError>

  /**
   * List all EntitySpec type IDs.
   */
  readonly listSpecIds: () => Effect.Effect<ReadonlyArray<string>, KoriStorageError>

  /**
   * Watch for spec changes.
   * Returns a stream of change events.
   */
  readonly watchSpecs: () => Stream.Stream<SpecChangeEvent, KoriStorageError>

  /**
   * Check if storage is connected and ready.
   */
  readonly isReady: () => Effect.Effect<boolean, never>
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * KoriStorageService tag for dependency injection.
 */
export class KoriStorageService extends Context.Tag('kori/KoriStorageService')<
  KoriStorageService,
  KoriStorageServiceShape
>() {}

// =============================================================================
// Error Mapping
// =============================================================================

/**
 * Map NATS errors to Kori errors.
 */
const mapNatsError = (error: NatsKVError | ParseResult.ParseError): KoriStorageError =>
  new KoriStorageError({
    message: error instanceof NatsKVError ? error.message : 'Schema parse error',
    cause: error,
  })

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Live implementation of KoriStorageService.
 * Internally uses NatsKVService but exposes only Kori-specific operations.
 */
export const KoriStorageServiceLive = Layer.effect(
  KoriStorageService,
  Effect.gen(function* () {
    const nats = yield* NatsKVService

    // Lazily initialize bucket
    let bucketPromise: Promise<unknown> | null = null
    const ensureBucket = Effect.gen(function* () {
      if (!bucketPromise) {
        bucketPromise = Effect.runPromise(
          nats.getOrCreateBucket(ENTITY_SPEC_BUCKET, {
            history: 10,
            maxAgeSeconds: 0,
          })
        )
      }
      return yield* Effect.promise(() => bucketPromise as Promise<unknown>)
    }).pipe(
      Effect.mapError((err) => new KoriStorageError({
        message: 'Failed to initialize storage bucket',
        cause: err,
      }))
    )

    const service: KoriStorageServiceShape = {
      getSpec: (entityTypeId) =>
        Effect.gen(function* () {
          const bucket = yield* ensureBucket
          return yield* nats.get(bucket as any, specKey(entityTypeId), EntitySpec)
        }).pipe(
          Effect.mapError(mapNatsError)
        ),

      requireSpec: (entityTypeId) =>
        Effect.gen(function* () {
          const spec = yield* service.getSpec(entityTypeId)
          if (!spec) {
            return yield* Effect.fail(new KoriSpecNotFoundError({ entityTypeId: entityTypeId as string }))
          }
          return spec
        }),

      saveSpec: (spec) =>
        Effect.gen(function* () {
          const bucket = yield* ensureBucket
          yield* nats.put(bucket as any, specKey(spec.entityTypeId), spec, EntitySpec)
        }).pipe(
          Effect.mapError(mapNatsError)
        ),

      deleteSpec: (entityTypeId) =>
        Effect.gen(function* () {
          const bucket = yield* ensureBucket
          yield* nats.delete(bucket as any, specKey(entityTypeId))
        }).pipe(
          Effect.mapError(mapNatsError)
        ),

      listSpecIds: () =>
        Effect.gen(function* () {
          const bucket = yield* ensureBucket
          const keys = yield* nats.list(bucket as any, SPEC_WATCH_PATTERN)
          // Strip 'spec.' prefix from keys
          return keys.map((key) => key.replace(/^spec\./, ''))
        }).pipe(
          Effect.mapError(mapNatsError)
        ),

      watchSpecs: () =>
        Stream.unwrap(
          Effect.gen(function* () {
            const bucket = yield* ensureBucket
            return nats.watch(bucket as any, SPEC_WATCH_PATTERN, EntitySpec, {
              includeHistory: false,
            }).pipe(
              Stream.map((event): SpecChangeEvent => ({
                type: event.operation,
                entityTypeId: event.key.replace(/^spec\./, '') as EntityTypeId,
                spec: event.value,
                revision: event.revision,
              })),
              Stream.mapError(mapNatsError)
            )
          }).pipe(
            Effect.mapError(mapNatsError)
          )
        ),

      isReady: () =>
        Effect.gen(function* () {
          try {
            yield* ensureBucket
            return true
          } catch {
            return false
          }
        }).pipe(
          Effect.catchAll(() => Effect.succeed(false))
        ),
    }

    return service
  })
)

// =============================================================================
// Convenience Layers
// =============================================================================

/**
 * Full layer with NatsKVService dependency.
 */
export const KoriStorageServiceLayer = KoriStorageServiceLive

/**
 * Mock layer for testing without NATS.
 */
export const KoriStorageServiceMock = Layer.succeed(
  KoriStorageService,
  {
    getSpec: () => Effect.succeed(null),
    requireSpec: (entityTypeId) =>
      Effect.fail(new KoriSpecNotFoundError({ entityTypeId: entityTypeId as string })),
    saveSpec: () => Effect.void,
    deleteSpec: () => Effect.void,
    listSpecIds: () => Effect.succeed([]),
    watchSpecs: () => Stream.empty,
    isReady: () => Effect.succeed(true),
  } satisfies KoriStorageServiceShape
)
