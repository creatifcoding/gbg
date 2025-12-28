/**
 * KORI — Koota-Oriented Reactive Integration
 *
 * Effect-TS wrapper integrating ECS patterns with typed errors,
 * reactive streams, and scoped lifecycle management.
 *
 * Core concepts:
 * - **Traits**: Schema-validated data containers (like ECS components)
 * - **Entities**: Unique identifiers with attached traits
 * - **World**: Container managing all entities and their data
 * - **Streams**: Reactive query subscriptions with backpressure
 * - **Errors**: Tagged error hierarchy for exhaustive matching
 *
 * @example
 * ```ts
 * import { KoriWorld, Position2D, Health, Effect, Scope } from '@/lib/kori'
 *
 * const program = Effect.gen(function* () {
 *   const world = yield* KoriWorld
 *
 *   // Spawn entity (scoped — auto-cleanup on scope close)
 *   const entity = yield* world.spawn([
 *     { id: "Position2D", data: { _tag: "Position2D", x: 0, y: 0 } },
 *     { id: "Health", data: { _tag: "Health", current: 100, max: 100 } },
 *   ])
 *
 *   // Query entities with Health trait
 *   const healthyEntities = yield* world.queryWith("Health")
 *
 *   // Update trait
 *   yield* world.setTrait(entity.id, "Health", {
 *     _tag: "Health",
 *     current: 50,
 *     max: 100,
 *   })
 * }).pipe(
 *   Effect.scoped,
 *   Effect.provide(KoriWorldLive)
 * )
 * ```
 *
 * @module
 */

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Entity errors
  EntityNotFound,
  EntityAlreadyExists,
  EntityDestroyed,
  // Trait errors
  TraitMissing,
  TraitAlreadyAttached,
  TraitValidationFailed,
  TraitValueNotUnique,
  // Query errors
  QueryEmpty,
  QueryMultipleResults,
  // World errors
  WorldDisposed,
  WorldLocked,
  // Schema errors
  SchemaValidationError,
  SchemaTransformError,
  // Stream errors
  BackpressureExceeded,
  SubscriptionFailed,
  // Graph/Actor errors
  ActorSpawnFailed,
  NodeExecutionFailed,
  GraphCycleDetected,
  // Union types
  type KoriError,
  type SpawnError,
  type AddTraitError,
  type SetTraitError,
  type RemoveTraitError,
} from "./errors"

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Factory functions
  defineTrait,
  defineTagTrait,
  // Validation
  validateTrait,
  encodeTrait,
  // Registry
  registerTrait,
  getTraitSchema,
  listTraits,
  // Uniqueness utilities
  isUniqueTrait,
  getUniqueKeyExtractor,
  // Built-in traits
  Position2D,
  Position3D,
  Velocity2D,
  Velocity3D,
  Health,
  Name,
  Lifetime,
  ParentOf,
  ChildOf,
  // Tag traits
  IsPlayer,
  IsEnemy,
  IsActive,
  IsDestroyed,
  // Types
  type TraitId,
  type TraitMeta,
  type TraitRegistryEntry,
  type UniqueKeyExtractor,
  type TraitUniqueness,
  type RegisterTraitOptions,
  // EntitySpec schemas
  EntitySpec,
  EntityTypeId,
  TraitRequirement,
  SpecVersion,
  EntitySpecRegistry,
  ENTITY_SPEC_BUCKET,
  SPEC_WATCH_PATTERN,
  BUILTIN_SPECS,
  Scene3DEntitySpec,
  AvaViewEntitySpec,
  specKey,
  validateSpecTraits,
  entityAtomKey,
  parseEntityAtomKey,
  type TraitDefault,
  // Tagged entity
  DynamicEntity,
  EntityFactoryRegistry,
  createDynamicEntityFactory,
  toEntityId,
  type DynamicEntityFactory,
} from "./schemas"

// ─────────────────────────────────────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  // World service
  KoriWorld,
  KoriWorldLive,
  makeKoriWorld,
  // UniqueIndex service (subservice of KoriWorld)
  UniqueIndex,
  UniqueIndexLive,
  makeUniqueIndex,
  // Merge service
  KoriMerge,
  KoriMergeLive,
  makeKoriMerge,
  // Utility mergers
  sumMerger,
  concatMerger,
  maxMerger,
  minMerger,
  composeMergers,
  // Query Stream service
  KoriQueryStream,
  KoriQueryStreamLive,
  makeKoriQueryStream,
  // Batch Queue service
  KoriBatchQueue,
  KoriBatchQueueLive,
  KoriBatchQueueConfigured,
  makeKoriBatchQueue,
  // Combined stream layer
  KoriStreamLive,
  // Actor service
  KoriActor,
  KoriActorLive,
  makeKoriActor,
  // Actor utilities
  typedActorStream,
  runActorToCompletion,
  // Actor schemas
  ActorEventBase,
  ActorSpawnedEvent,
  ActorStateChangedEvent,
  ActorStoppedEvent,
  ActorLifecycleEventSchema,
  // Types
  type KoriWorldOps,
  type KoriMergeOps,
  type KoriEntity,
  type EntityId,
  type WorldId,
  type MergerFn,
  type MergeStrategy,
  type MergeConfig,
  type MergeResult,
  // UniqueIndex types
  type UniqueIndexOps,
  type IndexEntry,
  type IndexMutation,
  type IndexState,
  // Stream types
  type KoriQueryStreamOps,
  type KoriBatchQueueOps,
  type QueryEvent,
  type QueryEventType,
  type QuerySubscriptionConfig,
  type MutationOp,
  type BatchQueueConfig,
  type BatchFlushResult,
  // Actor types
  type KoriActorOps,
  type ActorId,
  type ActorSnapshotEvent,
  type ActorLifecycleEvent,
  type ActorEntityBinding,
  type ManagedActor,
  // Storage service (opaque NATS wrapper)
  KoriStorageService,
  KoriStorageServiceLive,
  KoriStorageServiceMock,
  KoriStorageError,
  KoriSpecNotFoundError,
  KoriConnectionError,
  type KoriStorageServiceShape,
  type KoriError as KoriStorageErrors,
  type SpecChangeEvent,
  // EntitySpec service
  EntitySpecService,
  EntitySpecServiceLive,
  EntitySpecServiceMock,
  EntitySpecServiceLayer,
  type EntitySpecServiceShape,
  // EntityAtomFactory service
  EntityAtomFactory,
  EntityAtomFactoryLive,
  EntityAtomFactoryMock,
  EntityAtomFactoryLayer,
  entityOps,
  type EntityAtomFactoryShape,
  type EntityAtoms,
  type EntityTypeAtoms,
  type EntityAtomKey,
  type AtomFactoryStats,
} from "./services"
