/**
 * KORI Errors
 *
 * Data.TaggedError hierarchy for exhaustive error handling.
 * All KORI operations use these typed errors for Effect.catchTag recovery.
 *
 * @module
 */

import { Data } from "effect"

// ─────────────────────────────────────────────────────────────────────────────
// Entity Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entity not found in world.
 */
export class EntityNotFound extends Data.TaggedError("EntityNotFound")<{
  readonly entityId: string
  readonly worldId: string
}> {}

/**
 * Entity already exists in world.
 */
export class EntityAlreadyExists extends Data.TaggedError("EntityAlreadyExists")<{
  readonly entityId: string
  readonly worldId: string
}> {}

/**
 * Entity has been destroyed and cannot be accessed.
 */
export class EntityDestroyed extends Data.TaggedError("EntityDestroyed")<{
  readonly entityId: string
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Trait Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trait not found on entity.
 */
export class TraitMissing extends Data.TaggedError("TraitMissing")<{
  readonly entityId: string
  readonly traitId: string
}> {}

/**
 * Trait already attached to entity.
 */
export class TraitAlreadyAttached extends Data.TaggedError("TraitAlreadyAttached")<{
  readonly entityId: string
  readonly traitId: string
}> {}

/**
 * Trait data validation failed.
 */
export class TraitValidationFailed extends Data.TaggedError("TraitValidationFailed")<{
  readonly traitId: string
  readonly reason: string
  readonly data: unknown
}> {}

/**
 * Trait value uniqueness constraint violated.
 * Another entity already has this unique value.
 */
export class TraitValueNotUnique extends Data.TaggedError("TraitValueNotUnique")<{
  readonly traitId: string
  readonly key: string
  readonly existingEntityId: string
  readonly attemptedEntityId: string
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Query Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query returned no results.
 */
export class QueryEmpty extends Data.TaggedError("QueryEmpty")<{
  readonly queryDescription: string
}> {}

/**
 * Query expected single result but found multiple.
 */
export class QueryMultipleResults extends Data.TaggedError("QueryMultipleResults")<{
  readonly queryDescription: string
  readonly count: number
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// World Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * World has been disposed and cannot be used.
 */
export class WorldDisposed extends Data.TaggedError("WorldDisposed")<{
  readonly worldId: string
}> {}

/**
 * World is currently locked for modifications.
 */
export class WorldLocked extends Data.TaggedError("WorldLocked")<{
  readonly worldId: string
  readonly reason: string
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Schema Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema validation failed during encode/decode.
 */
export class SchemaValidationError extends Data.TaggedError("SchemaValidationError")<{
  readonly schemaId: string
  readonly message: string
  readonly path: ReadonlyArray<string | number>
}> {}

/**
 * Schema transformation failed.
 */
export class SchemaTransformError extends Data.TaggedError("SchemaTransformError")<{
  readonly from: string
  readonly to: string
  readonly reason: string
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stream backpressure limit exceeded.
 */
export class BackpressureExceeded extends Data.TaggedError("BackpressureExceeded")<{
  readonly queueName: string
  readonly limit: number
  readonly current: number
}> {}

/**
 * Stream subscription failed.
 */
export class SubscriptionFailed extends Data.TaggedError("SubscriptionFailed")<{
  readonly streamId: string
  readonly reason: string
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Graph/Actor Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Actor/machine failed to spawn.
 */
export class ActorSpawnFailed extends Data.TaggedError("ActorSpawnFailed")<{
  readonly actorId: string
  readonly reason: string
}> {}

/**
 * Node in graph execution failed.
 */
export class NodeExecutionFailed extends Data.TaggedError("NodeExecutionFailed")<{
  readonly nodeId: string
  readonly graphId: string
  readonly cause: unknown
}> {}

/**
 * Graph contains a cycle preventing topological sort.
 */
export class GraphCycleDetected extends Data.TaggedError("GraphCycleDetected")<{
  readonly graphId: string
  readonly cycle: ReadonlyArray<string>
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Union Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Errors that can occur during entity spawn.
 */
export type SpawnError =
  | TraitValidationFailed
  | TraitValueNotUnique
  | WorldDisposed
  | WorldLocked

/**
 * Errors that can occur during addTrait.
 */
export type AddTraitError =
  | EntityNotFound
  | EntityDestroyed
  | TraitAlreadyAttached
  | TraitValidationFailed
  | TraitValueNotUnique
  | WorldDisposed
  | WorldLocked

/**
 * Errors that can occur during setTrait.
 */
export type SetTraitError =
  | EntityNotFound
  | EntityDestroyed
  | TraitMissing
  | TraitValidationFailed
  | TraitValueNotUnique
  | WorldDisposed
  | WorldLocked

/**
 * Errors that can occur during removeTrait.
 */
export type RemoveTraitError =
  | EntityNotFound
  | EntityDestroyed
  | TraitMissing
  | WorldDisposed
  | WorldLocked

/**
 * All KORI errors as a discriminated union.
 * Use Effect.catchTag for exhaustive pattern matching.
 *
 * @example
 * ```ts
 * pipe(
 *   someKoriEffect,
 *   Effect.catchTag("EntityNotFound", (e) =>
 *     Effect.succeed(createDefaultEntity(e.entityId))
 *   ),
 *   Effect.catchTag("TraitMissing", (e) =>
 *     Effect.fail(new ApplicationError(`Missing: ${e.traitId}`))
 *   )
 * )
 * ```
 */
export type KoriError =
  | EntityNotFound
  | EntityAlreadyExists
  | EntityDestroyed
  | TraitMissing
  | TraitAlreadyAttached
  | TraitValidationFailed
  | TraitValueNotUnique
  | QueryEmpty
  | QueryMultipleResults
  | WorldDisposed
  | WorldLocked
  | SchemaValidationError
  | SchemaTransformError
  | BackpressureExceeded
  | SubscriptionFailed
  | ActorSpawnFailed
  | NodeExecutionFailed
  | GraphCycleDetected
